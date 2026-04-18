import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Loader2, RefreshCw, TrendingUp, DollarSign, BarChart3, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

interface BriefingConfig {
  ghl_enabled: boolean;
  database_ids: string[];
  ghl_kpis: string[];
}

interface GhlKpis {
  pipeline_value?: number;
  opportunities_count?: number;
  opportunities_won?: number;
  opportunities_lost?: number;
  opportunities_open?: number;
  by_status?: Record<string, number>;
}

interface DbKpi {
  database_id: string;
  title: string;
  total_rows: number;
  status_distribution: Record<string, number>;
  currency_total: { column: string; total: number } | null;
}

export function CeoBriefing() {
  const { user, isPrimaryAdmin: isAdmin } = useAuth();
  const [configuring, setConfiguring] = useState(false);
  const [config, setConfig] = useState<BriefingConfig>({ ghl_enabled: false, database_ids: [], ghl_kpis: [] });
  const [configId, setConfigId] = useState<string | null>(null);
  const [ghlKpis, setGhlKpis] = useState<GhlKpis>({});
  const [dbKpis, setDbKpis] = useState<DbKpi[]>([]);
  const [ghlError, setGhlError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [databases, setDatabases] = useState<{ id: string; title: string }[]>([]);

  // Load config
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("ceo_briefing_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setConfig((data as any).config || { ghl_enabled: false, database_ids: [], ghl_kpis: [] });
        setConfigId((data as any).id);
      }
    })();
  }, [user]);

  // Load databases list for config
  useEffect(() => {
    supabase.from("databases_meta").select("id, title").then(({ data }) => {
      if (data) setDatabases(data);
    });
  }, []);

  const saveConfig = useCallback(async (newConfig: BriefingConfig) => {
    if (!user) return;
    setConfig(newConfig);
    if (configId) {
      await supabase.from("ceo_briefing_config").update({ config: newConfig as any }).eq("id", configId);
    } else {
      const { data } = await supabase.from("ceo_briefing_config").insert({ user_id: user.id, config: newConfig as any }).select().single();
      if (data) setConfigId((data as any).id);
    }
  }, [user, configId]);

  const fetchKpis = useCallback(async () => {
    setLoading(true);
    setGhlError(null);
    try {
      const { data, error } = await supabase.functions.invoke("ceo-briefing-sync");
      if (error) throw error;
      if (data?.ghl_kpis) setGhlKpis(data.ghl_kpis);
      if (data?.database_kpis) setDbKpis(data.database_kpis);
      if (data?.ghl_error) setGhlError(data.ghl_error);
    } catch (err: any) {
      toast({ title: "Failed to sync KPIs", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount if configured
  useEffect(() => {
    if (config.ghl_enabled || config.database_ids.length > 0) {
      fetchKpis();
    }
  }, [config.ghl_enabled, config.database_ids.length]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);

  const hasAnyData = config.ghl_enabled || config.database_ids.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-1">
          {hasAnyData && (
            <Button variant="ghost" size="sm" onClick={fetchKpis} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => setConfiguring(!configuring)}>
              <Settings className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Config panel */}
      {configuring && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">GoHighLevel CRM</p>
              <p className="text-xs text-muted-foreground">Pull pipeline & opportunity KPIs</p>
            </div>
            <Switch
              checked={config.ghl_enabled}
              onCheckedChange={(checked) => saveConfig({ ...config, ghl_enabled: checked })}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Internal Databases</p>
            <p className="text-xs text-muted-foreground mb-2">Select databases to show summary KPIs from</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {databases.map(db => (
                <label key={db.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.database_ids.includes(db.id)}
                    onChange={(e) => {
                      const newIds = e.target.checked
                        ? [...config.database_ids, db.id]
                        : config.database_ids.filter(id => id !== db.id);
                      saveConfig({ ...config, database_ids: newIds });
                    }}
                    className="rounded"
                  />
                  {db.title}
                </label>
              ))}
              {databases.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No databases created yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GHL KPIs */}
      {config.ghl_enabled && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" /> CRM Pipeline
          </h3>
          {ghlError && (
            <p className="text-xs text-destructive mb-2">{ghlError}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon={DollarSign} label="Pipeline Value" value={formatCurrency(ghlKpis.pipeline_value || 0)} />
            <KpiCard icon={BarChart3} label="Total Opps" value={String(ghlKpis.opportunities_count || 0)} />
            <KpiCard icon={TrendingUp} label="Won" value={String(ghlKpis.opportunities_won || 0)} accent="text-green-500" />
            <KpiCard icon={BarChart3} label="Open" value={String(ghlKpis.opportunities_open || 0)} />
          </div>
        </div>
      )}

      {/* Internal DB KPIs */}
      {dbKpis.map(db => (
        <div key={db.database_id}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <Database className="h-3 w-3" /> {db.title}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard icon={BarChart3} label="Total Records" value={String(db.total_rows)} />
            {db.currency_total && (
              <KpiCard icon={DollarSign} label={db.currency_total.column} value={formatCurrency(db.currency_total.total)} />
            )}
            {Object.entries(db.status_distribution).slice(0, 4).map(([status, count]) => (
              <KpiCard key={status} icon={BarChart3} label={status} value={String(count)} />
            ))}
          </div>
        </div>
      ))}

      {!hasAnyData && !configuring && (
        <p className="text-sm text-muted-foreground italic">
          No KPI sources configured. {isAdmin && "Click the gear icon to connect your CRM or internal databases."}
        </p>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
      <p className={`text-xl font-semibold ${accent || "text-foreground"}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}
