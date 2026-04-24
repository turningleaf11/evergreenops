import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { format, parseISO } from "date-fns";

interface GrowthProfile {
  id?: string;
  employee_id: string;
  company_role_description: string | null;
  seats_owned: string[] | null;
  career_goals: string | null;
  personal_rei_goals: string | null;
  skills_developing: string[] | null;
  notes: string | null;
  last_updated_by: string | null;
  updated_at?: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
}

const EMPTY = (employeeId: string): GrowthProfile => ({
  employee_id: employeeId,
  company_role_description: "",
  seats_owned: [],
  career_goals: "",
  personal_rei_goals: "",
  skills_developing: [],
  notes: "",
  last_updated_by: null,
});

export function GrowthTab({ employeeId, profiles }: { employeeId: string; profiles: Profile[] }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<GrowthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const skipNextSave = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("growth_profiles")
      .select("*")
      .eq("employee_id", employeeId)
      .maybeSingle();
    skipNextSave.current = true;
    setProfile((data as any) || EMPTY(employeeId));
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const persist = useCallback(async (patch: Partial<GrowthProfile>) => {
    if (!user || !profile) return;
    const next = { ...profile, ...patch, last_updated_by: user.id };
    setProfile(next);
    const payload = {
      employee_id: employeeId,
      company_role_description: next.company_role_description,
      seats_owned: next.seats_owned,
      career_goals: next.career_goals,
      personal_rei_goals: next.personal_rei_goals,
      skills_developing: next.skills_developing,
      notes: next.notes,
      last_updated_by: user.id,
    };
    if (next.id) {
      const { data } = await supabase.from("growth_profiles").update(payload).eq("id", next.id).select().single();
      if (data) setProfile((p) => (p ? { ...p, updated_at: (data as any).updated_at } : p));
    } else {
      const { data } = await supabase.from("growth_profiles").insert(payload).select().single();
      if (data) setProfile((p) => (p ? { ...p, id: (data as any).id, updated_at: (data as any).updated_at } : p));
    }
  }, [profile, user, employeeId]);

  if (loading || !profile) {
    return <p className="text-xs text-muted-foreground">Loading…</p>;
  }

  const updaterName = profiles.find((p) => p.user_id === profile.last_updated_by)?.full_name || "—";

  return (
    <div className="space-y-6">
      <Section title="Role & Ownership">
        <Field label="Role Description">
          <Textarea
            defaultValue={profile.company_role_description || ""}
            onBlur={(e) => persist({ company_role_description: e.target.value })}
            rows={3}
            placeholder="What does this person own?"
          />
        </Field>
        <Field label="Seats / Functions Owned">
          <TagInput
            tags={profile.seats_owned || []}
            onChange={(seats_owned) => persist({ seats_owned })}
            placeholder="Add a seat (e.g. Acquisitions Lead)"
          />
        </Field>
      </Section>

      <Section title="Career Goals">
        <Field label="Goals within Evergreen">
          <Textarea
            defaultValue={profile.career_goals || ""}
            onBlur={(e) => persist({ career_goals: e.target.value })}
            rows={3}
          />
        </Field>
        <Field label="Personal Real Estate Investment Goals">
          <Textarea
            defaultValue={profile.personal_rei_goals || ""}
            onBlur={(e) => persist({ personal_rei_goals: e.target.value })}
            rows={3}
          />
        </Field>
      </Section>

      <Section title="Skills Developing">
        <TagInput
          tags={profile.skills_developing || []}
          onChange={(skills_developing) => persist({ skills_developing })}
          placeholder="Add a skill"
        />
      </Section>

      <Section title="Admin Notes">
        <p className="text-[11px] italic text-muted-foreground mb-1.5">Only visible to admins</p>
        <Textarea
          defaultValue={profile.notes || ""}
          onBlur={(e) => persist({ notes: e.target.value })}
          rows={4}
          placeholder="Private notes…"
        />
      </Section>

      {profile.updated_at && (
        <p className="text-[11px] text-muted-foreground pt-2 border-t">
          Last updated {format(parseISO(profile.updated_at), "MMM d, yyyy")} by {updaterName}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v || tags.includes(v)) return;
    onChange([...tags, v]);
    setInput("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pr-1">
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {tags.length === 0 && <span className="text-xs text-muted-foreground italic">None</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="px-2.5 rounded-md border bg-background hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
