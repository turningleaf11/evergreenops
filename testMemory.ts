import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { retrieveMemories, storeMemory } from "./server/memory/memoryUtils.ts";

const loadDotEnv = () => {
  const envPath = resolve(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const envFile = readFileSync(envPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^[ '\"]|[ '\"]$/g, "");

    process.env[key] ??= value;
  }
};

const requireEnv = (name: string) => {
  if (!process.env[name]) {
    throw new Error(`Missing ${name}. Add it to .env or set it before running the test.`);
  }
};

const main = async () => {
  loadDotEnv();

  requireEnv("VITE_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("VERCEL_AI_API_KEY");

  const agentId = "memory-system-smoke-test";
  const content = `EvergreenOps memory smoke test created at ${new Date().toISOString()}. The CEO cockpit should remember operational priorities, cadences, and action items.`;
  const metadata = {
    source: "testMemory.ts",
    environment: "local-smoke-test",
    topic: "ceo-cockpit",
  };

  console.log("Storing sample memory...");
  const stored = await storeMemory(agentId, content, metadata);
  console.log("Stored memory:", {
    id: stored.id,
    agent_id: stored.agent_id,
    created_at: stored.created_at,
  });

  console.log("Retrieving similar memories...");
  const retrieved = await retrieveMemories("What should the CEO cockpit remember about priorities and cadences?", {
    agentId,
    metadata: { source: "testMemory.ts" },
    limit: 3,
  });

  console.log(
    "Retrieved memories:",
    retrieved.map((memory) => ({
      id: memory.id,
      agent_id: memory.agent_id,
      similarity: memory.similarity,
      content_preview: `${memory.content.slice(0, 120)}...`,
      metadata: memory.metadata,
    })),
  );

  if (retrieved.length === 0) {
    throw new Error("No memories were retrieved for the smoke-test query.");
  }

  if (!retrieved.some((memory) => memory.id === stored.id)) {
    throw new Error("Stored smoke-test memory was not returned by vector search.");
  }
};

main().catch((error) => {
  console.error("Memory system test failed:");
  console.error(error);
  process.exit(1);
});
