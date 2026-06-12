// Webhook receiver for GHL call events.
//
// Triggered from a GHL Workflow when a call starts or is completed.
// GHL workflow should POST a JSON body with at minimum:
//   {
//     "ghl_user_id":  "<the user who logged the call>",
//     "contact_id":   "<optional, the contact being called>",
//     "disposition":  "<optional, e.g. 'Connected – Seller'>",
//     "duration":     <optional, seconds>,
//     "occurred_at":  <optional ISO timestamp; defaults to now()>
//   }
//
// disposition is OPTIONAL — GHL may not include it on initial call events.
// ghl_user_id IS required (used to attribute calls to a team member).
//
// Authentication: header X-Webhook-Secret must match ORBIT_WEBHOOK_SECRET env var.
// Set this secret in Supabase Dashboard → Edge Functions → Secrets, then include
// the same value in the GHL Workflow's custom-webhook headers.
//
// Idempotency: events are deduplicated by (ghl_user_id, contact_id, rounded-to-minute timestamp)
// so workflow retries don't double-count.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const expectedSecret = Deno.env.get("ORBIT_WEBHOOK_SECRET");

    const incomingSecret = req.headers.get("X-Webhook-Secret");
    if (!expectedSecret) {
      return json({ error: "Webhook not configured (ORBIT_WEBHOOK_SECRET env var unset)" }, 500);
    }
    if (incomingSecret !== expectedSecret) {
      return json({ error: "Invalid webhook secret" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // GHL can be configured to send various shapes — try the common fields first,
    // fall back to nested 'data' or 'payload' wrappers.
    const data = raw.data || raw.payload || raw;

    const ghlUserId: string | undefined = data.ghl_user_id || data.userId || data.user_id || data.assignedUserId;
    const disposition: string | undefined = data.disposition || data.call_disposition || data.callDisposition || data.outcome;
    const contactId: string | undefined = data.contact_id || data.contactId || data.contact?.id;
    const durationRaw = data.duration ?? data.duration_seconds ?? data.callDuration;
    const duration = typeof durationRaw === "number" ? durationRaw : (durationRaw ? parseInt(String(durationRaw), 10) : null);
    const occurredAtRaw: string | undefined = data.occurred_at || data.timestamp || data.dateAdded || data.createdAt;
    const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();

    if (!ghlUserId) {
      return json({
        error: "Missing ghl_user_id (workflow must include the user who logged the call)",
        received_keys: Object.keys(data),
      }, 400);
    }
    // disposition is optional — don't reject if absent (GHL sends call-start events without it)

    // Dedup key: user + contact + minute. Retries within the same minute = duplicate.
    // disposition intentionally excluded so call-start and call-end events for the same
    // call don't both count (first one wins).
    const minuteBucket = new Date(Math.floor(occurredAt.getTime() / 60000) * 60000).toISOString();
    const dedupeInput = `${ghlUserId}|${contactId || "noContact"}|${minuteBucket}`;
    const dedupeKey = await sha256Hex(dedupeInput);

    const { error: insertError } = await admin.from("orbit_call_events").insert({
      ghl_user_id: ghlUserId,
      disposition,
      contact_id: contactId || null,
      duration_seconds: duration,
      occurred_at: occurredAt.toISOString(),
      raw,
      dedupe_key: dedupeKey,
    });

    if (insertError) {
      // Unique constraint on dedupe_key — treat as success (idempotent retry)
      if (insertError.code === "23505") {
        return json({ ok: true, deduplicated: true });
      }
      console.error("Insert failed:", insertError);
      return json({ error: insertError.message }, 500);
    }

    return json({ ok: true, dedupe_key: dedupeKey });
  } catch (e: any) {
    console.error("orbit-call-webhook error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
