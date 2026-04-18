import { FileText, Upload, Image as ImageIcon, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/file-upload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  linkedDocs: any[];
  projectId: string;
  onChanged: () => void;
}

const isImage = (name: string) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);

export default function ProjectFilesTab({ linkedDocs, projectId, onChanged }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadFile(file);
        if (!url) {
          toast({ title: "Upload failed", description: file.name, variant: "destructive" });
          continue;
        }
        // Store URL inside content as a simple anchor so the doc preview works.
        const content = `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${file.name}</a></p>${
          isImage(file.name) ? `<p><img src="${url}" alt="${file.name}" /></p>` : ""
        }`;
        const { error } = await supabase.from("documents").insert({
          title: file.name,
          content,
          project_id: projectId,
          author_id: user.id,
          author_name: user.user_metadata?.full_name || user.email || null,
          visibility: "workspace",
        });
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      }
      onChanged();
      toast({ title: "Uploaded" });
    } finally {
      setUploading(false);
    }
  }, [user, projectId, onChanged]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const pickFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
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
          "rounded-2xl border border-dashed p-6 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border/60",
        )}
      >
        <Upload className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-3">
          Drag & drop files here, or
        </p>
        <Button size="sm" variant="outline" onClick={pickFiles} disabled={uploading}>
          {uploading ? "Uploading…" : "Choose files"}
        </Button>
      </div>

      {linkedDocs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No files yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {linkedDocs.map((doc) => {
            const match = typeof doc.content === "string" ? doc.content.match(/href="([^"]+)"/) : null;
            const fileUrl = match?.[1];
            return (
            <button
              key={doc.id}
              onClick={() => {
                if (fileUrl) window.open(fileUrl, "_blank", "noopener,noreferrer");
                else toast({ title: "File unavailable", variant: "destructive" });
              }}
              className="text-left rounded-xl border border-border/50 bg-card/40 p-4 hover:bg-card/70 transition-colors"
            >
              {isImage(doc.title) ? (
                <ImageIcon className="h-5 w-5 text-muted-foreground mb-2" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground mb-2" />
              )}
              <p className="text-sm font-medium truncate">{doc.title}</p>
              {doc.updated_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(doc.updated_at), "MMM d, yyyy")}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
