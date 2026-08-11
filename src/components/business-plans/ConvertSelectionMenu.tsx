import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Target, Flag, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { usePlanEntities } from "./PlanEntityContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

/**
 * Turn selected prose into a real plan record.
 *
 * Write naturally first, formalize after — which is why this is a selection
 * action rather than an @-mention: you shouldn't have to know a sentence is
 * going to become a milestone before you've written it.
 *
 * Renders nothing outside a plan doc.
 */
export function ConvertSelectionMenu({ editor }: { editor: Editor }) {
  const ctx = usePlanEntities();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!ctx) return null;

  const convert = async (kind: "milestone" | "risk" | "goal") => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ").trim();
    if (!text) return;

    setBusy(true);
    try {
      let recordId: string | null = null;

      if (kind === "milestone") {
        const { data, error } = await supabase.from("business_plan_milestones").insert({
          business_plan_id: ctx.planId, title: text, sort_order: ctx.milestones.length,
        }).select("id").single();
        if (error) throw error;
        recordId = data.id;
      } else if (kind === "risk") {
        const { data, error } = await supabase.from("business_plan_risks").insert({
          business_plan_id: ctx.planId, text, severity: "med", sort_order: ctx.risks.length,
        }).select("id").single();
        if (error) throw error;
        recordId = data.id;
      } else {
        const now = new Date();
        const { data: profile } = user
          ? await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).maybeSingle()
          : { data: null };
        const { data, error } = await supabase.from("goals").insert({
          title: text,
          quarter: `Q${Math.floor(now.getMonth() / 3) + 1}`,
          year: now.getFullYear(),
          status: "on_track",
          progress: 0,
          business_plan_id: ctx.planId,
          owner_id: user?.id ?? null,
          created_by: user?.id ?? null,
          workspace_id: profile?.workspace_id ?? null,
        }).select("id").single();
        if (error) throw error;
        recordId = data.id;
      }

      // Replace the selected prose with the live block.
      editor.chain().focus()
        .deleteRange({ from, to })
        .insertPlanEntity({ kind, recordId: recordId! })
        .run();

      await ctx.refresh();
      toast({
        title: `${kind[0].toUpperCase()}${kind.slice(1)} created`,
        description: kind === "goal" ? "Also shows up in Execution Hub." : undefined,
      });
    } catch (e: any) {
      toast({ title: `Couldn't create ${kind}`, description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="bubble-btn" title="Convert selection to a plan record" disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
          Convert selection to
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => convert("goal")} className="gap-2 text-xs">
          <Target className="h-3.5 w-3.5 text-blue-500" /> Goal
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => convert("milestone")} className="gap-2 text-xs">
          <Flag className="h-3.5 w-3.5 text-amber-500" /> Milestone
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => convert("risk")} className="gap-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Risk
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
