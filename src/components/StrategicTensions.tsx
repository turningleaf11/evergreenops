import { useState } from "react";
import { useCEOContext } from "@/lib/ceo-context";
import { Plus, X, ArrowLeftRight } from "lucide-react";

export function StrategicTensions() {
  const { data, addTension, removeTension } = useCEOContext();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ tension: "", sideA: "", sideB: "" });

  const handleAdd = () => {
    if (!form.tension.trim()) return;
    addTension(form.tension.trim(), form.sideA.trim(), form.sideB.trim());
    setForm({ tension: "", sideA: "", sideB: "" });
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      {data.strategicTensions.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground italic">No tensions tracked. These are strategic dualities you're holding — no resolution needed.</p>
      )}

      {data.strategicTensions.map((t) => (
        <div key={t.id} className="group rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{t.tension}</span>
            <button onClick={() => removeTension(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-muted">{t.sideA}</span>
            <ArrowLeftRight className="h-3 w-3 shrink-0" />
            <span className="px-2 py-0.5 rounded bg-muted">{t.sideB}</span>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <input
            value={form.tension}
            onChange={(e) => setForm({ ...form, tension: e.target.value })}
            placeholder="Name this tension..."
            className="w-full bg-transparent text-sm border-none outline-none placeholder:text-muted-foreground/50"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <input
              value={form.sideA}
              onChange={(e) => setForm({ ...form, sideA: e.target.value })}
              placeholder="Side A"
              className="flex-1 bg-muted rounded px-2 py-1 text-xs border-none outline-none placeholder:text-muted-foreground/40"
            />
            <ArrowLeftRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <input
              value={form.sideB}
              onChange={(e) => setForm({ ...form, sideB: e.target.value })}
              placeholder="Side B"
              className="flex-1 bg-muted rounded px-2 py-1 text-xs border-none outline-none placeholder:text-muted-foreground/40"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} className="text-xs text-primary hover:underline">Save</button>
            <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add tension
        </button>
      )}
    </div>
  );
}
