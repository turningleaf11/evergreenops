import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// market-research -- fills the market scorecard (17 categories across the
// foundation/operator/personal layers, modeled on Alexander's manual rubric)
// via Claude, instead of writing one free-text blob. Human-edited rows are
// never silently overwritten: if a category was last set by a person, the
// AI's read is recorded as a conflict note instead of replacing their value.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeParseJson(text: string): any {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
    return null;
  }
}

type CategoryRow = { key: string; layer: string; label: string; guidance: string };
type ScoredCategory = {
  rating: "green" | "yellow" | "red";
  note: string;
  source: string;
  is_core_red: boolean;
  conflict_flag: boolean;
  conflict_note: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!ANTHROPIC_API_KEY) return jsonErr("ANTHROPIC_API_KEY not configured", 500);

    const { market, strategy, customCriteria, recordId, marketId } = await req.json();
    if (!marketId) return jsonErr("marketId is required", 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const [{ data: categories, error: catErr }, { data: existingRows, error: rowsErr }, { data: marketRow, error: marketErr }] = await Promise.all([
      supabase
        .from("market_scorecard_categories")
        .select("key, layer, label, guidance")
        .eq("ai_scorable", true)
        .order("sort_order"),
      supabase
        .from("market_scorecard_rows")
        .select("category, rating, note, updated_by_kind")
        .eq("market_id", marketId),
      supabase
        .from("markets")
        .select("decision_updated_by_kind")
        .eq("id", marketId)
        .maybeSingle(),
    ]);
    if (catErr) throw catErr;
    if (rowsErr) throw rowsErr;
    if (marketErr) throw marketErr;
    const decisionIsHumanOwned = marketRow?.decision_updated_by_kind === "human";

    const humanOwned = new Map<string, { rating: string | null; note: string | null }>();
    for (const r of (existingRows ?? [])) {
      if (r.updated_by_kind === "human") humanOwned.set(r.category, { rating: r.rating, note: r.note });
    }

    const categoryList = (categories ?? []) as CategoryRow[];
    const shape = categoryList
      .map((c) => `    "${c.key}": { "rating": "green|yellow|red", "note": "one sentence, cite the number", "source": "e.g. Census ACS, BLS, HUD FMR", "is_core_red": false, "conflict_flag": false, "conflict_note": "" }`)
      .join(",\n");

    const system =
      "You are an underwriter scoring a real-estate market against a fixed rubric, in the same spirit as a disciplined human analyst filling out a scorecard by hand. " +
      "Rate what the data actually says, not what would make the market look attractive -- most rows in most markets should be yellow, not green. " +
      "Set is_core_red=true only for a genuine deal-killer regardless of the rest of the sheet: population decline, weak/shrinking job growth, dependency on one or two employers, a thin exit market, a weak property-management bench, or a clear strategy/deal-size mismatch. " +
      "If you are aware of two data points that disagree (e.g. an older figure vs. a more recent report), set conflict_flag=true, note which one you treated as authoritative and why in conflict_note, and never silently average them. " +
      "If you do not have enough information to rate a row honestly, use rating=\"yellow\" and say so in the note rather than inventing a number. " +
      "Return ONLY a valid JSON object -- no markdown fences, no commentary.";

    const user =
      `MARKET: ${market}\n` +
      `STRATEGY: ${(strategy || "buy_and_hold").replace(/_/g, " ")}\n` +
      (customCriteria ? `INVESTOR CRITERIA: ${customCriteria}\n` : "") +
      `\nScore every category below. Then give an overall decision.\n\n` +
      `Return ONLY a JSON object with exactly this shape:\n{\n  "categories": {\n${shape}\n  },\n` +
      `  "decision": "go|watch|no_go",\n` +
      `  "decision_why": "1-2 sentences",\n` +
      `  "decision_next_step": "one concrete action"\n}\n\n` +
      `Categories to score:\n` +
      categoryList.map((c) => `- ${c.key} (${c.layer}): ${c.label} -- source guidance: ${c.guidance}`).join("\n");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("Anthropic error", r.status, t);
      if (recordId) await supabase.from("market_research").update({ status: "error" }).eq("id", recordId);
      if (r.status === 429) return jsonErr("Rate limited -- try again in a moment.", 429);
      return jsonErr(`AI error ${r.status}`, 500);
    }
    const data = await r.json();
    const raw = data?.content?.[0]?.text || "{}";
    const parsed = safeParseJson(raw);
    if (!parsed?.categories) {
      if (recordId) await supabase.from("market_research").update({ status: "error" }).eq("id", recordId);
      return jsonErr("AI returned an unusable response", 500);
    }

    const now = new Date().toISOString();
    let coreReds = 0, greens = 0, yellows = 0, reds = 0;

    for (const cat of categoryList) {
      const scored = parsed.categories[cat.key] as ScoredCategory | undefined;
      if (!scored) continue;

      const owner = humanOwned.get(cat.key);
      if (owner) {
        // A human owns this row -- never overwrite their rating/note. Record the
        // AI's independent read as a conflict note only if it actually disagrees.
        if (owner.rating && owner.rating !== scored.rating) {
          await supabase.from("market_scorecard_rows").update({
            conflict_flag: true,
            conflict_note: `AI re-score suggests ${scored.rating} (kept human rating: ${owner.rating}). AI note: ${scored.note}`,
          }).eq("market_id", marketId).eq("category", cat.key);
        }
        if (owner.rating === "red") reds++; else if (owner.rating === "yellow") yellows++; else if (owner.rating === "green") greens++;
        continue;
      }

      await supabase.from("market_scorecard_rows").upsert({
        market_id: marketId,
        category: cat.key,
        rating: scored.rating,
        note: scored.note,
        source: scored.source,
        is_core_red: !!scored.is_core_red,
        conflict_flag: !!scored.conflict_flag,
        conflict_note: scored.conflict_note || "",
        updated_by_kind: "ai",
        updated_by: null,
        updated_at: now,
      }, { onConflict: "market_id,category" });

      if (scored.is_core_red) coreReds++;
      if (scored.rating === "green") greens++; else if (scored.rating === "yellow") yellows++; else if (scored.rating === "red") reds++;
    }

    const decision = ["go", "watch", "no_go"].includes(parsed.decision) ? parsed.decision : "watch";
    // A human-set decision is never silently overwritten by a re-score --
    // only last_scored_at moves, so the workspace still knows a run happened.
    await supabase.from("markets").update(
      decisionIsHumanOwned
        ? { last_scored_at: now }
        : {
            decision,
            decision_why: parsed.decision_why || "",
            decision_next_step: parsed.decision_next_step || "",
            decision_updated_by_kind: "ai",
            decision_updated_by: null,
            last_scored_at: now,
          }
    ).eq("id", marketId);

    // Keep the legacy market_research record populated so the existing
    // AI Analysis tab still shows something coherent until Phase 4 reworks the UI.
    const summary =
      `${greens} green / ${yellows} yellow / ${reds} red across ${categoryList.length} scored categories` +
      (coreReds > 0 ? ` (${coreReds} core red${coreReds > 1 ? "s" : ""})` : "") + `. Decision: ${decision.toUpperCase()}.`;
    if (recordId) {
      await supabase.from("market_research").update({
        status: "complete",
        ai_analysis: {
          summary,
          recommendation: parsed.decision_why || "",
          risks: parsed.decision_next_step || "",
        },
        ...(marketId ? { market_id: marketId } : {}),
      }).eq("id", recordId);
    }

    return new Response(JSON.stringify({ success: true, decision, greens, yellows, reds, coreReds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("market-research error:", e);
    return jsonErr(e instanceof Error ? e.message : "unknown", 500);
  }
});
