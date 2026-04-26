import { useEffect, useState, useCallback } from "react";
import { Upload, FileText, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFileWithPath, openStoredFile, getStoragePathFromUrl } from "@/lib/file-upload";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeadFile {
  id: string;
  name: string;
  url: string;
  storage_path: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  kind: string;
  created_at: string;
  uploaded_by: string | null;
}

const KIND_OPTIONS = [
  { value: "om", label: "OM" },
  { value: "t12", label: "T12" },
  { value: "rent_roll", label: "Rent Roll" },
  { value: "photo", label: "Photo" },
  { value: "other", label: "Other" },
];

const isImage = (m: string | null, n: string) =>
  (m && m.startsWith("image/")) || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(n);

function guessKind(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("om") || n.includes("offering")) return "om";
  if (n.includes("t12") || n.includes("t-12")) return "t12";
  if (n.includes("rent") && n.includes("roll")) return "rent_roll";
  if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(n)) return "photo";
  return "other";
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function LeadFilesTab({
  leadId,
  workspaceId,
  onDocsUpdated,
}: {
  leadId: string;
  workspaceId: string | null;
  onDocsUpdated?: (patch: { has_om?: boolean; has_t12?: boolean; has_rent_roll?: boolean }) => void;
}) {
  const { user } = useAuth();
  const [files, setFiles] = useState<LeadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lead_files")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setFiles((data as LeadFile[]) || []);
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleFiles = async (fileList: FileList | File[]) => {
    if (!user) return;
    setUploading(true);
    const patch: { has_om?: boolean; has_t12?: boolean; has_rent_roll?: boolean } = {};
    try {
      for (const file of Array.from(fileList)) {
        const uploaded = await uploadFileWithPath(file);
        if (!uploaded) {
          toast({ title: "Upload failed", description: file.name, variant: "destructive" });
          continue;
        }
        const kind = guessKind(file.name);
        const { error } = await supabase.from("lead_files").insert({
          lead_id: leadId,
          workspace_id: workspaceId,
          uploaded_by: user.id,
          name: file.name,
          url: uploaded.publicUrl,
          storage_path: uploaded.path,
          size_bytes: file.size,
          mime_type: file.type || null,
          kind,
        });
        if (error) {
          toast({ title: "Save failed", description: error.message, variant: "destructive" });
          continue;
        }
        if (kind === "om") patch.has_om = true;
        if (kind === "t12") patch.has_t12 = true;
        if (kind === "rent_roll") patch.has_rent_roll = true;
      }
      await reload();
      if (Object.keys(patch).length && onDocsUpdated) onDocsUpdated(patch);
    } finally {
      setUploading(false);
    }
  };

  const pickFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => input.files && handleFiles(input.files);
    input.click();
  };

  const updateKind = async (id: string, kind: string) => {
    setFiles((arr) => arr.map((f) => (f.id === id ? { ...f, kind } : f)));
    await supabase.from("lead_files").update({ kind }).eq("id", id);
  };

  const removeFile = async (f: LeadFile) => {
    if (!confirm(`Remove "${f.name}"?`)) return;
    await supabase.from("lead_files").delete().eq("id", f.id);
    if (f.storage_path) {
      await supabase.storage.from("files").remove([f.storage_path]);
    } else {
      const path = getStoragePathFromUrl(f.url);
      if (path) await supabase.storage.from("files").remove([path]);
    }
    setFiles((arr) => arr.filter((x) => x.id !== f.id));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border border-dashed p-6 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border/60",
        )}
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          Drop OMs, T12s, rent rolls, or photos here
        </p>
        <Button size="sm" variant="outline" onClick={pickFiles} disabled={uploading}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
          Choose files
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-xs text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Loading…
        </div>
      ) : files.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-4">
          No files attached yet.
        </p>
      ) : (
        <ul className="divide-y divide-border/40 rounded-xl border border-border/50 overflow-hidden bg-card">
          {files.map((f) => {
            const Icon = isImage(f.mime_type, f.name) ? ImageIcon : FileText;
            return (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <button
                  onClick={() =>
                    openStoredFile(f.url, { fileName: f.name, mimeType: f.mime_type ?? undefined })
                  }
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtSize(f.size_bytes)}
                    {f.size_bytes ? " · " : ""}
                    {format(new Date(f.created_at), "MMM d, yyyy")}
                  </div>
                </button>
                <Select value={f.kind} onValueChange={(v) => updateKind(f.id, v)}>
                  <SelectTrigger className="h-7 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => removeFile(f)}
                  className="text-muted-foreground hover:text-destructive p-1 rounded"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
