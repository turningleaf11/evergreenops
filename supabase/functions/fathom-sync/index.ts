// Pulls recent meetings from Fathom and upserts them into the meetings table.
// Uses FATHOM_API_KEY. Matches attendee emails to profiles to set assignee_user_id on action items.
//
// Fathom API reference: https://docs.fathom.ai/
// We call /meetings (or list endpoint) — adjust the endpoint/path/payload field names below
// once we have access to the actual schema. The mapper isolates that change.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FATHOM_BASE = "https://api.fathom.ai/external/v1";

interface FathomMeeting {
  id?: string;
  meeting_id?: string;
  title?: string;
  meeting_title?: string;
  started_at?: string;
  scheduled_start_time?: string;
  duration_seconds?: number;
  recording_url?: string;
  share_url?: string;
  url?: string;
  transcript?: string;
  transcript_text?: string;
  summary?: string;
  ai_summary?: string;
  host_email?: string;
  invitees?: any[];
  attendees?: any[];
  action_items?: any[];
  [k: string]: any;
}

const norm = (m: any) => {
  const start = m.recording_start_time || m.scheduled_start_time || m.started_at || null;
  const end = m.recording_end_time || m.scheduled_end_time || null;
  let duration = m.duration_seconds || 0;
  if (!duration && start && end) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) duration = Math.round((e - s) / 1000);
  }
  return {
    fathom_id: String(m.recording_id ?? m.id ?? m.meeting_id ?? ""),
    title: m.meeting_title || m.title || "Untitled meeting",
    started_at: start,
    duration_seconds: duration,
    recording_url: m.share_url || m.url || m.recording_url || null,
    transcript_text: typeof m.transcript === "string" ? m.transcript : (m.transcript_text || null),
    summary: m.default_summary || m.summary || m.ai_summary || null,
    host_email: m.recorded_by?.email || m.host_email || null,
    attendees: m.calendar_invitees || m.attendees || m.invitees || [],
    action_items: m.action_items || [],
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const FATHOM_API_KEY = Deno.env.get("FATHOM_API_KEY");
  if (!FATHOM_API_KEY) {
    return new Response(JSON.stringify({ error: "FATHOM_API_KEY is not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Identify caller's workspace (use bearer if present, else first workspace)
  const auth = req.headers.get("Authorization");
  let workspaceId: string | null = null;
  if (auth) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (u?.user) {
      const { data: profile } = await supabase
        .from("profiles").select("workspace_id").eq("user_id", u.user.id).maybeSingle();
      workspaceId = profile?.workspace_id || null;
    }
  }
  if (!workspaceId) {
    const { data: ws } = await supabase.from("workspaces").select("id").order("created_at").limit(1).maybeSingle();
    workspaceId = ws?.id || null;
  }

  // Fetch from Fathom (paginate via next_cursor; idempotent upsert handles dedupe)
  let fathomMeetings: any[] = [];
  let cursor: string | null = null;
  const MAX_PAGES = 20;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(`${FATHOM_BASE}/meetings`);
      url.searchParams.set("limit", "50");
      if (cursor) url.searchParams.set("cursor", cursor);

      const resp = await fetch(url.toString(), {
        headers: {
          "X-Api-Key": FATHOM_API_KEY,
          "Authorization": `Bearer ${FATHOM_API_KEY}`,
          "Accept": "application/json",
        },
      });
      if (!resp.ok) {
        const body = await resp.text();
        return new Response(JSON.stringify({
          error: `Fathom API ${resp.status}`,
          details: body.slice(0, 500),
          hint: "Verify FATHOM_API_KEY and that your Fathom plan exposes the API.",
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const json = await resp.json();
      const items: any[] = Array.isArray(json)
        ? json
        : (json.items || json.meetings || json.data || json.results || []);
      fathomMeetings.push(...items);
      cursor = json.next_cursor || null;
      if (!cursor || items.length === 0) break;
    }
    console.log(`[fathom-sync] fetched ${fathomMeetings.length} meetings`);
  } catch (e) {
    return new Response(JSON.stringify({ error: `Fathom fetch failed: ${(e as Error).message}` }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Profile lookup for assignee matching
  const { data: profiles } = await supabase.from("profiles").select("user_id, email");
  const emailMap = new Map<string, string>();
  (profiles || []).forEach((p: any) => p.email && emailMap.set(p.email.toLowerCase(), p.user_id));

  let synced = 0;
  for (const raw of fathomMeetings) {
    const m = norm(raw);
    if (!m.fathom_id) continue;

    const { data: meeting, error: upErr } = await supabase
      .from("meetings")
      .upsert({
        workspace_id: workspaceId,
        fathom_meeting_id: m.fathom_id,
        title: m.title,
        started_at: m.started_at,
        duration_seconds: m.duration_seconds,
        recording_url: m.recording_url,
        transcript_text: m.transcript_text,
        summary: m.summary,
        host_email: m.host_email,
        attendees: m.attendees,
        raw_payload: raw,
        synced_at: new Date().toISOString(),
      }, { onConflict: "fathom_meeting_id" })
      .select()
      .single();

    if (upErr || !meeting) { console.error("upsert error", upErr); continue; }
    synced++;

    // Replace action items for this meeting
    await supabase.from("meeting_action_items").delete().eq("meeting_id", meeting.id).is("converted_task_id", null);

    const items = m.action_items || [];
    for (let i = 0; i < items.length; i++) {
      const it: any = items[i];
      const text = typeof it === "string" ? it : (it.text || it.description || it.title || "");
      const email = typeof it === "object" ? (it.assignee_email || it.assignee || null) : null;
      const userId = email ? emailMap.get(String(email).toLowerCase()) || null : null;
      if (!text) continue;
      await supabase.from("meeting_action_items").insert({
        meeting_id: meeting.id,
        text,
        assignee_email: email,
        assignee_user_id: userId,
        sort_order: i,
      });
    }
  }

  return new Response(JSON.stringify({ synced, fetched: fathomMeetings.length }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
