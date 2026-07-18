// extract-deal-doc -- reads an uploaded deal document (PDF or image) with Claude
// and pulls the key dates + terms, so the TC deadlines don't have to be typed by
// hand. Stores the result on deal_documents.extracted; the client reviews and
// applies to the deal. Auth: verify_jwt (signed-in team members).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "deal-documents";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function parseJson(text: string): any {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    const { document_id } = await req.json();
    if (!document_id) return json({ error: "document_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: doc, error: docErr } = await admin
      .from("deal_documents").select("id, storage_path, mime, doc_type").eq("id", document_id).maybeSingle();
    if (docErr) return json({ error: docErr.message }, 500);
    if (!doc) return json({ error: "Document not found" }, 404);

    const mime = (doc.mime || "").toLowerCase();
    const isPdf = mime.includes("pdf");
    const isImage = mime.startsWith("image/");
    if (!isPdf && !isImage) return json({ error: "Only PDF or image documents can be read." }, 400);

    const { data: file, error: dlErr } = await admin.storage.from(BUCKET).download(doc.storage_path);
    if (dlErr || !file) return json({ error: `Download failed: ${dlErr?.message ?? "no file"}` }, 500);
    const b64 = encodeBase64(new Uint8Array(await file.arrayBuffer()));

    const prompt =
      "You are reading a US real-estate document (likely a purchase agreement or assignment). " +
      "Extract these fields. Use null for anything not clearly present -- never guess. " +
      "Dates as YYYY-MM-DD. Amounts as plain numbers (no $ or commas). Return ONLY a JSON object with exactly these keys:\n" +
      '  "fully_executed_date"  (date all parties signed)\n' +
      '  "emd_due_date"         (when earnest money is due per the contract)\n' +
      '  "emd_amount"           (earnest money amount)\n' +
      '  "inspection_end_date"  (end of inspection period)\n' +
      '  "due_diligence_end_date"\n' +
      '  "closing_date"\n' +
      '  "purchase_price"\n' +
      '  "seller_name"\n' +
      '  "buyer_name"\n' +
      '  "property_address"';

    const source = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
      : { type: "image", source: { type: "base64", media_type: mime, data: b64 } };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: [source, { type: "text", text: prompt }] }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("Anthropic error", r.status, t);
      await admin.from("deal_documents").update({ extraction_status: "error" }).eq("id", document_id);
      return json({ error: `AI error ${r.status}` }, 500);
    }
    const data = await r.json();
    const parsed = parseJson(data?.content?.[0]?.text || "{}");
    if (!parsed) {
      await admin.from("deal_documents").update({ extraction_status: "error" }).eq("id", document_id);
      return json({ error: "Could not read the document." }, 500);
    }

    await admin.from("deal_documents").update({ extracted: parsed, extraction_status: "done" }).eq("id", document_id);
    return json({ extracted: parsed });
  } catch (e) {
    console.error("extract-deal-doc error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
