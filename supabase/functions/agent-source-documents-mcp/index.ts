import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Retired 2026-08-26.
// Durable source documents remain in OpsHQ. The production operating path is:
// Ema capture -> OpsHQ durable storage -> Cash underwriting_next_work_item.
// Keep this old endpoint fail-closed so no client can accidentally depend on
// the temporary duplicate MCP implementation.
Deno.serve(() => new Response(
  JSON.stringify({
    error: "endpoint_retired",
    canonical_service: "agent-gateway-mcp",
  }),
  {
    status: 410,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  },
));
