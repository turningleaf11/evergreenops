// Mercury CSV import.
//
// This is what makes the books maintainable: drop the exports in, and the same
// rows can be re-imported forever without duplicating. The external_id is a
// SHA-1 of the fields Mercury actually guarantees, computed identically to
// tools/books/import_to_opshq.py, so rows loaded by either path collide
// correctly rather than doubling up.

import { useCallback, useMemo, useRef, useState } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import type { BookBankAccount } from "@/hooks/useBooks";
import type { Database } from "@/integrations/supabase/types";

// The generated Insert type, so a renamed or retyped column fails here rather
// than at Postgres with a row already half-imported.
type TransactionInsert = Database["public"]["Tables"]["book_transactions"]["Insert"];

interface Props {
  bankAccounts: BookBankAccount[];
  onImported: () => void;
}

interface FileReport {
  name: string;
  read: number;
  inserted: number;
  duplicates: number;
  unmapped: string[];
  error?: string;
}

/** RFC4180-ish parser — Mercury quotes fields that contain commas and newlines. */
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  if (!rows.length) return [];
  const head = rows.shift()!.map((h) => h.trim());
  return rows.filter((r) => r.length > 1).map((r) => {
    const o: Record<string, string> = {};
    head.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

/** Must match the Python importer byte for byte, or re-imports duplicate. */
async function externalId(date: string, desc: string, amount: string, last4: string, ts: string) {
  const buf = new TextEncoder().encode(`${date}|${desc}|${amount}|${last4}|${ts}`);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export default function BooksImport({ bankAccounts, onImported }: Props) {
  const { profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<FileReport[]>([]);
  const [dragging, setDragging] = useState(false);

  const byLastFour = useMemo(
    () => new Map(bankAccounts.map((b) => [b.last_four ?? "", b])),
    [bankAccounts],
  );

  const handleFiles = useCallback(async (files: File[]) => {
    const csvs = files.filter((f) => /\.csv$/i.test(f.name));
    if (!csvs.length) {
      toast.error("Mercury exports as CSV — that file isn't one.");
      return;
    }
    if (!profile?.workspace_id) {
      toast.error("No workspace on your profile; cannot import.");
      return;
    }

    setBusy(true);
    const out: FileReport[] = [];

    for (const file of csvs) {
      const rep: FileReport = { name: file.name, read: 0, inserted: 0, duplicates: 0, unmapped: [] };
      try {
        const rows = parseCSV(await file.text());
        const dateCol = rows[0] && ("Date (UTC)" in rows[0] ? "Date (UTC)" : "Date");
        if (!rows.length || !dateCol || !(dateCol in rows[0])) {
          rep.error = `No date column. Found: ${Object.keys(rows[0] ?? {}).slice(0, 6).join(", ") || "nothing"}`;
          out.push(rep);
          continue;
        }

        const payload: TransactionInsert[] = [];
        const unmapped = new Set<string>();

        for (const r of rows) {
          const rawDate = r[dateCol];
          if (!rawDate) continue;
          const m = /xx(\d{4})/.exec(r["Source Account"] ?? "");
          if (!m) continue;
          const bank = byLastFour.get(m[1]);
          if (!bank) { unmapped.add(m[1]); continue; }

          rep.read++;
          const desc = (r["Description"] ?? "").slice(0, 200);
          const ext = await externalId(rawDate, desc, r["Amount"] ?? "", m[1], r["Timestamp"] ?? "");
          const failed = r["Status"] === "Failed";

          payload.push({
            workspace_id: profile.workspace_id,
            bank_account_id: bank.id,
            entity_id: bank.entity_id,
            // Mercury writes MM-DD-YYYY; Postgres wants ISO.
            txn_date: `${rawDate.slice(6, 10)}-${rawDate.slice(0, 2)}-${rawDate.slice(3, 5)}`,
            description: desc,
            bank_description: (r["Bank Description"] ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null,
            memo: ((r["Note"] || r["Reference"] || "").replace(/\s+/g, " ").trim() || null),
            amount: Number(String(r["Amount"] ?? "0").replace(/[$,]/g, "")) || 0,
            status: failed ? "failed" : "posted",
            failure_reason: failed ? (r["Failure Reason"] ?? "").slice(0, 200) || null : null,
            external_id: ext,
          });
        }

        rep.unmapped = [...unmapped];

        // Chunked so a large year doesn't hit a request limit. ignoreDuplicates
        // is what makes re-importing the same month a no-op.
        for (let i = 0; i < payload.length; i += 400) {
          const slice = payload.slice(i, i + 400);
          const { data, error } = await supabase
            .from("book_transactions")
            .upsert(slice, {
              onConflict: "workspace_id,bank_account_id,external_id",
              ignoreDuplicates: true,
            })
            .select("id");
          if (error) throw new Error(error.message);
          rep.inserted += data?.length ?? 0;
        }
        rep.duplicates = rep.read - rep.inserted;
      } catch (err) {
        rep.error = err instanceof Error ? err.message : String(err);
      }
      out.push(rep);
    }

    setReports(out);
    setBusy(false);

    const added = out.reduce((n, r) => n + r.inserted, 0);
    const dupes = out.reduce((n, r) => n + r.duplicates, 0);
    if (out.some((r) => r.error)) toast.error("Some files could not be read — see the report below.");
    else if (added === 0 && dupes > 0) toast.success(`Already imported — ${dupes} rows were skipped as duplicates.`);
    else toast.success(`Imported ${added} transaction${added === 1 ? "" : "s"}.`);

    if (added > 0) onImported();
  }, [byLastFour, profile?.workspace_id, onImported]);

  return (
    <div className="crm-section-stack">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles([...e.dataTransfer.files]); }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles([...(e.target.files ?? [])]); e.target.value = ""; }}
        />
        {busy ? (
          <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        )}
        <p className="text-[15px] font-semibold tracking-tight">
          {busy ? "Reading…" : "Drop Mercury CSV exports here"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Export with <span className="font-medium">all accounts</span> selected. Re-importing the same
          month is safe — rows already loaded are skipped, never duplicated.
        </p>
        <Button variant="outline" size="sm" className="mt-4" disabled={busy}
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
          Choose files
        </Button>
      </div>

      {reports.length > 0 && (
        <div className="crm-card">
          <div className="crm-eyebrow mb-3">Import report</div>
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.name} className="flex items-start gap-3 text-sm">
                {r.error ? (
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{r.name}</span>
                  </div>
                  {r.error ? (
                    <p className="text-xs text-destructive mt-1">{r.error}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.read} read · <span className="text-foreground font-medium">{r.inserted} new</span>
                      {r.duplicates > 0 && ` · ${r.duplicates} already present`}
                    </p>
                  )}
                  {r.unmapped.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      Skipped {r.unmapped.length} account
                      {r.unmapped.length === 1 ? "" : "s"} not in the map:{" "}
                      <span className="font-mono">{r.unmapped.join(", ")}</span>. Add them in Setup, then
                      re-import — nothing will duplicate.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
