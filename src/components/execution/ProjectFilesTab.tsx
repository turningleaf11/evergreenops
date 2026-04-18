import { FileText, Upload, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { openStoredFile, uploadFileWithPath } from "@/lib/file-upload";
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
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadFileWithPath(file);
        if (!uploaded) {
          toast({ title: "Upload failed", description: file.name, variant: "destructive" });
          continue;
        }

        const content = `<p><a href="${uploaded.publicUrl}" data-file-path="${uploaded.path}" target="_blank" rel="noopener noreferrer">${file.name}</a></p>${
          isImage(file.name) ? `<p><img src="${uploaded.publicUrl}" alt="${file.name}" /></p>` : ""
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
        <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
        <p className="mb-3 text-sm text-muted-foreground">
          Drag & drop files here, or
        </p>
        <Button size="sm" variant="outline" onClick={pickFiles} disabled={uploading}>
          {uploading ? "Uploading…" : "Choose files"}
        </Button>
      </div>

      {linkedDocs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No files yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {linkedDocs.map((doc) => {
            const match = typeof doc.content === "string" ? doc.content.match(/href="([^"]+)"/) : null;
            const fileUrl = match?.[1];

            return (
              <button
                key={doc.id}
                onClick={async () => {
                  if (!fileUrl) {
                    toast({ title: "File unavailable", variant: "destructive" });
                    return;
                  }

                  try {
                    await openStoredFile(fileUrl, { fileName: doc.title });
                  } catch (error) {
                    toast({
                      title: "Could not open file",
                      description: error instanceof Error ? error.message : "Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
                className="rounded-xl border border-border/50 bg-card/40 p-4 text-left transition-colors hover:bg-card/70"
              >
                {isImage(doc.title) ? (
                  <ImageIcon className="mb-2 h-5 w-5 text-muted-foreground" />
                ) : (
                  <FileText className="mb-2 h-5 w-5 text-muted-foreground" />
                )}
                <p className="truncate text-sm font-medium">{doc.title}</p>
                {doc.updated_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(doc.updated_at), "MMM d, yyyy")}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
