import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Building, Search, Loader2, MapPin, TrendingUp, Briefcase, ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";

interface MarketResearch {
  id: string;
  market_name: string;
  strategy: string;
  custom_criteria: string | null;
  ai_analysis: any;
  status: string;
  created_at: string;
}

const strategies = [
  { value: "buy_and_hold", label: "Buy & Hold" },
  { value: "brrrr", label: "BRRRR" },
  { value: "fix_and_flip", label: "Fix & Flip" },
  { value: "wholesale", label: "Wholesale" },
  { value: "multifamily", label: "Multifamily" },
  { value: "commercial", label: "Commercial" },
  { value: "short_term_rental", label: "Short-Term Rental" },
  { value: "land", label: "Land Development" },
];

export default function MarketResearchPage() {
  const { user } = useAuth();
  const [researches, setResearches] = useState<MarketResearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [market, setMarket] = useState("");
  const [strategy, setStrategy] = useState("buy_and_hold");
  const [customCriteria, setCustomCriteria] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchResearches = useCallback(async () => {
    const { data } = await supabase.from("market_research").select("*").order("created_at", { ascending: false });
    if (data) setResearches(data as MarketResearch[]);
  }, []);

  useEffect(() => { fetchResearches(); }, [fetchResearches]);

  const runAnalysis = async () => {
    if (!user || !market.trim()) { toast.error("Enter a market name"); return; }
    setLoading(true);
    try {
      const { data: record, error: insertError } = await supabase.from("market_research").insert({
        market_name: market.trim(),
        strategy,
        custom_criteria: customCriteria.trim() || null,
        status: "analyzing",
        created_by: user.id,
      }).select().single();
      if (insertError) throw insertError;

      const { data, error } = await supabase.functions.invoke("market-research", {
        body: { market: market.trim(), strategy, customCriteria: customCriteria.trim(), recordId: (record as any).id },
      });
      if (error) throw error;

      toast.success("Analysis complete!");
      setMarket("");
      setCustomCriteria("");
      fetchResearches();
    } catch (e: any) {
      toast.error(e.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const selected = researches.find(r => r.id === selectedId);
  const analysis = selected?.ai_analysis;

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market Research</h1>
        <p className="text-sm text-muted-foreground">AI-powered real estate market analysis</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Market (City, State or ZIP)</label>
              <Input value={market} onChange={e => setMarket(e.target.value)} placeholder="e.g. Austin, TX or 78701" className="mt-1" />
            </div>
            <div className="w-full sm:w-48">
              <label className="text-xs text-muted-foreground">Investment Strategy</label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {strategies.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Your Strategy & Criteria (optional)</label>
            <Textarea
              value={customCriteria}
              onChange={e => setCustomCriteria(e.target.value)}
              placeholder="Describe your exact strategy, criteria, budget, target returns, property types, etc. The AI will factor this into its analysis."
              className="mt-1 min-h-[80px]"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={runAnalysis} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Analyze Market
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Past Analyses</h2>
          {researches.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No analyses yet</CardContent></Card>
          ) : (
            researches.map(r => (
              <Card
                key={r.id}
                className={`cursor-pointer hover:border-primary/40 transition-colors ${selectedId === r.id ? "border-primary" : ""}`}
                onClick={() => setSelectedId(r.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{r.market_name}</span>
                    </div>
                    <Badge variant={r.status === "complete" ? "default" : "secondary"} className="text-[10px]">{r.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">{r.strategy.replace(/_/g, " ")}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {selected && analysis ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {selected.market_name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground capitalize">Strategy: {selected.strategy.replace(/_/g, " ")}</p>
                  {selected.custom_criteria && (
                    <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Your criteria:</span> {selected.custom_criteria}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis.summary && (
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Market Summary</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysis.summary}</p>
                    </div>
                  )}

                  {analysis.key_metrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(analysis.key_metrics).map(([key, val]) => (
                        <div key={key} className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                          <p className="text-lg font-semibold mt-1">{val as string}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {analysis.industries && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <Briefcase className="h-4 w-4" /> Key Industries
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(analysis.industries as string[]).map((ind, i) => (
                          <Badge key={i} variant="secondary">{ind}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.recommendation && (
                    <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                      <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-primary" /> AI Recommendation
                      </h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysis.recommendation}</p>
                    </div>
                  )}

                  {analysis.risks && (
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Risks & Considerations</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysis.risks}</p>
                    </div>
                  )}

                  {/* Sources & Methodology */}
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="h-3.5 w-3.5" />
                      Sources & Methodology
                      <ChevronDown className="h-3 w-3" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground space-y-2">
                      {analysis.sources_note ? (
                        <p className="whitespace-pre-wrap">{analysis.sources_note}</p>
                      ) : (
                        <p>Analysis based on publicly available market data, census information, economic reports, and real estate market trends.</p>
                      )}
                      <p className="italic border-t border-border/50 pt-2">
                        ⚠️ Analysis generated by AI based on publicly available market data and trends. Not financial advice. Always verify data with local sources before making investment decisions.
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Building className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                <p className="text-sm text-muted-foreground mt-3">Select an analysis to view details, or run a new one.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
