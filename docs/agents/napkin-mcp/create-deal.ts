// Napkin MCP — create_deal
//
// Drop into evergreennapkin at: src/lib/mcp/tools/create-deal.ts
// Then register in src/lib/mcp/index.ts:
//   import createDeal from "./tools/create-deal";
//   tools: [listDeals, getDeal, updateDealNotes, createDeal, updateDealInputs]
//
// Why this exists: Cash can currently read deals and write notes, but cannot
// create one or set underwriting inputs. That makes "prefill the model from an
// extracted T12/rent roll" impossible. This is the missing write-path.

import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { defaultInputs } from "@/lib/underwriting-calculations";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_deal",
  title: "Create deal",
  description:
    "Create a new underwriting deal with optional prefilled inputs. Any input fields not supplied " +
    "fall back to the house defaults. Returns the new deal id so inputs can be refined afterwards.",
  inputSchema: {
    property_name: z.string().min(1).describe("Name for the deal, e.g. 'Palm Grove 24-unit'."),
    property_address: z.string().optional().describe("Street address of the property."),
    inputs: z
      .record(z.union([z.number(), z.string(), z.boolean()]))
      .optional()
      .describe(
        "Partial underwriting inputs to prefill, e.g. { units: 24, grossMonthlyRents: 31200, " +
          "askingPrice: 2850000 }. Unknown keys are rejected — use get_deal on any existing deal " +
          "to see the valid field names.",
      ),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ property_name, property_address, inputs }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }

    const client = sb(ctx);

    const {
      data: { user },
      error: userErr,
    } = await client.auth.getUser();
    if (userErr || !user) {
      return { content: [{ type: "text", text: "Could not resolve signed-in user." }], isError: true };
    }

    // Reject unknown keys rather than silently dropping them — a typo'd field name
    // that quietly does nothing is worse than an error, because the deal then gets
    // underwritten on a default the caller thought they had overridden.
    const valid = new Set(Object.keys(defaultInputs));
    const unknown = Object.keys(inputs ?? {}).filter((k) => !valid.has(k));
    if (unknown.length > 0) {
      return {
        content: [
          { type: "text", text: `Unknown input field(s): ${unknown.join(", ")}. Deal not created.` },
        ],
        isError: true,
      };
    }

    const merged = {
      ...defaultInputs,
      ...(inputs ?? {}),
      propertyName: property_name,
      propertyAddress: property_address ?? "",
    };

    const { data, error } = await client
      .from("deals")
      .insert({
        user_id: user.id,
        property_name,
        property_address: property_address ?? null,
        inputs: merged,
      })
      .select("id, property_name, property_address, created_at")
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { deal: data, prefilled_fields: Object.keys(inputs ?? {}) },
    };
  },
});
