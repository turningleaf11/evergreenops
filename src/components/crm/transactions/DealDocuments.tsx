// DealDocuments — the deal's paper (contracts, assignment, HUDs, EMD proof, POF,
// title). Upload to private storage; for a PDF/image, Claude extracts the key
// dates + terms (extract-deal-doc) so the TC deadlines don't get typed by hand —
// review, then apply to the deal in one click.

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Upload, Loader2, Sparkles, Download, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const dispo = supabase as unknown as { from: (t: string) => any };
const BUCKET = "deal-documents";

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "purchase_agreement", label: "Purchase Agreement" },
  { value: "assignment_agreement", label: "Assignment Agreement" },
  { value: "hud_ab", label: "HUD (A→B)" },
  { value: "hud_bc", label: "HUD (B→C)" },
  { value: "emd_proof", label: "EMD Proof (ours)" },
  { value: "emd_proof_buyer", label: "EMD Proof (buyer)" },
  { value: "proof_of_funds", label: "Proof of Funds" },
  { value: "title_commitment", label: "Title Commitment" },
  { value: "closing_statement", label: "Closing Statement" },
  { value: "other", label: "Other" },
];
const typeLabel = (v: string) => DOC_TYPES.find((t) => t.value === v)?.label ?? v;

interface DocRow {
  id: string;
  doc_type: string;
  file_name: string;
  storage_path: string;
  mime: string | null;
  size_bytes: number | null;
  extracted: Record<string, unknown> | null;
  extraction_status: string | null;
  created_at: string;
}

// extracted key -> deal field + how to render/apply
const APPLY_MAP: { key: string; label: string; field: string; kind: "date" | "money" | "text" }[] = [
  { key: "fully_executed_date", label: "Fully executed", field: "fully_executed_date", kind: "date" },
  { key: "emd_due_date", label: "EMD due (contract)", field: "emd_due_date", kind: "date" },
  { key: "emd_amount", label: "EMD amount", field: "earnest_money_required", kind: "money" },
  { key: "inspection_end_date", label: "Inspection end", field: "inspection_deadline", kind: "date" },
  { key: "due_diligence_end_date", label: "Due diligence end", field: "due_diligence_end", kind: "date" },
  { key: "closing_date", label: "Closing date", field: "closing_date", kind: "date" },
  { key: "purchase_price", label: "Purchase price", field: "purchase_price", kind: "money" },
  { key: "property_address", label: "Property address", field: "property_address", kind: "text" },
];

const fmtSize = (n: number | null) => (n == null ? "" : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const fmtVal = (kind: string, v: unknown) => (kind === "money" && v != null ? `$${Number(v).toLocaleString()}` : String(v));

export function DealDocuments({ transactionId, onApplied }: { transactionId: string; onApplied?: () => void }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("purchase_agreement");
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [review, setReview] = useState<DocRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await dispo.from("deal_documents").select("*").eq("transaction_id", transactionId).order("created_at", { ascending: false });
    setDocs((data as DocRow[]) ?? []);
  }, [transactionId]);
  useEffect(() => { void load(); }, [load]);

  async function onFile(file: File) {
    setUploading(true);
    const path = `${transactionId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) { setUploading(false); toast.error(`Upload failed: ${error.message}`); return; }
    await dispo.from("deal_documents").insert({
      transaction_id: transactionId, doc_type: docType, file_name: file.name,
      storage_path: path, mime: file.type || null, size_bytes: file.size, uploaded_by: user?.id ?? null,
    });
    setUploading(false);
    toast.success("Document uploaded");
    void load();
  }

  async function view(d: DocRow) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, 120);
    if (error || !data) { toast.error("Couldn't open document"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(d: DocRow) {
    if (!window.confirm(`Delete ${d.file_name}?`)) return;
    await supabase.storage.from(BUCKET).remove([d.storage_path]);
    await dispo.from("deal_documents").delete().eq("id", d.id);
    void load();
  }

  async function extract(d: DocRow) {
    setExtractingId(d.id);
    const { data, error } = await supabase.functions.invoke("extract-deal-doc", { body: { document_id: d.id } });
    setExtractingId(null);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message || "Couldn't read the document"); return; }
    await load();
    setReview({ ...d, extracted: (data as any).extracted, extraction_status: "done" });
  }

  const canExtract = (d: DocRow) => (d.mime || "").includes("pdf") || (d.mime || "").startsWith("image/");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="crm-eyebrow">Documents</h3>
        <div className="flex items-center gap-2">
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onFile(f); }} />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
          </Button>
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="crm-card text-sm text-muted-foreground italic">No documents yet. Upload the purchase agreement and let AI pull the dates.</div>
      ) : (
        <ul className="crm-card !p-1.5 divide-y divide-border/40">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-2 py-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{d.file_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {typeLabel(d.doc_type)}{d.size_bytes ? ` · ${fmtSize(d.size_bytes)}` : ""}
                  {d.extraction_status === "done" && <span className="text-brand-mint-deep"> · read by AI</span>}
                </div>
              </div>
              {canExtract(d) && (
                <Button size="sm" variant="ghost" className="gap-1.5 h-8" onClick={() => (d.extracted ? setReview(d) : extract(d))} disabled={extractingId === d.id}>
                  {extractingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {d.extracted ? "Review" : "Extract dates"}
                </Button>
              )}
              <button type="button" onClick={() => view(d)} title="Open" className="text-muted-foreground hover:text-foreground p-1"><Download className="h-4 w-4" /></button>
              <button type="button" onClick={() => remove(d)} title="Delete" className="text-muted-foreground hover:text-brand-coral p-1"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}

      <ReviewDialog review={review} onClose={() => setReview(null)} transactionId={transactionId} onApplied={onApplied} />
    </section>
  );
}

function ReviewDialog({
  review, onClose, transactionId, onApplied,
}: {
  review: DocRow | null;
  onClose: () => void;
  transactionId: string;
  onApplied?: () => void;
}) {
  const ex = (review?.extracted ?? {}) as Record<string, unknown>;
  const rows = APPLY_MAP.filter((m) => ex[m.key] != null && ex[m.key] !== "");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // default: apply everything found
    setChecked(Object.fromEntries(rows.map((m) => [m.key, true])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review?.id]);

  async function apply() {
    const patch: Record<string, unknown> = {};
    for (const m of rows) {
      if (!checked[m.key]) continue;
      const raw = ex[m.key];
      patch[m.field] = m.kind === "money" ? Number(raw) : raw;
    }
    if (Object.keys(patch).length === 0) { onClose(); return; }
    setSaving(true);
    const { error } = await dispo.from("crm_transactions").update(patch).eq("id", transactionId);
    setSaving(false);
    if (error) { toast.error(`Couldn't apply: ${error.message}`); return; }
    toast.success("Applied to the deal");
    onApplied?.();
    onClose();
  }

  const seller = ex.seller_name, buyer = ex.buyer_name;

  return (
    <Dialog open={!!review} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Apply extracted details</DialogTitle></DialogHeader>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recognizable was found in this document.</p>
        ) : (
          <div className="space-y-1.5">
            {(seller || buyer) && (
              <p className="text-[11px] text-muted-foreground pb-1">
                {seller ? `Seller: ${seller}` : ""}{seller && buyer ? " · " : ""}{buyer ? `Buyer: ${buyer}` : ""}
              </p>
            )}
            {rows.map((m) => (
              <label key={m.key} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer">
                <Checkbox checked={!!checked[m.key]} onCheckedChange={(v) => setChecked((c) => ({ ...c, [m.key]: !!v }))} />
                <span className="text-xs text-muted-foreground w-32 shrink-0">{m.label}</span>
                <span className="text-sm font-medium tabular-nums">{fmtVal(m.kind, ex[m.key])}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {rows.length > 0 && (
            <Button onClick={apply} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Apply to deal
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DealDocuments;
