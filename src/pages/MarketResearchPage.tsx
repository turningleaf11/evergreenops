import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building, Search, Loader2, MapPin, TrendingUp, Briefcase, Users, Home } from "lucide-react";
import { toast } from "sonner";

interface MarketResearch {
  id: string;
  market_name: string;
  strategy: string;
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
      // Create the record first
      const { data: record, error: insertError } = await supabase.from("market_research").insert({
        market_name: market.trim(),
        strategy,
        status: "analyzing",
        created_by: user.id,
      }).select().single();
      if (insertError) throw insertError;

      // Call edge function for AI analysis
      const { data, error } = await supabase.functions.invoke("market-research", {
        body: { market: market.trim(), strategy, recordId: (record as any).id },
      });
      if (error) throw error;

      toast.success("Analysis complete!");
      setMarket("");
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
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market Research</h1>
        <p className="text-sm text-muted-foreground">AI-powered real estate market analysis</p>
      </div>

      {/* New Analysis */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Market (City, State or ZIP)</label>
              <Input
                value={market}
                onChange={e => setMarket(e.target.value)}
                placeholder="e.g. Austin, TX or 78701"
                className="mt-1"
              />
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
            <div className="flex items-end">
              <Button onClick={runAnalysis} disabled={loading} className="gap-2 w-full sm:w-auto">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Analyze Market
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Research list */}
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
                    <Badge variant={r.status === "complete" ? "default" : "secondary"} className="text-[10px]">
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">{r.strategy.replace(/_/g, " ")}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Analysis detail */}
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
