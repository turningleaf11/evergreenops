import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import type { SyncTag } from "@/hooks/useSync";
import { SyncTagBadge } from "./SyncTagBadge";

const sb = supabase as any;

const COLOR_OPTIONS = ["blue", "orange", "purple", "red", "green", "gray"] as const;

type Draft = Omit<SyncTag, "id" | "created_at"> & { id?: string };

const emptyDraft: Draft = {
  key: "",
  label: "",
  emoji: "💬",
  color: "gray",
  tracks_open_state: false,
  sort_order: 100,
  is_system: false,
};

export function SyncTagsSettings() {
  const [tags, setTags] = useState<SyncTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data } = await sb.from("sync_tags").select("*").order("sort_order", { ascending: true });
    setTags(data ?? []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const updateField = async (id: string, patch: Partial<SyncTag>) => {
    setBusy(id);
    const { error } = await sb.from("sync_tags").update(patch).eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    await refresh();
  };

  const remove = async (tag: SyncTag) => {
    if (tag.is_system) { toast.error("System tags can't be deleted — turn them off in threads if unused."); return; }
    if (!confirm(`Delete tag "${tag.label}"? Existing threads keep the tag label as a plain string.`)) return;
    setBusy(tag.id);
    const { error } = await sb.from("sync_tags").delete().eq("id", tag.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    await refresh();
  };

  const create = async () => {
    if (!creating) return;
    if (!creating.key.trim() || !creating.label.trim()) {
      toast.error("Key and label are required");
      return;
    }
    const { error } = await sb.from("sync_tags").insert({
      ...creating,
      key: creating.key.trim().toLowerCase().replace(/\s+/g, "_"),
      label: creating.label.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setCreating(null);
    await refresh();
    toast.success("Tag added");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Sync Tags</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tags categorize threads. Tags marked "tracks open state" surface in <strong>Needs You</strong> when threads with that tag are open and waiting on you.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card/40 divide-y divide-border/40">
          {tags.map((t) => (
            <TagRow
              key={t.id}
              tag={t}
              busy={busy === t.id}
              onChange={(patch) => updateField(t.id, patch)}
              onDelete={() => remove(t)}
            />
          ))}
          {tags.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted-foreground italic">No tags yet.</p>
          )}
        </div>
      )}

      {creating ? (
        <div className="rounded-xl border border-primary/40 bg-card/40 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2">
            <input
              autoFocus
              value={creating.emoji}
              onChange={(e) => setCreating({ ...creating, emoji: e.target.value })}
              placeholder="emoji"
              className="text-2xl text-center bg-muted/40 rounded-md px-2 py-1.5 outline-none"
              maxLength={4}
            />
            <input
              value={creating.label}
              onChange={(e) => setCreating({ ...creating, label: e.target.value, key: e.target.value })}
              placeholder="Label (e.g. Risk)"
              className="text-sm bg-muted/40 rounded-md px-2.5 py-1.5 outline-none"
            />
            <select
              value={creating.color}
              onChange={(e) => setCreating({ ...creating, color: e.target.value })}
              className="text-sm bg-muted/40 rounded-md px-2.5 py-1.5 outline-none"
            >
              {COLOR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={creating.tracks_open_state}
              onChange={(e) => setCreating({ ...creating, tracks_open_state: e.target.checked })}
            />
            Surface in "Needs You" when open
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(null)} className="text-xs text-muted-foreground px-3 py-1.5">Cancel</button>
            <button onClick={create} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground">
              <Save className="h-3 w-3" /> Add tag
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating({ ...emptyDraft, sort_order: (tags.at(-1)?.sort_order ?? 0) + 10 })}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border border-border/60 hover:bg-muted text-foreground"
        >
          <Plus className="h-3 w-3" /> Add tag
        </button>
      )}
    </div>
  );
}

function TagRow({ tag, busy, onChange, onDelete }: { tag: SyncTag; busy: boolean; onChange: (patch: Partial<SyncTag>) => void; onDelete: () => void }) {
  const [emoji, setEmoji] = useState(tag.emoji);
  const [label, setLabel] = useState(tag.label);
  const [color, setColor] = useState(tag.color);
  const [tracks, setTracks] = useState(tag.tracks_open_state);

  useEffect(() => { setEmoji(tag.emoji); setLabel(tag.label); setColor(tag.color); setTracks(tag.tracks_open_state); }, [tag.id]);

  const dirty = emoji !== tag.emoji || label !== tag.label || color !== tag.color || tracks !== tag.tracks_open_state;

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <SyncTagBadge tag={{ ...tag, emoji, label, color }} />
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[3rem_1fr_8rem_auto] gap-2 items-center">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className="text-lg text-center bg-muted/40 rounded-md px-1 py-1 outline-none"
          maxLength={4}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="text-sm bg-muted/40 rounded-md px-2 py-1 outline-none"
        />
        <select value={color} onChange={(e) => setColor(e.target.value)} className="text-sm bg-muted/40 rounded-md px-2 py-1 outline-none">
          {COLOR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap">
          <input type="checkbox" checked={tracks} onChange={(e) => setTracks(e.target.checked)} />
          Needs You
        </label>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {dirty && (
          <button
            disabled={busy}
            onClick={() => onChange({ emoji, label, color, tracks_open_state: tracks })}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-primary text-primary-foreground disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </button>
        )}
        {tag.is_system ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-1 text-[10px] text-muted-foreground" title="System tag — can't delete">
            <Lock className="h-3 w-3" />
          </span>
        ) : (
          <button onClick={onDelete} disabled={busy} className="h-7 w-7 rounded-md text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 flex items-center justify-center disabled:opacity-40" title="Delete">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

