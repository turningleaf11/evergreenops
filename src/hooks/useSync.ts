import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const sb = supabase as any;

export type SyncTag = {
  id: string;
  key: string;
  label: string;
  emoji: string;
  color: string;
  tracks_open_state: boolean;
  sort_order: number;
  is_system: boolean;
};

export type SyncChannel = {
  id: string;
  type: "direct" | "group" | "adhoc";
  name: string | null;
  created_by: string | null;
  created_at: string;
  members: SyncMember[];
  /** From the current viewer's perspective: title to show in sidebar. */
  displayName: string;
};

export type SyncMember = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type SyncLinkedItem = {
  type: "project" | "task" | "goal" | "person";
  id: string;
  label: string;
};

export type SyncThread = {
  id: string;
  channel_id: string;
  title: string;
  body: string;
  author_id: string | null;
  tag: string | null;
  status: "open" | "resolved";
  resolved_by: string | null;
  resolved_at: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  linked_items: SyncLinkedItem[];
  converted_project_id: string | null;
};

/**
 * Loads channels (with member profiles) and tags for the current user.
 * Threads are loaded separately via useSyncThreads to allow filtering.
 */
export function useSyncWorkspace() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<SyncChannel[]>([]);
  const [tags, setTags] = useState<SyncTag[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: chRows }, { data: tagRows }] = await Promise.all([
      sb.from("sync_channels").select("*").order("created_at", { ascending: true }),
      sb.from("sync_tags").select("*").order("sort_order", { ascending: true }),
    ]);

    const channelIds = (chRows ?? []).map((c: any) => c.id);
    let memberRows: any[] = [];
    let profilesById = new Map<string, SyncMember>();
    if (channelIds.length > 0) {
      const { data: m } = await sb
        .from("sync_channel_members")
        .select("channel_id, user_id")
        .in("channel_id", channelIds);
      memberRows = m ?? [];
      const userIds = Array.from(new Set(memberRows.map((r) => r.user_id)));
      if (userIds.length > 0) {
        const { data: profs } = await sb
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        profilesById = new Map((profs ?? []).map((p: any) => [p.user_id, p as SyncMember]));
      }
    }

    const enriched: SyncChannel[] = (chRows ?? []).map((c: any) => {
      const members: SyncMember[] = memberRows
        .filter((m) => m.channel_id === c.id)
        .map((m) => profilesById.get(m.user_id))
        .filter(Boolean) as SyncMember[];
      let displayName = c.name || "Untitled";
      if (c.type === "direct") {
        const other = members.find((m) => m.user_id !== user.id);
        displayName = other?.full_name || "Direct";
      }
      return { ...c, members, displayName };
    });

    setChannels(enriched);
    setTags(tagRows ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { channels, tags, loading, refresh };
}

export type ThreadFilters = {
  channelId?: string | null;
  status?: "open" | "resolved" | "all";
  tag?: string | null;
  /** "needs_you" = open threads on tags that track state, authored by someone other than me */
  view?: "all" | "needs_you";
};

export function useSyncThreads(filters: ThreadFilters, tags: SyncTag[]) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<SyncThread[]>([]);
  const [loading, setLoading] = useState(true);

  const trackedTagKeys = tags.filter((t) => t.tracks_open_state).map((t) => t.key);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = sb.from("sync_threads").select("*").order("last_activity_at", { ascending: false });

    if (filters.view === "needs_you") {
      q = q.eq("status", "open").neq("author_id", user.id);
      if (trackedTagKeys.length > 0) q = q.in("tag", trackedTagKeys);
    } else {
      if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
    }
    if (filters.channelId) q = q.eq("channel_id", filters.channelId);
    if (filters.tag) q = q.eq("tag", filters.tag);

    const { data } = await q;
    const normalized: SyncThread[] = ((data ?? []) as any[]).map((t) => ({
      ...t,
      linked_items: Array.isArray(t.linked_items) ? t.linked_items : [],
      converted_project_id: t.converted_project_id ?? null,
    }));
    setThreads(normalized);
    setLoading(false);
  }, [user, JSON.stringify(filters), trackedTagKeys.join(",")]);

  useEffect(() => { refresh(); }, [refresh]);

  return { threads, loading, refresh };
}
