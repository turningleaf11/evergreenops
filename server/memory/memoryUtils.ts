import { createClient } from "@supabase/supabase-js";

type RuntimeEnv = Record<string, string | undefined>;

export type StoredMemory = {
  id: string;
  agent_id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RetrievedMemory = StoredMemory & {
  similarity: number;
};

export type RetrieveMemoryOptions = {
  agentId?: string;
  metadata?: Record<string, unknown>;
  limit?: number;
};

const getRuntimeEnv = (): RuntimeEnv => {
  return (process.env ?? {}) as RuntimeEnv;
};

const getRequiredEnv = (name: string): string => {
  const value = getRuntimeEnv()[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const getEmbeddingApiKey = (): string => {
  const apiKey = getRuntimeEnv().VERCEL_AI_API_KEY ?? getRuntimeEnv().OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing required environment variable: VERCEL_AI_API_KEY or OPENAI_API_KEY");
  }

  return apiKey;
};

const getSupabaseClient = () => {
  const supabaseUrl = getRuntimeEnv().SUPABASE_URL ?? getRequiredEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const toVectorLiteral = (embedding: number[]) => `[${embedding.join(",")}]`;

export const getEmbeddings = async (input: string): Promise<number[]> => {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getEmbeddingApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI embeddings request failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = payload.data?.[0]?.embedding;

  if (!embedding || embedding.length !== 1536) {
    throw new Error(`Expected a 1536-dimension embedding, received ${embedding?.length ?? 0}`);
  }

  return embedding;
};

export const storeMemory = async (
  agentId: string,
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<StoredMemory> => {
  const supabase = getSupabaseClient();
  const embedding = await getEmbeddings(content);

  const { data, error } = await supabase
    .from("memories")
    .insert({
      agent_id: agentId,
      content,
      embedding: toVectorLiteral(embedding),
      metadata,
    })
    .select("id, agent_id, content, metadata, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(`Failed to store memory: ${error.message}`);
  }

  return data as StoredMemory;
};

export const retrieveMemories = async (
  query: string,
  options: RetrieveMemoryOptions = {},
): Promise<RetrievedMemory[]> => {
  const supabase = getSupabaseClient();
  const embedding = await getEmbeddings(query);

  const { data, error } = await supabase.rpc("match_memories", {
    query_embedding: toVectorLiteral(embedding),
    match_count: options.limit ?? 5,
    filter_agent_id: options.agentId ?? null,
    filter_metadata: options.metadata ?? {},
  });

  if (error) {
    throw new Error(`Failed to retrieve memories: ${error.message}`);
  }

  return (data ?? []) as RetrievedMemory[];
};
