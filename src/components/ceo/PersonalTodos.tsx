import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type Todo = {
  id: string;
  title: string;
  is_complete: boolean;
  position: number;
};

export function PersonalTodos() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await sb
      .from("personal_todos")
      .select("id, title, is_complete, position")
      .eq("user_id", user.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (data) setTodos(data);
  };

  useEffect(() => { load(); }, [user]);

  const addTodo = async () => {
    const title = draft.trim();
    if (!title || !user) return;
    const position = todos.length;
    const { data } = await sb
      .from("personal_todos")
      .insert({ user_id: user.id, title, position })
      .select()
      .single();
    if (data) setTodos((prev) => [...prev, data]);
    setDraft("");
    setAdding(false);
  };

  const toggle = async (id: string, current: boolean) => {
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, is_complete: !current } : t));
    await sb.from("personal_todos").update({ is_complete: !current }).eq("id", id);
  };

  const remove = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    await sb.from("personal_todos").delete().eq("id", id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addTodo();
    if (e.key === "Escape") { setAdding(false); setDraft(""); }
  };

  const open = todos.filter((t) => !t.is_complete);
  const done = todos.filter((t) => t.is_complete);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-5 elevation-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Personal To-Dos</h3>
        <button
          onClick={() => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      <div className="space-y-1.5">
        {open.map((todo) => (
          <TodoRow key={todo.id} todo={todo} onToggle={toggle} onRemove={remove} />
        ))}

        {adding && (
          <div className="flex items-center gap-2 py-1">
            <div className="h-4 w-4 rounded border border-border/60 shrink-0" />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (!draft.trim()) { setAdding(false); } }}
              placeholder="New to-do..."
              className="flex-1 bg-transparent text-sm text-foreground border-none outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        )}

        {open.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground/50 italic py-1">
            Nothing here — click Add to get started.
          </p>
        )}

        {done.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground/50 cursor-pointer select-none">
              {done.length} completed
            </summary>
            <div className="space-y-1.5 mt-1.5">
              {done.map((todo) => (
                <TodoRow key={todo.id} todo={todo} onToggle={toggle} onRemove={remove} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function TodoRow({ todo, onToggle, onRemove }: {
  todo: Todo;
  onToggle: (id: string, current: boolean) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 group py-0.5">
      <button
        onClick={() => onToggle(todo.id, todo.is_complete)}
        className={cn(
          "h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors",
          todo.is_complete
            ? "bg-primary/20 border-primary/40"
            : "border-border/60 hover:border-primary/50"
        )}
      >
        {todo.is_complete && <Check className="h-2.5 w-2.5 text-primary" />}
      </button>
      <span className={cn(
        "flex-1 text-sm leading-snug",
        todo.is_complete ? "line-through text-muted-foreground/50" : "text-foreground"
      )}>
        {todo.title}
      </span>
      <button
        onClick={() => onRemove(todo.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
