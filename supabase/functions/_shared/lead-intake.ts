// Shared helpers for lead intake (form + webhook).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-lovable-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(id: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || b.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

const ALLOWED_PROPERTY_TYPES = [
  "SFR", "SFR Portfolio", "MF Small (2-4)", "MF Large (5+)",
  "Mixed Use", "Commercial", "Land", "Other",
];

function asInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function asNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function asStr(v: unknown, max = 500): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

export type IntakePayload = Record<string, unknown> & { values?: Record<string, unknown> };

/**
 * Map a free-form payload to a leads insert. Accepts top-level fields, or `values: {...}`.
 * Unknown keys land in custom_fields.
 */
export function mapPayloadToLead(
  raw: IntakePayload,
  workspaceId: string,
  sourceLabel: string | null,
): { row: Record<string, unknown>; rejected?: string } {
  const v = (raw && typeof raw.values === "object" && raw.values) ? (raw.values as Record<string, unknown>) : raw;

  const propertyAddress = asStr(v.property_address ?? v.address ?? v.propertyAddress, 300);
  const submitterName =
    asStr(v.name ?? v.submitter_name ?? v.contact_name ?? v.full_name, 200) ?? "Inbound Lead";

  if (!propertyAddress && !submitterName) {
    return { row: {}, rejected: "Missing property_address or contact name" };
  }

  const propertyType = asStr(v.property_type ?? v.propertyType, 50);
  const safePropertyType = propertyType && ALLOWED_PROPERTY_TYPES.includes(propertyType) ? propertyType : null;

  const knownKeys = new Set([
    "property_address","address","propertyAddress",
    "property_city","city","property_state","state","property_zip","zip","postal_code",
    "property_type","propertyType",
    "units","unit_mix","unitMix","sqft","square_feet",
    "asking_price","askingPrice","price",
    "name","submitter_name","contact_name","full_name",
    "email","phone","company","company_name",
    "notes","note","message",
    "source","values",
  ]);

  const customFields: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (!knownKeys.has(k) && val !== null && val !== undefined && val !== "") {
      customFields[k] = val;
    }
  }

  const row: Record<string, unknown> = {
    workspace_id: workspaceId,
    name: submitterName,
    email: asStr(v.email, 320),
    phone: asStr(v.phone, 50),
    company_name: asStr(v.company ?? v.company_name, 200),
    property_address: propertyAddress,
    property_city: asStr(v.property_city ?? v.city, 100),
    property_state: asStr(v.property_state ?? v.state, 50),
    property_zip: asStr(v.property_zip ?? v.zip ?? v.postal_code, 20),
    property_type: safePropertyType,
    units: asInt(v.units),
    unit_mix: asStr(v.unit_mix ?? v.unitMix, 200),
    sqft: asInt(v.sqft ?? v.square_feet),
    asking_price: asNum(v.asking_price ?? v.askingPrice ?? v.price),
    notes: asStr(v.notes ?? v.note ?? v.message, 5000) ?? "",
    source: asStr(v.source, 100) ?? sourceLabel,
    status: "new",
    temperature: "warm",
    lane: "portfolio",
    custom_fields: customFields,
  };

  return { row };
}

export async function recordSubmission(
  client: SupabaseClient,
  args: {
    sourceId: string;
    workspaceId: string;
    leadId: string | null;
    payload: unknown;
    ip: string | null;
    userAgent: string | null;
    status: "ok" | "error" | "rejected";
    error?: string | null;
  },
) {
  await client.from("lead_intake_submissions").insert({
    source_id: args.sourceId,
    workspace_id: args.workspaceId,
    lead_id: args.leadId,
    payload: args.payload ?? {},
    ip: args.ip,
    user_agent: args.userAgent,
    status: args.status,
    error: args.error ?? null,
  });

  if (args.status === "ok") {
    const { data: cur } = await client
      .from("lead_intake_sources")
      .select("submission_count")
      .eq("id", args.sourceId)
      .single();
    const next = (cur?.submission_count ?? 0) + 1;
    await client
      .from("lead_intake_sources")
      .update({ submission_count: next, last_submission_at: new Date().toISOString() })
      .eq("id", args.sourceId);
  }
}

export async function emitActivity(
  client: SupabaseClient,
  args: { leadId: string; leadName: string; sourceName: string; departmentId?: string | null },
) {
  await client.from("activity_events").insert({
    action: "lead.inbound",
    entity_type: "lead",
    entity_id: args.leadId,
    entity_title: args.leadName,
    actor_name: args.sourceName,
    department_id: args.departmentId ?? null,
    metadata: { source: args.sourceName },
  });
}

export function getClientIp(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}
