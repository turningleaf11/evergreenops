// DispoManagerField — pick the dispo manager who fronts this deal on the public
// site, and manage the roster inline (add/edit, upload a headshot). Managers are
// shared across deals (dispo_managers); the deal just references one.

import { useCallback, useEffect, useRef, useState } from "react";
import { UserRound, Pencil, Plus, Loader2, Check, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const dispo = supabase as unknown as { from: (table: string) => any };
const PHOTO_BUCKET = "dispo-property-photos";

export interface Manager {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  active: boolean;
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

function Avatar({ m, size = 40 }: { m: Pick<Manager, "name" | "photo_url">; size?: number }) {
  return m.photo_url ? (
    <img src={m.photo_url} alt={m.name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="rounded-full bg-brand-mint/20 text-brand-mint-deep grid place-items-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(m.name) || <UserRound className="h-4 w-4" />}
    </span>
  );
}

export function DispoManagerField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await dispo
      .from("dispo_managers")
      .select("id, name, title, email, phone, photo_url, active")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    setManagers((data as Manager[]) ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = managers.find((m) => m.id === value) ?? null;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {selected ? <Avatar m={selected} /> : (
          <span className="rounded-full bg-muted grid place-items-center h-10 w-10 text-muted-foreground">
            <UserRound className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{selected ? selected.name : "No listing contact"}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {selected ? (selected.title || "Dispo manager") : "Shown on the public listing"}
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Change</Button>

      <ManagerDialog
        open={open}
        onOpenChange={setOpen}
        managers={managers}
        selectedId={value}
        onAssign={(id) => onChange(id)}
        onRosterChanged={load}
      />
    </div>
  );
}

function ManagerDialog({
  open,
  onOpenChange,
  managers,
  selectedId,
  onAssign,
  onRosterChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  managers: Manager[];
  selectedId: string | null;
  onAssign: (id: string | null) => void;
  onRosterChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Manager | "new" | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? (editing === "new" ? "Add manager" : "Edit manager") : "Listing contact"}</DialogTitle>
        </DialogHeader>

        {editing ? (
          <ManagerForm
            manager={editing === "new" ? null : editing}
            onDone={async () => { setEditing(null); await onRosterChanged(); }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className="space-y-2">
            {managers.map((m) => {
              const active = m.id === selectedId;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                    active ? "border-brand-azure bg-brand-azure/5" : "border-border hover:bg-muted/30",
                  )}
                >
                  <Avatar m={m} />
                  <button type="button" className="flex-1 min-w-0 text-left" onClick={() => { onAssign(m.id); onOpenChange(false); }}>
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {[m.title, m.email, m.phone].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </button>
                  {active && <Check className="h-4 w-4 text-brand-azure shrink-0" />}
                  <button type="button" onClick={() => setEditing(m)} className="text-muted-foreground hover:text-foreground p-1" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {managers.length === 0 && <p className="text-sm text-muted-foreground italic px-1">No managers yet.</p>}
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => onAssign(null)} className="text-xs text-muted-foreground hover:text-brand-coral">
                Clear from this deal
              </button>
              <Button size="sm" variant="outline" onClick={() => setEditing("new")} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add manager
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ManagerForm({
  manager,
  onDone,
  onCancel,
}: {
  manager: Manager | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(manager?.name ?? "");
  const [title, setTitle] = useState(manager?.title ?? "");
  const [email, setEmail] = useState(manager?.email ?? "");
  const [phone, setPhone] = useState(manager?.phone ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(manager?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPhoto(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `managers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: false });
    setUploading(false);
    if (error) { toast.error(`Upload failed: ${error.message}`); return; }
    setPhotoUrl(supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
  }

  async function save() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const patch = {
      name: name.trim(),
      title: title.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    };
    const { error } = manager
      ? await dispo.from("dispo_managers").update(patch).eq("id", manager.id)
      : await dispo.from("dispo_managers").insert(patch);
    setSaving(false);
    if (error) { toast.error(`Couldn't save: ${error.message}`); return; }
    toast.success(manager ? "Manager updated" : "Manager added");
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="h-16 w-16 rounded-full bg-brand-mint/20 text-brand-mint-deep grid place-items-center text-xl font-semibold">
            {initials(name) || <UserRound className="h-6 w-6" />}
          </span>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onPhoto(f); }} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {photoUrl ? "Replace photo" : "Upload photo"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="crm-field-label">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label className="crm-field-label">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dispositions Manager" /></div>
        <div className="space-y-1"><Label className="crm-field-label">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label className="crm-field-label">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}

export default DispoManagerField;
