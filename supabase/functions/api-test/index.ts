// Sandbox endpoint — same auth & validation as api-ingest, but never writes.
// Returns "wouldExecute" / "wouldInsertOrUpdate" for inspection.
import handler from "../api-ingest/index.ts";

Deno.serve((req) => handler(req, true));
