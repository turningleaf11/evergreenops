// Napkin MCP — update_deal_inputs
//
// Drop into evergreennapkin at: src/lib/mcp/tools/update-deal-inputs.ts
// Then register in src/lib/mcp/index.ts alongside create-deal.
//
// Partial MERGE, never replace. Cash typically knows a handful of fields at a
// time (units and rents from a rent roll, then expenses from a T12, then debt
// terms once financing is chosen). A replace-semantics tool would wipe the
// other 90+ fields on every call.

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
  name: "update_deal_inputs",
  title: "Update deal inputs",
  description:
    "Merge partial underwriting inputs into an existing deal. Only the fields you pass are changed; " +
    "everything else is left alone. Use this to prefill a model from extracted documents.",
  inputSchema: {
    deal_id: z.string().uuid().describe("The deal id (uuid)."),
    inputs: z
      .record(z.union([z.number(), z.string(), z.boolean()]))
      .describe(
        "Partial inputs to merge, e.g. { expenseRate: 48, vacancyRate: 7 }. " +
          "Unknown keys are rejected.",
      ),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ deal_id, inputs }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    if (!inputs || Object.keys(inputs).length === 0) {
      return { content: [{ type: "text", text: "No input fields supplied." }], isError: true };
    }

    const valid = new Set(Object.keys(defaultInputs));
    const unknown = Object.keys(inputs).filter((k) => !valid.has(k));
    if (unknown.length > 0) {
      return {
        content: [
          { type: "text", text: `Unknown input field(s): ${unknown.join(", ")}. Nothing updated.` },
        ],
        isError: true,
      };
    }

    const client = sb(ctx);

    // Read-merge-write. RLS decides whether this user may see/edit the row, so a
    // missing result here means "not found or not permitted" — same as the
    // existing update_deal_notes tool.
    const { data: existing, error: readErr } = await client
      .from("deals")
      .select("id, inputs")
      .eq("id", deal_id)
      .maybeSingle();

    if (readErr) return { content: [{ type: "text", text: readErr.message }], isError: true };
    if (!existing) {
      return {
        content: [
          { type: "text", text: "Deal not found or you do not have permission to edit it." },
        ],
        isError: true,
      };
    }

    const merged = { ...(existing.inputs as Record<string, unknown>), ...inputs };

    const { data, error } = await client
      .from("deals")
      .update({ inputs: merged })
      .eq("id", deal_id)
      .select("id, property_name, updated_at")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ...data, updated_fields: Object.keys(inputs) }),
        },
      ],
      structuredContent: { deal: data, updated_fields: Object.keys(inputs) },
    };
  },
});
