import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { market, strategy, customCriteria, recordId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let prompt = `You are a real estate market analyst. Analyze the following market for a "${strategy.replace(/_/g, " ")}" investment strategy.

Market: ${market}`;

    if (customCriteria) {
      prompt += `

The investor has provided these specific criteria and strategy details:
${customCriteria}

Factor these criteria into your analysis and recommendation.`;
    }

    prompt += `

Provide a comprehensive analysis covering:
1. Market summary (population, growth trends, economic outlook)
2. Job growth and key industries driving the economy
3. Housing market conditions (median prices, rent trends, vacancy rates)
4. Population growth and migration patterns
5. Infrastructure and development projects
6. Rental demand and investor activity
7. Your recommendation on whether this market is good for the specified strategy
8. Risks and considerations
9. Sources: List the types of data sources and methodology you used (e.g., Census data, BLS employment statistics, local MLS trends, etc.)

Be specific with data points where possible. If you don't have exact current data, provide your best assessment based on known trends.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "You are a real estate market research analyst. Return structured analysis." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "market_analysis",
            description: "Return structured market analysis",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "2-3 paragraph market overview" },
                key_metrics: {
                  type: "object",
                  properties: {
                    population: { type: "string" },
                    job_growth: { type: "string" },
                    median_home_price: { type: "string" },
                    avg_rent: { type: "string" },
                  },
                  required: ["population", "job_growth", "median_home_price", "avg_rent"],
                },
                industries: { type: "array", items: { type: "string" }, description: "Top 5-8 industries" },
                recommendation: { type: "string", description: "Strategy-specific recommendation" },
                risks: { type: "string", description: "Key risks and considerations" },
                score: { type: "number", description: "Market score 1-10 for this strategy" },
                sources_note: { type: "string", description: "List the data sources and methodology used for this analysis (e.g., U.S. Census Bureau, BLS, Zillow/Redfin trends, local MLS data, etc.)" },
              },
              required: ["summary", "key_metrics", "industries", "recommendation", "risks", "score", "sources_note"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "market_analysis" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI analysis failed");
    }

    const aiResult = await response.json();
    let analysis = {};
    try {
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        analysis = JSON.parse(toolCall.function.arguments);
      }
    } catch {
      analysis = { summary: aiResult.choices?.[0]?.message?.content || "Analysis unavailable" };
    }

    await supabase.from("market_research").update({
      ai_analysis: analysis,
      status: "complete",
    }).eq("id", recordId);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("market-research error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
