import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Trash2, Plus, ExternalLink, Briefcase, TrendingUp, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Market {
  id: string;
  name: string;
  location: string | null;
  strategy: string | null;
  criteria: string | null;
  notes_html: string | null;
  links: { label: string; url: string }[];
}

interface Analysis {
  id: string;
  ai_analysis: any;
  status: string;
  created_at: string;
  custom_criteria: string | null;
}

interface Props {
  marketId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

export function MarketWorkspace({ marketId, open, onOpenChange, onChanged }: Props) {
  const { user } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const load = useCallback(async () => {
    if (!marketId) return;
    setLoading(true);
    const [{ data: m }, { data: a }] = await Promise.all([
      supabase.from("markets").select("*").eq("id", marketId).maybeSingle(),
      supabase.from("market_research").select("id, ai_analysis, status, created_at, custom_criteria").eq("market_id", marketId).order("created_at", { ascending: false }),
    ]);
    if (m) setMarket({ ...(m as any), links: ((m as any).links || []) });
    if (a) setAnalyses(a as Analysis[]);
    setLoading(false);
  }, [marketId]);

  useEffect(() => { if (open && marketId) load(); }, [open, marketId, load]);

  const saveField = async (patch: Partial<Market>) => {
    if (!market) return;
    setMarket((m) => (m ? { ...m, ...patch } : m));
    const { error } = await supabase.from("markets").update(patch as any).eq("id", market.id);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    onChanged();
  };

  // Debounced auto-save for free-text fields (notes/criteria/strategy/location/name)
  // so changes persist even if the sheet closes before blur fires.
  useEffect(() => {
    if (!market) return;
    const t = setTimeout(() => {
      supabase.from("markets").update({
        name: market.name,
        location: market.location,
        strategy: market.strategy,
        criteria: market.criteria,
        notes_html: market.notes_html,
      } as any).eq("id", market.id).then(({ error }) => {
        if (error) toast.error(`Auto-save failed: ${error.message}`);
      });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market?.name, market?.location, market?.strategy, market?.criteria, market?.notes_html]);

  const addLink = async () => {
    if (!market || !linkUrl.trim()) return;
    const links = [...(market.links || []), { label: linkLabel.trim() || linkUrl.trim(), url: linkUrl.trim() }];
    setLinkLabel(""); setLinkUrl("");
    await saveField({ links });
  };

  const removeLink = async (i: number) => {
    if (!market) return;
    const links = market.links.filter((_, idx) => idx !== i);
    await saveField({ links });
  };

  const runAnalysis = async () => {
    if (!market || !user) return;
    setAnalyzing(true);
    try {
      const { data: rec, error: insErr } = await supabase.from("market_research").insert({
        market_name: market.name,
        strategy: market.strategy || "buy_and_hold",
        custom_criteria: market.criteria || null,
        status: "analyzing",
        created_by: user.id,
        market_id: market.id,
      } as any).select().single();
      if (insErr) throw insErr;

      const { error } = await supabase.functions.invoke("market-research", {
        body: {
          market: market.location || market.name,
          strategy: market.strategy || "buy_and_hold",
          customCriteria: market.criteria || "",
          recordId: (rec as any).id,
          marketId: market.id,
        },
      });
      if (error) throw error;
      toast.success("Analysis complete");
      load();
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const deleteMarket = async () => {
    if (!market || !confirm(`Delete "${market.name}" and all its analyses?`)) return;
    await supabase.from("markets").delete().eq("id", market.id);
    onOpenChange(false);
    onChanged();
  };

  const latest = analyses[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {loading || !market ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    value={market.name}
                    onChange={(e) => setMarket({ ...market, name: e.target.value })}
                    onBlur={(e) => saveField({ name: e.target.value })}
                    className="text-lg font-semibold border-0 px-0 h-auto focus-visible:ring-0 shadow-none"
                  />
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <Input
                      value={market.location || ""}
                      onChange={(e) => setMarket({ ...market, location: e.target.value })}
                      onBlur={(e) => saveField({ location: e.target.value })}
                      placeholder="Location"
                      className="border-0 px-0 h-6 text-xs focus-visible:ring-0 shadow-none"
                    />
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={deleteMarket} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <SheetTitle className="sr-only">{market.name}</SheetTitle>
            </SheetHeader>

            <Tabs defaultValue="overview" className="mt-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="ai">AI Analysis {analyses.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{analyses.length}</Badge>}</TabsTrigger>
                <TabsTrigger value="links">Links</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div>
                  <label className="text-xs text-muted-foreground">Strategy</label>
                  <Input
                    value={market.strategy || ""}
                    onChange={(e) => setMarket({ ...market, strategy: e.target.value })}
                    onBlur={(e) => saveField({ strategy: e.target.value })}
                    placeholder="e.g. buy_and_hold, brrrr, fix_and_flip"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Criteria</label>
                  <Textarea
                    value={market.criteria || ""}
                    onChange={(e) => setMarket({ ...market, criteria: e.target.value })}
                    onBlur={(e) => saveField({ criteria: e.target.value })}
                    placeholder="Budget, target returns, property types…"
                    className="min-h-[70px]"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <Textarea
                    value={market.notes_html || ""}
                    onChange={(e) => setMarket({ ...market, notes_html: e.target.value })}
                    onBlur={(e) => saveField({ notes_html: e.target.value })}
                    placeholder="Free-form notes about this market…"
                    className="min-h-[160px]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4 mt-4">
                <Button onClick={runAnalysis} disabled={analyzing} className="gap-2">
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Run new analysis
                </Button>

                {latest?.ai_analysis ? <AnalysisView analysis={latest.ai_analysis} /> : (
                  <p className="text-sm text-muted-foreground italic">No analyses yet. Run one to get an AI-powered market breakdown.</p>
                )}

                {analyses.length > 1 && (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="past">
                      <AccordionTrigger className="text-xs text-muted-foreground">Past analyses ({analyses.length - 1})</AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        {analyses.slice(1).map((a) => (
                          <div key={a.id} className="rounded-lg border bg-card p-3">
                            <p className="text-[10px] text-muted-foreground mb-2">{new Date(a.created_at).toLocaleString()}</p>
                            <AnalysisView analysis={a.ai_analysis} compact />
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </TabsContent>

              <TabsContent value="links" className="space-y-3 mt-4">
                <div className="flex gap-2">
                  <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label (optional)" className="flex-1" />
                  <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="flex-[2]" />
                  <Button size="icon" onClick={addLink}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-1.5">
                  {market.links.length === 0 && <p className="text-sm text-muted-foreground italic">No links yet.</p>}
                  {market.links.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 group">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-sm hover:text-primary truncate">{l.label}</a>
                      <button onClick={() => removeLink(i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AnalysisView({ analysis, compact }: { analysis: any; compact?: boolean }) {
  if (!analysis) return null;
  return (
    <div className="space-y-3">
      {analysis.summary && <p className="text-sm text-foreground/90 whitespace-pre-wrap">{analysis.summary}</p>}
      {analysis.key_metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(analysis.key_metrics).map(([k, v]) => (
            <div key={k} className="rounded-md bg-muted/50 p-2 text-center">
              <p className="text-[10px] text-muted-foreground capitalize">{k.replace(/_/g, " ")}</p>
              <p className="text-sm font-semibold mt-0.5">{String(v)}</p>
            </div>
          ))}
        </div>
      )}
      {analysis.industries && (
        <div>
          <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><Briefcase className="h-3 w-3" /> Industries</p>
          <div className="flex flex-wrap gap-1">
            {(analysis.industries as string[]).map((i) => <Badge key={i} variant="secondary" className="text-[10px]">{i}</Badge>)}
          </div>
        </div>
      )}
      {analysis.recommendation && !compact && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-medium flex items-center gap-1.5 mb-1"><TrendingUp className="h-3 w-3 text-primary" /> Recommendation</p>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{analysis.recommendation}</p>
        </div>
      )}
      {analysis.risks && !compact && (
        <div>
          <p className="text-xs font-medium mb-1">Risks</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysis.risks}</p>
        </div>
      )}
    </div>
  );
}
