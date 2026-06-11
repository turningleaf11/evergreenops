import { format } from "date-fns";
import { CheckCircle2, Circle, Clock, FileText, Users, Upload } from "lucide-react";
import { useState, useCallback } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/RichTextEditor";
import { uploadFileWithPath } from "@/lib/file-upload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Props {
  project: any;
  tasks: any[];
  linkedDocs: any[];
  profiles: { user_id: string; full_name: string | null; avatar_url?: string | null }[];
  onOpenTab: (tab: string) => void;
  onNotesChange: (html: string) => void;
  onFilesChanged: () => void;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const isImage = (name: string) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);

export default function ProjectOverviewTab({
  project, tasks, linkedDocs, profiles, onOpenTab, onNotesChange, onFilesChanged,
}: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const openTasks = tasks.filter((t) => t.status !== "done");
  const upcoming = [...openTasks]
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
    .slice(0, 3);

  const teamIds = [project.owner_id, ...(project.assignees || [])].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );
  const team = teamIds.map((id) => profiles.find((p) => p.user_id === id)).filter(Boolean) as any[];

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadFileWithPath(file);
        if (!uploaded) continue;
        const content = `<p><a href="${uploaded.publicUrl}" data-file-path="${uploaded.path}" target="_blank" rel="noopener noreferrer">${file.name}</a></p>${
          isImage(file.name) ? `<p><img src="${uploaded.publicUrl}" alt="${file.name}" /></p>` : ""
        }`;
        await supabase.from("documents").insert({
          title: file.name,
          content,
          project_id: project.id,
          author_id: user.id,
          author_name: user.user_metadata?.full_name || user.email || null,
          visibility: "workspace",
        });
      }
      onFilesChanged();
      toast({ title: "Uploaded" });
    } finally {
      setUploading(false);
    }
  }, [user, project.id, onFilesChanged]);

  const pickFiles = (e: React.MouseEvent) => {
    e.stopPropagation();
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => input.files && handleFiles(input.files);
    input.click();
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* LEFT — Notes editor (working surface) */}
      <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
        </div>
        <RichTextEditor
          content={project.notes_content || ""}
          onChange={onNotesChange}
          placeholder="Start writing project notes, plans, context…"
          borderless
        />
      </div>

      {/* RIGHT column */}
      <div className="space-y-4">
        {/* Team */}
        <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team</h3>
          </div>
          {team.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <div className="space-y-2">
              {team.slice(0, 6).map((m) => (
                <div key={m.user_id} className="flex items-center gap-2.5">
                  <UserAvatar name={m.full_name || "U"} avatarUrl={m.avatar_url} className="h-7 w-7" fallbackClassName="bg-muted text-[10px]" />
                  <span className="text-sm truncate flex-1">{m.full_name || "Unknown"}</span>
                  {m.user_id === project.owner_id && (
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wide">Owner</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks summary */}
        <button
          onClick={() => onOpenTab("tasks")}
          className="w-full text-left rounded-2xl border border-border/50 bg-card/40 p-5 hover:bg-card/70 transition-colors"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tasks</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-semibold">{openTasks.length}</span>
            <span className="text-xs text-muted-foreground">open · {tasks.length} total</span>
          </div>
          <div className="space-y-1.5">
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground">All clear.</p>
            ) : (
              upcoming.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  {t.status === "in_progress" ? (
                    <Clock className="h-3 w-3 text-primary/70 shrink-0" />
                  ) : (
                    <Circle className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate flex-1">{t.title}</span>
                  {t.due_date && (
                    <span className="text-muted-foreground shrink-0">
                      {format(new Date(t.due_date + "T00:00:00"), "MMM d")}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </button>

        {/* Files */}
        <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Files ({linkedDocs.length})
              </h3>
            </div>
            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={pickFiles} disabled={uploading}>
              <Upload className="h-3.5 w-3.5" />
              <span className="text-xs">{uploading ? "…" : "Upload"}</span>
            </Button>
          </div>
          {linkedDocs.length === 0 ? (
            <button
              onClick={() => onOpenTab("files")}
              className="w-full text-left text-sm text-muted-foreground hover:text-foreground"
            >
              No files yet — upload or open Files tab.
            </button>
          ) : (
            <div className="space-y-1.5">
              {linkedDocs.slice(0, 5).map((d) => (
                <button
                  key={d.id}
                  onClick={() => onOpenTab("files")}
                  className="block w-full text-left text-sm truncate text-foreground/80 hover:text-foreground"
                >
                  {d.title}
                </button>
              ))}
              {linkedDocs.length > 5 && (
                <button onClick={() => onOpenTab("files")} className="text-xs text-primary mt-1">
                  View all →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
