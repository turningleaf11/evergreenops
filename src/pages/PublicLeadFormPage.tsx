import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PROPERTY_TYPES = [
  "SFR", "SFR Portfolio", "MF Small (2-4)", "MF Large (5+)",
  "Mixed Use", "Commercial", "Land", "Other",
];

type PublicForm = { id: string; name: string; kind: string; active: boolean };

export default function PublicLeadFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PublicForm | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [hp, setHp] = useState(""); // honeypot

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) return;
      const { data, error } = await supabase.rpc("lead_intake_get_public_form", { _slug: slug });
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setForm(null);
      } else {
        setForm(data[0] as PublicForm);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.property_address?.trim() && !values.name?.trim()) {
      toast.error("Please enter at least the property address or your name.");
      return;
    }
    setSubmitting(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-form-submit/${slug}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: { ...values, hp_company: hp } }),
      });
      const out = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error(out?.error || "Could not submit. Please try again.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold mb-2">Form not available</h1>
          <p className="text-muted-foreground">
            This submission link is inactive or no longer exists. Please contact the team that shared it.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Submission received</h1>
          <p className="text-muted-foreground mb-6">
            Thanks — we’ve received your deal and the acquisitions team will review it shortly.
          </p>
          <Button variant="outline" onClick={() => { setValues({}); setSubmitted(false); }}>
            Submit another deal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">{form.name}</h1>
            <p className="text-sm text-muted-foreground">Submit a deal for review</p>
          </div>
        </div>

        <form onSubmit={submit} className="bg-card border rounded-xl p-6 space-y-5 shadow-sm">
          <input
            type="text"
            name="hp_company"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden
          />

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Property</h2>
            <div className="space-y-2">
              <Label htmlFor="property_address">Property address *</Label>
              <Input id="property_address" value={values.property_address ?? ""}
                onChange={(e) => set("property_address", e.target.value)}
                placeholder="123 Main St" required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-2">
                <Label htmlFor="property_city">City</Label>
                <Input id="property_city" value={values.property_city ?? ""}
                  onChange={(e) => set("property_city", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="property_state">State</Label>
                <Input id="property_state" value={values.property_state ?? ""}
                  onChange={(e) => set("property_state", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="property_zip">Zip</Label>
                <Input id="property_zip" value={values.property_zip ?? ""}
                  onChange={(e) => set("property_zip", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Property type</Label>
                <Select value={values.property_type ?? ""} onValueChange={(v) => set("property_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="units">Units</Label>
                <Input id="units" type="number" inputMode="numeric" value={values.units ?? ""}
                  onChange={(e) => set("units", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="unit_mix">Unit mix</Label>
                <Input id="unit_mix" value={values.unit_mix ?? ""}
                  onChange={(e) => set("unit_mix", e.target.value)} placeholder="e.g. 4×1BR, 8×2BR" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sqft">Sqft</Label>
                <Input id="sqft" type="number" inputMode="numeric" value={values.sqft ?? ""}
                  onChange={(e) => set("sqft", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asking_price">Asking price ($)</Label>
              <Input id="asking_price" type="number" inputMode="decimal" value={values.asking_price ?? ""}
                onChange={(e) => set("asking_price", e.target.value)} />
            </div>
          </section>

          <section className="space-y-3 pt-2 border-t">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your contact info</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={values.name ?? ""}
                  onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" value={values.company ?? ""}
                  onChange={(e) => set("company", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={values.email ?? ""}
                  onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={values.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-2 pt-2 border-t">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={4} value={values.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anything else we should know — disposition strategy, timing, financials…" />
          </section>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</>) : "Submit deal"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Submissions are reviewed by the acquisitions team.
        </p>
      </div>
    </div>
  );
}
