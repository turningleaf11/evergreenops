import {
  FileText, Upload, Image as ImageIcon, FileSpreadsheet, FileType2,
  Trash2, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { openStoredFile } from "@/lib/file-upload";
import EmptyState from "@/components/shared/EmptyState";

const FILES_BUCKET = "files";

interface Attachment {
  id: string;
  file_name: string;
  storage_path: string;
  public_url: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface Props {
  attachments: Attachment[];
  projectId: string;
  onChanged: () => void;
}

function fileIcon(fileName: string, mimeType?: string | null) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (/^(png|jpe?g|gif|webp|svg|bmp)$/.test(ext) || mimeType?.startsWith("image/"))
    return <ImageIcon className="h-5 w-5 text-blue-500 dark:text-blue-400 shrink-0" />;
  if (/^(csv|xlsx?|ods)$/.test(ext) || mimeType?.includes("spreadsheet") || mimeType?.includes("csv"))
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  if (/^pdf$/.test(ext) || mimeType === "application/pdf")
    return <FileType2 className="h-5 w-5 text-destructive shrink-0" />;
  return <FileText className="h-5 w-5 text-muted-foreground shrink-0" />;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectFilesTab({ attachments, projectId, onChanged }: Props) {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!user || !workspace.id) return;
    const workspaceId = workspace.id;
    setUploading(true);
    let succeeded = 0;
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "bin";
        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const path = `projects/${projectId}/${uniqueId}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(FILES_BUCKET)
          .upload(path, file);

        if (uploadError) {
          toast.error(`Failed to upload ${file.name}: ${uploadError.message}`);
          continue;
        }

        const { data: urlData } = supabase.storage.from(FILES_BUCKET).getPublicUrl(path);

        const { error: insertError } = await supabase
          .from("project_attachments")
          .insert({
            project_id: projectId,
            workspace_id: workspaceId,
            file_name: file.name,
            storage_path: path,
            public_url: urlData.publicUrl,
            file_size: file.size,
            mime_type: file.type || null,
            uploaded_by: user.id,
          });

        if (insertError) {
          toast.error(`DB error for ${file.name}: ${insertError.message}`);
          await supabase.storage.from(FILES_BUCKET).remove([path]);
        } else {
          succeeded++;
        }
      }

      if (succeeded > 0) {
        onChanged();
        toast.success(succeeded === 1 ? "File uploaded" : `${succeeded} files uploaded`);
      }
    } finally {
      setUploading(false);
    }
  }, [user, workspace.id, projectId, onChanged]);

  const handleDelete = async (attachment: Attachment) => {
    setDeletingId(attachment.id);
    try {
      await supabase.storage.from(FILES_BUCKET).remove([attachment.storage_path]);
      const { error } = await supabase
        .from("project_attachments")
        .delete()
        .eq("id", attachment.id);
      if (error) { toast.error(error.message); return; }
      toast.success("File deleted");
      onChanged();
    } finally {
      setDeletingId(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const pickFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.csv,.xlsx,.xls,.ods,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.doc,.docx,.ppt,.pptx,.txt";
    input.onchange = () => input.files && handleFiles(input.files);
    input.click();
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-2xl border border-dashed p-8 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border/60",
        )}
      >
        <Upload className="mx-auto mb-3 h-7 w-7 text-muted-foreground/50" />
        <p className="mb-1 text-sm font-medium">Drop files here</p>
        <p className="mb-4 text-xs text-muted-foreground">
          PDF, CSV, Excel, images and more
        </p>
        <Button size="sm" variant="outline" onClick={pickFiles} disabled={uploading}>
          {uploading ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
          ) : (
            "Choose files"
          )}
        </Button>
      </div>

      {attachments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No attachments yet"
          description="Upload PDFs, spreadsheets, or images to keep everything in one place."
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group relative flex items-start gap-3 rounded-xl border border-border/50 bg-card/40 p-4 hover:bg-card/70 transition-colors"
            >
              <button
                className="flex items-start gap-3 flex-1 min-w-0 text-left"
                onClick={() => openStoredFile(att.public_url, { fileName: att.file_name, mimeType: att.mime_type ?? undefined })}
              >
                <div className="mt-0.5">
                  {fileIcon(att.file_name, att.mime_type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">{att.file_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {att.created_at && format(new Date(att.created_at), "MMM d, yyyy")}
                    {att.file_size ? ` · ${formatBytes(att.file_size)}` : ""}
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleDelete(att)}
                disabled={deletingId === att.id}
                className="shrink-0 p-1 rounded-md text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                title="Delete file"
              >
                {deletingId === att.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
