import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Pencil, Save, Star, Crosshair, Target, Mountain, Calendar, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type VisionSection = {
  id: string; section: string; content: { text?: string; items?: string[] };
  sort_order: number; updated_at: string; updated_by: string | null;
};

const sectionMeta: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  core_values: { label: "Core Values", icon: Star, description: "3-5 guiding principles that define how your team operates" },
  core_focus_purpose: { label: "Core Focus — Purpose", icon: Crosshair, description: "Why does this company exist?" },
  core_focus_niche: { label: "Core Focus — Niche", icon: Crosshair, description: "What are you best at? Who do you serve?" },
  ten_year_target: { label: "10-Year Target", icon: Mountain, description: "Your big, audacious, long-term goal" },
  three_year_picture: { label: "3-Year Picture", icon: Target, description: "What does the company look like in 3 years?" },
  one_year_plan: { label: "1-Year Plan", icon: Calendar, description: "Key objectives and revenue/profit targets for this year" },
};

export default function VisionPage() {
  const { user, isAdmin } = useAuth();
  const [sections, setSections] = useState<VisionSection[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [goals, setGoals] = useState<{ id: string; title: string; status: string; quarter: string; year: number }[]>([]);

  const fetchAll = useCallback(async () => {
    const [v, g] = await Promise.all([
      supabase.from("vision").select("*").order("sort_order"),
      supabase.from("goals").select("id, title, status, quarter, year").order("year", { ascending: false }).order("quarter"),
    ]);
    if (v.data) setSections(v.data as VisionSection[]);
    if (g.data) setGoals(g.data);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const startEdit = (section: VisionSection) => {
    setEditing(section.id);
    const content = section.content as any;
    setEditText(content?.text || (content?.items || []).join("\n") || "");
  };

  const saveEdit = async (section: VisionSection) => {
    const { error } = await supabase.from("vision").update({
      content: { text: editText },
      updated_by: user?.id,
    }).eq("id", section.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Saved" }); setEditing(null); fetchAll(); }
  };

  const currentQuarterGoals = goals.filter(g => {
    const now = new Date();
    const q = `Q${Math.floor(now.getMonth() / 3) + 1}`;
    return g.year === now.getFullYear() && g.quarter === q;
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Eye className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Vision</h1>
      </div>

      <div className="space-y-4">
        {sections.map(section => {
          const meta = sectionMeta[section.section];
          if (!meta) return null;
          const Icon = meta.icon;
          const content = section.content as any;
          const text = content?.text || "";
          const isEditing = editing === section.id;

          return (
            <Card key={section.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {meta.label}
                  </CardTitle>
                  {isAdmin && !isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => startEdit(section)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {isAdmin && isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => saveEdit(section)}>
                      <Save className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea value={editText} onChange={e => setEditText(e.target.value)} rows={4} className="text-sm" />
                ) : text ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{text}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not yet defined. {isAdmin && "Click the pencil to add content."}</p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Quarterly Rocks auto-pulled */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Quarterly Rocks
            </CardTitle>
            <p className="text-xs text-muted-foreground">Auto-pulled from Execution Hub goals for the current quarter</p>
          </CardHeader>
          <CardContent>
            {currentQuarterGoals.length > 0 ? (
              <ul className="space-y-2">
                {currentQuarterGoals.map(g => (
                  <li key={g.id} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${g.status === "done" ? "bg-green-500" : g.status === "at_risk" ? "bg-red-500" : "bg-blue-500"}`} />
                    {g.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">No goals for the current quarter.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
