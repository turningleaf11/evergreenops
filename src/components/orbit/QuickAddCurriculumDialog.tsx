import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TRACK_OPTIONS, type OrbitTrack } from "./orbit-types";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const sb = supabase as any;

const TYPE_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "sop", label: "SOP", icon: "📋" },
  { value: "script", label: "Script", icon: "💬" },
  { value: "playbook", label: "Playbook", icon: "🎯" },
  { value: "training", label: "Training", icon: "🎓" },
  { value: "resource", label: "Resource", icon: "📚" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  onCreated: () => void;
}

export function QuickAddCurriculumDialog({ open, onOpenChange, departmentId, onCreated }: Props) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("sop");
  const [track, setTrack] = useState<OrbitTrack | "all">("all");
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setTitle("");
    setDocType("sop");
    setTrack("all");
  };

  const handleCreate = async () => {
    const t = title.trim();
    if (!t || !user) return;
    setCreating(true);
    const tags = [docType];
    if (track !== "all") tags.push(`track:${track}`);

    const { data, error } = await sb.from("documents").insert({
      title: t,
      content: "",
      visibility: "departments",
      shared_with: { departmentIds: [departmentId], memberIds: [] },
      author_id: user.id,
      author_name: profile?.full_name || null,
      tags,
    }).select("id").maybeSingle();

    setCreating(false);
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success("Curriculum item created");
    reset();
    onOpenChange(false);
    onCreated();
    if (data?.id) navigate(`/docs?doc=${data.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-primary" />
            Add to curriculum
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cold call objection sequence"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) handleCreate(); }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Type</label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="mr-1.5">{t.icon}</span>{t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Track</label>
              <Select value={track} onValueChange={(v) => setTrack(v as OrbitTrack | "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tracks</SelectItem>
                  {TRACK_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/70">
            Creates a new doc pre-tagged for this program{track !== "all" ? ` and the ${TRACK_OPTIONS.find((t) => t.value === track)?.label} track` : ""}. You'll write the content in the Wiki.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!title.trim() || creating} className="gap-1.5">
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create & open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
