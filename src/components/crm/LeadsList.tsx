import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Inbox,
  Plus,
  Mail,
  Phone,
  Building2,
  Clock,
  Archive,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { NewLeadDialog } from "./NewLeadDialog";
import { ConvertLeadDialog } from "./ConvertLeadDialog";
import { FollowUpPicker, TEMPERATURE_META } from "./FollowUpPicker";
import { LeadPeekSheet } from "./LeadPeekSheet";

interface Lead {
  id: string;
  workspace_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  title: string | null;
  source: string | null;
  temperature: string;
  status: string;
  next_action_at: string | null;
  notes: string;
  owner_id: string | null;
  created_at: string;
}

const TEMPS: Array<"cold" | "warm" | "hot"> = ["cold", "warm", "hot"];

export function LeadsList({ search }: { search: string }) {
  const { user } = useAuth();
  const { id: workspaceId } = useWorkspace();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [tempFilter, setTempFilter] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!active) return;
      setLeads((data as Lead[]) || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (!showArchived && (l.status === "archived" || l.status === "converted")) return false;
      if (tempFilter.size > 0 && !tempFilter.has(l.temperature)) return false;
      if (q) {
        const blob = `${l.name} ${l.email ?? ""} ${l.company_name ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, tempFilter, showArchived]);

  const counts = useMemo(() => {
    const open = leads.filter((l) => l.status !== "archived" && l.status !== "converted");
    return {
      total: open.length,
      hot: open.filter((l) => l.temperature === "hot").length,
      warm: open.filter((l) => l.temperature === "warm").length,
      cold: open.filter((l) => l.temperature === "cold").length,
    };
  }, [leads]);

  const updateLead = async (id: string, patch: Partial<Lead>) => {
    setLeads((arr) => arr.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await supabase.from("leads").update(patch as any).eq("id", id);
    if (error) {
      toast({ title: "Couldn't update lead", description: error.message, variant: "destructive" });
      setRefreshKey((k) => k + 1);
    }
  };

  const cycleTemp = (lead: Lead) => {
    const idx = TEMPS.indexOf(lead.temperature as any);
    const next = TEMPS[(idx + 1) % TEMPS.length];
    updateLead(lead.id, { temperature: next });
  };

  const archive = (lead: Lead) => {
    updateLead(lead.id, { status: "archived" });
    toast({ title: "Lead archived" });
  };

  const toggleTempFilter = (t: string) => {
    setTempFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading leads…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Stats + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-4 py-3">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Open</div>
            <div className="font-semibold">{counts.total}</div>
          </div>
          {TEMPS.map((t) => {
            const meta = TEMPERATURE_META[t];
            const active = tempFilter.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleTempFilter(t)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                {meta.label}
                <span className="opacity-60">({counts[t]})</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Hide" : "Show"} archived/converted
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New lead
          </Button>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card py-16 text-center text-sm text-muted-foreground">
          <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="font-medium text-foreground mb-1">No leads to show</p>
          <p>New leads will land here. Click "New lead" to add one.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card divide-y divide-border/40">
          {filtered.map((l) => {
            const meta = TEMPERATURE_META[l.temperature] || TEMPERATURE_META.warm;
            const isConverted = l.status === "converted";
            const isArchived = l.status === "archived";
            return (
              <div key={l.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Temp chip */}
                  <button
                    onClick={() => !isConverted && !isArchived && cycleTemp(l)}
                    disabled={isConverted || isArchived}
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium",
                      meta.bg,
                      meta.fg,
                      !isConverted && !isArchived && "hover:ring-2 hover:ring-offset-1 hover:ring-offset-background hover:ring-current/30 cursor-pointer",
                    )}
                    title="Click to cycle cold → warm → hot"
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                  </button>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{l.name || "Untitled lead"}</span>
                      {l.company_name && (
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {l.company_name}
                        </span>
                      )}
                      {l.source && (
                        <Badge variant="outline" className="text-[10px]">
                          {l.source}
                        </Badge>
                      )}
                      {isConverted && (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Converted
                        </Badge>
                      )}
                      {isArchived && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Archived
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      {l.email && (
                        <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                          <Mail className="h-3 w-3" /> {l.email}
                        </a>
                      )}
                      {l.phone && (
                        <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                          <Phone className="h-3 w-3" /> {l.phone}
                        </a>
                      )}
                      <span>Added {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</span>
                      {l.next_action_at && (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <Clock className="h-3 w-3" /> Next: {format(new Date(l.next_action_at), "MMM d, h:mma")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!isConverted && !isArchived && (
                    <div className="shrink-0 flex items-center gap-1">
                      <FollowUpPicker
                        value={l.next_action_at}
                        onChange={(iso) => updateLead(l.id, { next_action_at: iso })}
                        trigger={
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                            <Clock className="h-3 w-3" /> Follow up
                          </Button>
                        }
                      />
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setConvertLead(l)}
                      >
                        Qualify <ArrowRight className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => archive(l)}
                        title="Archive"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {isConverted && (l as any).converted_deal_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => navigate(`/crm/deals?deal=${(l as any).converted_deal_id}`)}
                    >
                      Open deal
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewLeadDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        workspaceId={workspaceId}
        userId={user?.id ?? null}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      <ConvertLeadDialog
        lead={convertLead}
        open={!!convertLead}
        onOpenChange={(v) => !v && setConvertLead(null)}
        userId={user?.id ?? null}
        onConverted={(dealId) => {
          setConvertLead(null);
          setRefreshKey((k) => k + 1);
          toast({ title: "Lead converted to deal" });
          navigate(`/crm/deals?deal=${dealId}`);
        }}
      />
    </div>
  );
}
