import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  type OrbitMember, type OrbitChecklistItem, type OrbitStrike, type OrbitPerformance,
  type OrbitTrack, type OrbitStatus,
  TRACK_OPTIONS, STATUS_OPTIONS, STATUS_COLORS, TRACK_COLORS, TRACK_LABEL, STATUS_LABEL,
} from "./orbit-types";
import { AlertTriangle, Plus, Trash2, Loader2, Calendar, BarChart3, ListChecks, FileText, CheckCircle2, UserMinus, Link2, RefreshCw } from "lucide-react";
import { GhlUserPicker } from "./GhlUserPicker";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const sb = supabase as any;

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string | null;
  profile: Profile | null;
  onChanged: () => void;
}

function initials(name: string | null) {
  return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function OrbitMemberDetailDrawer({ open, onOpenChange, memberId, profile, onChanged }: Props) {
  const { user } = useAuth();
  const [member, setMember] = useState<OrbitMember | null>(null);
  const [checklist, setChecklist] = useState<OrbitChecklistItem[]>([]);
  const [strikes, setStrikes] = useState<OrbitStrike[]>([]);
  const [performance, setPerformance] = useState<OrbitPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");

  // Strike dialog state
  const [strikeReason, setStrikeReason] = useState("");
  const [issuingStrike, setIssuingStrike] = useState(false);

  // Performance entry state
  const [newPerfDate, setNewPerfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newPerf, setNewPerf] = useState({ calls_made: 0, appointments_set: 0, conversations: 0, deals_closed: 0 });
  const [savingPerf, setSavingPerf] = useState(false);

  // Permanent delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // GHL sync
  const [syncingGhl, setSyncingGhl] = useState(false);

  const syncFromGhl = async () => {
    if (!memberId) return;
    setSyncingGhl(true);
    try {
      const { data, error } = await sb.functions.invoke("orbit-sync-performance", { body: { memberId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data?.results?.[0];
      if (result?.error) {
        toast.error("Sync failed: " + result.error);
      } else if (result) {
        toast.success(`Synced from GHL — ${result.metrics.deals_closed} deals, ${result.metrics.appointments_set} appts`);
        // Refresh the drawer's data
        const [m, p] = await Promise.all([
          sb.from("orbit_members").select("*").eq("id", memberId).maybeSingle(),
          sb.from("orbit_performance_snapshots").select("*").eq("member_id", memberId).order("snapshot_date", { ascending: false }).limit(12),
        ]);
        if (m.data) setMember(m.data as OrbitMember);
        if (p.data) setPerformance(p.data as OrbitPerformance[]);
      }
    } catch (e: any) {
      toast.error("Sync failed: " + String(e?.message ?? e));
    }
    setSyncingGhl(false);
  };

  useEffect(() => {
    if (!open || !memberId) return;
    setLoading(true);
    (async () => {
      const [m, c, s, p] = await Promise.all([
        sb.from("orbit_members").select("*").eq("id", memberId).maybeSingle(),
        sb.from("orbit_setup_checklist").select("*").eq("member_id", memberId).order("sort_order"),
        sb.from("orbit_strikes").select("*").eq("member_id", memberId).order("strike_number", { ascending: true }),
        sb.from("orbit_performance_snapshots").select("*").eq("member_id", memberId).order("snapshot_date", { ascending: false }).limit(12),
      ]);
      setMember(m.data as OrbitMember | null);
      setChecklist((c.data ?? []) as OrbitChecklistItem[]);
      setStrikes((s.data ?? []) as OrbitStrike[]);
      setPerformance((p.data ?? []) as OrbitPerformance[]);
      setNotes((m.data as any)?.notes || "");
      setLoading(false);
    })();
  }, [open, memberId]);

  if (!member && !loading) return null;

  const daysOnTrack = member ? differenceInDays(new Date(), new Date(member.track_started_at)) : 0;
  const daysLeft = Math.max(0, 90 - daysOnTrack);
  const past90 = daysOnTrack >= 90;
  const doneCount = checklist.filter((c) => c.done).length;
  const strikeCount = strikes.length;
  const shouldPromptRemoval = strikeCount >= 3 && member?.status !== "removed";

  const updateMember = async (updates: Partial<OrbitMember>) => {
    if (!memberId) return;
    setMember((m) => (m ? { ...m, ...updates } : m));
    const { error } = await sb.from("orbit_members").update(updates).eq("id", memberId);
    if (error) toast.error("Failed to update: " + error.message);
    else onChanged();
  };

  const changeTrack = async (track: OrbitTrack) => {
    await updateMember({ track, track_started_at: new Date().toISOString() });
    toast.success(`Track changed to ${TRACK_LABEL[track]}. 90-day clock reset.`);
  };

  const changeStatus = async (status: OrbitStatus) => {
    const update: any = { status };
    if (status === "graduated") update.graduated_at = new Date().toISOString();
    if (status === "removed") update.removed_at = new Date().toISOString();
    await updateMember(update);
  };

  const toggleChecklist = async (item: OrbitChecklistItem) => {
    const next = !item.done;
    setChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, done: next } : c)));
    const update: any = { done: next };
    if (next) {
      update.done_at = new Date().toISOString();
      update.done_by = user?.id || null;
    } else {
      update.done_at = null;
      update.done_by = null;
    }
    await sb.from("orbit_setup_checklist").update(update).eq("id", item.id);
  };

  const issueStrike = async () => {
    if (!memberId || !strikeReason.trim()) return;
    setIssuingStrike(true);
    const next = strikeCount + 1;
    const { data: actorProf } = await sb.from("profiles").select("full_name").eq("user_id", user?.id).maybeSingle();
    const { data, error } = await sb.from("orbit_strikes").insert({
      member_id: memberId,
      strike_number: next,
      issued_by: user?.id,
      issued_by_name: (actorProf as any)?.full_name || null,
      reason: strikeReason.trim(),
    }).select().maybeSingle();
    setIssuingStrike(false);
    if (error) { toast.error("Failed to issue strike: " + error.message); return; }
    if (data) {
      setStrikes((prev) => [...prev, data as OrbitStrike]);
      setStrikeReason("");
      if (next === 2 && member?.status === "active") {
        await changeStatus("on_notice");
        toast.success("Strike 2 issued — status moved to On Notice");
      } else {
        toast.success(`Strike ${next} issued`);
      }
    }
  };

  const removeStrike = async (id: string) => {
    await sb.from("orbit_strikes").delete().eq("id", id);
    setStrikes((prev) => prev.filter((s) => s.id !== id));
    toast.success("Strike removed");
  };

  const savePerf = async () => {
    if (!memberId) return;
    setSavingPerf(true);
    const { data, error } = await sb.from("orbit_performance_snapshots").upsert({
      member_id: memberId,
      snapshot_date: newPerfDate,
      ...newPerf,
      source: "manual",
    }, { onConflict: "member_id,snapshot_date" }).select().maybeSingle();
    setSavingPerf(false);
    if (error) { toast.error("Failed: " + error.message); return; }
    if (data) {
      setPerformance((prev) => {
        const filtered = prev.filter((p) => p.snapshot_date !== newPerfDate);
        return [data as OrbitPerformance, ...filtered].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
      });
      setNewPerf({ calls_made: 0, appointments_set: 0, conversations: 0, deals_closed: 0 });
      toast.success("Performance saved");
    }
  };

  const saveNotes = async () => {
    if (!memberId) return;
    await updateMember({ notes });
    toast.success("Notes saved");
  };

  const deleteMember = async () => {
    if (!memberId) return;
    setDeleting(true);
    const { error } = await sb.from("orbit_members").delete().eq("id", memberId);
    setDeleting(false);
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success("Member removed from program");
    onChanged();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : member ? (
          <>
            <SheetHeader className="px-5 py-4 border-b border-border">
              <SheetTitle className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                  <AvatarFallback>{initials(profile?.full_name || null)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold truncate">{profile?.full_name || "Unknown"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className={`text-[10px] ${TRACK_COLORS[member.track]}`}>{TRACK_LABEL[member.track]}</Badge>
                    <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[member.status]}`}>{STATUS_LABEL[member.status]}</Badge>
                    <span className={`text-[10px] ${past90 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                      Day {daysOnTrack} of 90{past90 && " · review"}
                    </span>
                  </div>
                </div>
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* Strike 3 prompt */}
              {shouldPromptRemoval && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">3 strikes issued</p>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">Time to make a call on this member.</p>
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => changeStatus("removed")}>
                      Mark as removed
                    </Button>
                  </div>
                </div>
              )}

              {/* Track + Status pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Track</p>
                  <Select value={member.track} onValueChange={(v) => changeTrack(v as OrbitTrack)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{TRACK_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
                  <Select value={member.status} onValueChange={(v) => changeStatus(v as OrbitStatus)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* GHL Link */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3 w-3 text-muted-foreground" />
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">GHL account</p>
                  <div className="ml-auto flex items-center gap-2">
                    {member.ghl_synced_at && (
                      <span className="text-[10px] text-muted-foreground/50">
                        synced {format(new Date(member.ghl_synced_at), "MMM d, h:mm a")}
                      </span>
                    )}
                    {member.ghl_user_id && (
                      <button
                        onClick={syncFromGhl}
                        disabled={syncingGhl}
                        className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 disabled:opacity-50"
                      >
                        {syncingGhl ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                        Sync now
                      </button>
                    )}
                  </div>
                </div>
                <GhlUserPicker
                  currentGhlUserId={member.ghl_user_id}
                  onChange={(ghlUserId) => updateMember({ ghl_user_id: ghlUserId } as any)}
                  compact
                />
                <p className="text-[10px] text-muted-foreground/70">
                  Required to auto-sync appts and deals from GHL. Calls + conversations still need manual entry for now.
                </p>
              </div>

              {/* Setup checklist */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <ListChecks className="h-3 w-3" /> Setup Checklist
                  </h3>
                  <span className="text-[10px] text-muted-foreground">{doneCount}/{checklist.length}</span>
                </div>
                <div className="space-y-1.5">
                  {checklist.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleChecklist(item)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/40 text-left transition-colors"
                    >
                      <Checkbox checked={item.done} className="pointer-events-none" />
                      <span className={cn("text-sm flex-1", item.done && "line-through text-muted-foreground/60")}>{item.label}</span>
                      {item.done && item.done_at && (
                        <span className="text-[10px] text-muted-foreground/60">{format(new Date(item.done_at), "MMM d")}</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* Strikes */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" /> Strikes <span className="text-muted-foreground/40">· {strikeCount}/3</span>
                </h3>
                {strikes.length > 0 && (
                  <div className="space-y-1.5">
                    {strikes.map((s) => (
                      <div key={s.id} className="group flex items-start gap-2 px-2.5 py-2 rounded-md border border-border/40 bg-card/60">
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px] shrink-0">#{s.strike_number}</Badge>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-xs text-foreground">{s.reason}</p>
                          <p className="text-[10px] text-muted-foreground/70">
                            {s.issued_by_name || "Admin"} · {format(new Date(s.issued_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <button
                          onClick={() => removeStrike(s.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all"
                          title="Remove strike"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {strikeCount < 3 && (
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      value={strikeReason}
                      onChange={(e) => setStrikeReason(e.target.value)}
                      placeholder={`Strike ${strikeCount + 1} reason…`}
                      className="h-8 text-xs flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter" && strikeReason.trim()) issueStrike(); }}
                    />
                    <Button size="sm" variant="outline" disabled={!strikeReason.trim() || issuingStrike} onClick={issueStrike} className="h-8 gap-1.5">
                      {issuingStrike ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Issue
                    </Button>
                  </div>
                )}
              </section>

              {/* Performance (manual entry) */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3" /> Performance
                  <span className="text-muted-foreground/40 normal-case tracking-normal">· manual entry (GHL integration coming)</span>
                </h3>
                <div className="rounded-lg border border-border/40 bg-card/60 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Week of</p>
                      <Input type="date" value={newPerfDate} onChange={(e) => setNewPerfDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Calls made</p>
                      <Input type="number" value={newPerf.calls_made} onChange={(e) => setNewPerf({ ...newPerf, calls_made: parseInt(e.target.value) || 0 })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Appts set</p>
                      <Input type="number" value={newPerf.appointments_set} onChange={(e) => setNewPerf({ ...newPerf, appointments_set: parseInt(e.target.value) || 0 })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Conversations</p>
                      <Input type="number" value={newPerf.conversations} onChange={(e) => setNewPerf({ ...newPerf, conversations: parseInt(e.target.value) || 0 })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Deals closed</p>
                      <Input type="number" value={newPerf.deals_closed} onChange={(e) => setNewPerf({ ...newPerf, deals_closed: parseInt(e.target.value) || 0 })} className="h-8 text-xs" />
                    </div>
                  </div>
                  <Button size="sm" onClick={savePerf} disabled={savingPerf} className="w-full gap-1.5">
                    {savingPerf ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Save week
                  </Button>
                </div>
                {performance.length > 0 && (
                  <div className="space-y-1 pt-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Recent weeks</p>
                    <div className="space-y-1">
                      {performance.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-muted/40">
                          <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-medium w-20">{format(new Date(p.snapshot_date), "MMM d")}</span>
                          <span className="text-muted-foreground">{p.calls_made} calls</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{p.appointments_set} appts</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{p.conversations} conv</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{p.deals_closed} closed</span>
                          {p.source === "ghl" && (
                            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-emerald-100/80 text-emerald-700 font-medium">⚡ GHL</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Admin notes */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> Admin notes
                </h3>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Internal notes about this member…"
                  className="text-xs min-h-[80px]"
                />
              </section>

              {/* Danger zone — permanent remove */}
              <section className="space-y-2 pt-4 border-t border-destructive/20">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-destructive/80 flex items-center gap-1.5">
                  <UserMinus className="h-3 w-3" /> Remove from program
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  This deletes the member's roster record, checklist, strikes, and performance history. Use <strong>Status → Removed</strong> if you want to keep their history instead.
                </p>
                {!confirmDelete ? (
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)} className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5">
                    <UserMinus className="h-3 w-3" /> Permanently remove
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="destructive" onClick={deleteMember} disabled={deleting} className="gap-1.5">
                      {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Yes, delete everything
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                )}
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
