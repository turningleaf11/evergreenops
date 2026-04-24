import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { downloadCsv, parseCsv, parseValue, stringifyValue, toCsv } from "@/lib/csv";

type DBCol = { id: string; name: string; type: string };

interface Props {
  databaseId: string;
  databaseTitle: string;
  columns: DBCol[];
  onImported: () => void;
  dispatchWebhook?: (event: string, row: any) => void;
}

export default function ImportExportTabPanel({ databaseId, databaseTitle, columns, onImported, dispatchWebhook }: Props) {
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Record<number, string>>({}); // csv col index -> column id ('' = skip)
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    const { data, error } = await supabase
      .from("database_rows")
      .select("id, values, created_at, updated_at")
      .eq("database_id", databaseId)
      .order("created_at", { ascending: true });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setExporting(false); return; }

    const headers = ["id", "created_at", ...columns.map(c => c.name)];
    const rows = (data || []).map(r => [
      r.id,
      r.created_at,
      ...columns.map(c => stringifyValue((r.values as any)?.[c.id], c.type)),
    ]);
    const csv = toCsv(headers, rows);
    const date = new Date().toISOString().slice(0, 10);
    const safe = (databaseTitle || "list").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
    downloadCsv(`${safe}-${date}.csv`, csv);
    toast({ title: `Exported ${rows.length} rows` });
    setExporting(false);
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    const p = parseCsv(text);
    setParsed(p);

    // auto-map by case-insensitive name match
    const byName: Record<string, string> = {};
    columns.forEach(c => { byName[c.name.toLowerCase().trim()] = c.id; });
    const m: Record<number, string> = {};
    p.headers.forEach((h, i) => {
      const id = byName[(h || "").toLowerCase().trim()];
      m[i] = id || "";
    });
    setMapping(m);
  };

  const runImport = async () => {
    if (!parsed) return;
    setImporting(true);
    const colTypeById: Record<string, string> = Object.fromEntries(columns.map(c => [c.id, c.type]));
    const records = parsed.rows.map(r => {
      const values: Record<string, any> = {};
      Object.entries(mapping).forEach(([idxStr, colId]) => {
        if (!colId) return;
        const idx = Number(idxStr);
        const raw = r[idx] ?? "";
        values[colId] = parseValue(raw, colTypeById[colId]);
      });
      return { database_id: databaseId, values };
    });

    let ok = 0, fail = 0;
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const slice = records.slice(i, i + batchSize);
      const { data, error } = await supabase.from("database_rows").insert(slice).select("id, values, created_at");
      if (error) { fail += slice.length; }
      else {
        ok += data?.length || 0;
        if (dispatchWebhook) data?.forEach(row => dispatchWebhook("row.created", row));
      }
    }
    setImporting(false);
    setParsed(null);
    setMapping({});
    onImported();
    toast({
      title: fail === 0 ? `Imported ${ok} rows` : `Imported ${ok}, failed ${fail}`,
      variant: fail === 0 ? "default" : "destructive",
    });
  };

  return (
    <div className="space-y-6">
      {/* EXPORT */}
      <div className="space-y-2">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <Download className="h-4 w-4" /> Export
        </div>
        <p className="text-[11px] text-muted-foreground">
          Download all rows as a CSV file. Opens in Excel, Google Sheets, or Numbers.
        </p>
        <Button size="sm" onClick={exportCsv} disabled={exporting}>
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
          {exporting ? "Preparing..." : "Download CSV"}
        </Button>
      </div>

      <div className="border-t border-border/30" />

      {/* IMPORT */}
      <div className="space-y-2">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <Upload className="h-4 w-4" /> Import
        </div>
        <p className="text-[11px] text-muted-foreground">
          Upload a CSV file. The first row should contain column headers. We'll auto-map columns by name; you can change them before importing.
        </p>

        {!parsed && (
          <div>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }}
            />
            <Button size="sm" variant="outline" asChild>
              <label htmlFor="csv-file-input" className="cursor-pointer">
                <Upload className="h-3.5 w-3.5 mr-1" /> Choose CSV file
              </label>
            </Button>
          </div>
        )}

        {parsed && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary">{parsed.rows.length} rows</Badge>
              <Badge variant="secondary">{parsed.headers.length} columns</Badge>
              <Button variant="ghost" size="sm" onClick={() => { setParsed(null); setMapping({}); }}>Cancel</Button>
            </div>

            <div className="border border-border/40 rounded-md">
              <div className="px-3 py-2 text-[11px] font-medium border-b border-border/30 bg-muted/30">
                Column mapping
              </div>
              <div className="divide-y divide-border/30">
                {parsed.headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <div className="text-xs font-mono text-muted-foreground flex-1 min-w-0 truncate">
                      {h || `column ${i + 1}`}
                    </div>
                    <span className="text-[11px] text-muted-foreground">→</span>
                    <select
                      value={mapping[i] || ""}
                      onChange={(e) => setMapping(prev => ({ ...prev, [i]: e.target.value }))}
                      className="h-7 text-xs rounded-md border border-border/40 bg-background px-2"
                    >
                      <option value="">Skip</option>
                      {columns.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {parsed.rows.length > 0 && (
              <div className="border border-border/40 rounded-md overflow-hidden">
                <div className="px-3 py-2 text-[11px] font-medium border-b border-border/30 bg-muted/30">Preview (first 3 rows)</div>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        {parsed.headers.map((h, i) => (
                          <th key={i} className="text-left px-2 py-1 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 3).map((r, ri) => (
                        <tr key={ri} className="border-b border-border/20">
                          {parsed.headers.map((_, ci) => (
                            <td key={ci} className="px-2 py-1 truncate max-w-[200px]">{r[ci] || ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {Object.values(mapping).every(v => !v) && (
              <div className="flex items-start gap-2 text-[11px] text-amber-600 dark:text-amber-500">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
                Map at least one column to import data.
              </div>
            )}

            <Button
              size="sm"
              onClick={runImport}
              disabled={importing || Object.values(mapping).every(v => !v)}
            >
              {importing ? "Importing..." : `Import ${parsed.rows.length} rows`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
