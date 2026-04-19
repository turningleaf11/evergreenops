// Canva via Anthropic Claude + Canva MCP server
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const { brandName, brandKitId, platform, content } = await req.json();
    if (!content || !platform) {
      return new Response(JSON.stringify({ error: "content and platform required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const designType =
      platform === "linkedin" ? "linkedin_post" :
      platform === "facebook" ? "facebook_post" :
      "instagram_post";

    const prompt = `Create a ${designType} in Canva for "${brandName}"${brandKitId ? ` using brand kit ID "${brandKitId}"` : ""}. Caption to feature: "${String(content).substring(0, 250)}". Generate a clean branded graphic and share the design URL.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
        mcp_servers: [{ type: "url", url: "https://mcp.canva.com/mcp", name: "canva-mcp" }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Anthropic error", resp.status, text);
      return new Response(JSON.stringify({ error: `Anthropic ${resp.status}`, details: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ");
    const match = text.match(/https:\/\/[^\s"')>]+canva[^\s"')>]+/i);

    return new Response(
      JSON.stringify({ url: match ? match[0] : null, message: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("canva-create error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
