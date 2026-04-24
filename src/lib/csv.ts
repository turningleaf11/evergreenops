// Tiny dependency-free CSV utilities for list import/export.

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(r.map(esc).join(","));
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Parse a CSV string to { headers, rows }. Handles quotes, commas, escaped quotes, CRLF.
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const t = text.replace(/^\uFEFF/, "");
  while (i < t.length) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(cell); cell = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(cell); out.push(row); row = []; cell = ""; i++; continue; }
    cell += c; i++;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); out.push(row); }
  const headers = (out.shift() || []).map(h => h.trim());
  // drop trailing empty rows
  const rows = out.filter(r => r.some(v => (v ?? "").length > 0));
  return { headers, rows };
}

// Convert a list-row value of a given column type into a CSV-friendly string.
export function stringifyValue(v: any, type?: string): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join("; ");
  if (type === "checkbox") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Convert a CSV string into a typed value for inserting into database_rows.values.
export function parseValue(raw: string, type?: string): any {
  const s = (raw ?? "").trim();
  if (s === "") return "";
  switch (type) {
    case "number": {
      const n = Number(s.replace(/,/g, ""));
      return Number.isFinite(n) ? n : s;
    }
    case "checkbox":
      return /^(true|yes|1|y)$/i.test(s);
    case "multi-select":
    case "multi_select":
    case "tags":
      return s.split(/[;,]/).map(x => x.trim()).filter(Boolean);
    default:
      return s;
  }
}
