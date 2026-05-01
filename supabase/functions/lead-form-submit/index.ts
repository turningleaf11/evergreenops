// Public form endpoint: accepts a lead submission via slug. No auth required.
// POST /lead-form-submit/<slug>
//   - JSON body: { values: {...} } or { ...fields }
//   - multipart/form-data: field "values" = JSON string of values, field "files" = file uploads (multiple)
import {
  corsHeaders, json, admin, rateLimit, mapPayloadToLead,
  recordSubmission, emitActivity, getClientIp,
} from "../_shared/lead-intake.ts";

const MAX_FILES = 8;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function guessKind(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("om") || n.includes("offering")) return "om";
  if (n.includes("t12") || n.includes("t-12")) return "t12";
  if (n.includes("rent") && n.includes("roll")) return "rent_roll";
  if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(n)) return "photo";
  return "other";
}

function safeExt(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : "bin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    const slug = parts[parts.length - 1];
    if (!slug) return json({ error: "Missing form slug in URL" }, 400);

    const ip = getClientIp(req);
    const ua = req.headers.get("user-agent");

    if (!rateLimit(`form:${slug}:${ip ?? "anon"}`, 30)) {
      return json({ error: "Too many submissions, please slow down." }, 429);
    }

    const supabase = admin();

    const { data: source } = await supabase
      .from("lead_intake_sources")
      .select("id, workspace_id, name, kind, active, default_source_label")
      .eq("slug", slug)
      .maybeSingle();

    if (!source || source.kind !== "form" || !source.active) {
      return json({ error: "Form not found" }, 404);
    }

    // Parse body — supports JSON or multipart/form-data (with files)
    let body: any = {};
    let uploads: File[] = [];
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const valuesRaw = form.get("values");
      if (typeof valuesRaw === "string") {
        try { body = JSON.parse(valuesRaw); } catch { body = {}; }
      }
      // Wrap as { values: {...} } shape if needed
      if (body && !body.values && Object.keys(body).length) body = { values: body };
      const all = form.getAll("files");
      for (const f of all) {
        if (f instanceof File && f.size > 0) uploads.push(f);
      }
      if (uploads.length > MAX_FILES) uploads = uploads.slice(0, MAX_FILES);
    } else {
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
    }

    // Honeypot
    if (body && typeof body === "object" && (body.hp_company || body.values?.hp_company)) {
      await recordSubmission(supabase, {
        sourceId: source.id, workspaceId: source.workspace_id, leadId: null,
        payload: { honeypot: true }, ip, userAgent: ua, status: "rejected", error: "honeypot",
      });
      return json({ ok: true }); // pretend success
    }

    const sourceLabel = source.default_source_label ?? `Form: ${source.name}`;
    const { row, rejected } = mapPayloadToLead(body, source.workspace_id, sourceLabel);

    if (rejected) {
      await recordSubmission(supabase, {
        sourceId: source.id, workspaceId: source.workspace_id, leadId: null,
        payload: body, ip, userAgent: ua, status: "rejected", error: rejected,
      });
      return json({ error: rejected }, 400);
    }

    const { data: lead, error: insertErr } = await supabase
      .from("leads")
      .insert(row)
      .select("id, name")
      .single();

    if (insertErr || !lead) {
      await recordSubmission(supabase, {
        sourceId: source.id, workspaceId: source.workspace_id, leadId: null,
        payload: body, ip, userAgent: ua, status: "error", error: insertErr?.message ?? "insert failed",
      });
      return json({ error: insertErr?.message ?? "Could not create lead" }, 500);
    }

    // Upload files (if any) to storage and link via lead_files
    const fileResults: { name: string; ok: boolean; error?: string }[] = [];
    for (const f of uploads) {
      try {
        if (f.size > MAX_FILE_BYTES) {
          fileResults.push({ name: f.name, ok: false, error: "file too large" });
          continue;
        }
        const ext = safeExt(f.name);
        const path = `lead-intake/${source.workspace_id}/${lead.id}/${crypto.randomUUID()}.${ext}`;
        const buf = new Uint8Array(await f.arrayBuffer());
        const { error: upErr } = await supabase.storage.from("files").upload(path, buf, {
          contentType: f.type || "application/octet-stream",
          upsert: false,
        });
        if (upErr) {
          fileResults.push({ name: f.name, ok: false, error: upErr.message });
          continue;
        }
        const { data: pub } = supabase.storage.from("files").getPublicUrl(path);
        const { error: linkErr } = await supabase.from("lead_files").insert({
          lead_id: lead.id,
          workspace_id: source.workspace_id,
          uploaded_by: null,
          name: f.name,
          url: pub.publicUrl,
          storage_path: path,
          size_bytes: f.size,
          mime_type: f.type || null,
          kind: guessKind(f.name),
        });
        if (linkErr) {
          fileResults.push({ name: f.name, ok: false, error: linkErr.message });
        } else {
          fileResults.push({ name: f.name, ok: true });
        }
      } catch (err) {
        fileResults.push({ name: f.name, ok: false, error: String((err as any)?.message || err) });
      }
    }

    await recordSubmission(supabase, {
      sourceId: source.id, workspaceId: source.workspace_id, leadId: lead.id,
      payload: { ...body, _files: fileResults }, ip, userAgent: ua, status: "ok",
    });

    await emitActivity(supabase, {
      leadId: lead.id, leadName: lead.name, sourceName: sourceLabel,
    });

    return json({ ok: true, lead_id: lead.id, files: fileResults });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
