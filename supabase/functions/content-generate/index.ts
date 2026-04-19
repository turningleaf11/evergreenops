// Content Studio — generate per-platform captions via Lovable AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlatformReq { id: string; label: string; maxChars: number | null }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const { brand, seed, platforms, imageBase64, model } = body as {
      brand: { name: string; audience: string; voice: string; mission: string };
      seed: string;
      platforms: PlatformReq[];
      imageBase64?: string; // data URL
      model?: string;
    };

    if (!brand?.name) return jsonErr("brand required", 400);
    if (!platforms?.length) return jsonErr("at least one platform required", 400);
    if (!seed && !imageBase64) return jsonErr("seed or image required", 400);

    const platInstr = platforms.map((p) => {
      if (p.id === "blog") return `blog: Title, 2-sentence hook, 4-5 section headers each with 1-sentence description, CTA.`;
      const extra = p.id === "linkedin" ? " Slightly longer, still real." : p.id === "tiktok" ? " Hook-first, punchy." : "";
      return `${p.id}: Caption for ${p.label}. Max ~${p.maxChars} chars.${extra}`;
    }).join("\n");

    const imgNote = imageBase64
      ? "An image is attached. Analyze it carefully — setting, mood, people, property — and write content specifically for what you see. Do not be generic."
      : "";

    const systemPrompt = `You generate ready-to-post social content. Match the brand voice exactly. Never use hashtags unless the brand voice example uses them. Output must be a JSON object only — no markdown fences.`;

    const userText = `BRAND: ${brand.name}
AUDIENCE: ${brand.audience}
VOICE: ${brand.voice}
MISSION: ${brand.mission}
${seed ? `SEED: "${seed}"` : ""}
${imgNote}

Return ONLY valid JSON. Keys: ${platforms.map((p) => p.id).join(", ")}. Values: ready-to-post strings.
${platInstr}`;

    // Build messages — Lovable AI gateway supports multimodal via image_url
    const userContent: any[] = [{ type: "text", text: userText }];
    if (imageBase64) {
      userContent.push({ type: "image_url", image_url: { url: imageBase64 } });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error", aiResp.status, text);
      if (aiResp.status === 429) return jsonErr("Rate limit. Try again in a moment.", 429);
      if (aiResp.status === 402) return jsonErr("AI credits exhausted. Add funds in Settings → Workspace → Usage.", 402);
      return jsonErr(`AI error ${aiResp.status}`, 500);
    }

    const data = await aiResp.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      return jsonErr("AI returned invalid JSON", 500);
    }

    return new Response(JSON.stringify({ results: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("content-generate error", e);
    return jsonErr(e instanceof Error ? e.message : "unknown", 500);
  }
});

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
