import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface UnsplashPhoto {
  id: string;
  urls: { regular: string; small: string; full: string };
  user: { name: string; links: { html: string } };
  links: { html: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ACCESS_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY");
    if (!ACCESS_KEY) {
      return new Response(
        JSON.stringify({ error: "Unsplash not configured", configured: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const query = (url.searchParams.get("q") || "").trim();
    const page = Number(url.searchParams.get("page") || "1");

    const endpoint = query
      ? `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=24&orientation=landscape`
      : `https://api.unsplash.com/photos?page=${page}&per_page=24&order_by=popular`;

    const res = await fetch(endpoint, {
      headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(
        JSON.stringify({ error: `Unsplash API error [${res.status}]`, detail: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    const photos: UnsplashPhoto[] = query ? data.results : data;
    const results = photos.map((p) => ({
      id: p.id,
      thumb: p.urls.small,
      full: p.urls.regular,
      author: p.user.name,
      authorUrl: p.user.links.html,
      photoUrl: p.links.html,
    }));

    return new Response(JSON.stringify({ configured: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
