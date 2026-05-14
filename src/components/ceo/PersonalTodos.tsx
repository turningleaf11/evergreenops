import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MentionInput, MentionChips, type MentionRef } from "./MentionInput";

const sb = supabase as any;

type Todo = {
  id: string;
  title: string;
  is_complete: boolean;
  position: number;
  mentions: MentionRef[];
};

export function PersonalTodos() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState("");
  const [draftMentions, setDraftMentions] = useState<MentionRef[]>([]);
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await sb
      .from("personal_todos")
      .select("id, title, is_complete, position, mentions")
      .eq("user_id", user.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (data) {
      setTodos(data.map((t: any) => ({
        ...t,
        mentions: Array.isArray(t.mentions) ? t.mentions : [],
      })));
    }
  };

  useEffect(() => { load(); }, [user]);

  const addTodo = async () => {
    const title = draft.trim();
    if (!title || !user) return;
    const position = todos.length;
    const { data } = await sb
      .from("personal_todos")
      .insert({ user_id: user.id, title, position, mentions: draftMentions })
      .select()
      .single();
    if (data) {
      setTodos((prev) => [...prev, { ...data, mentions: Array.isArray(data.mentions) ? data.mentions : [] }]);
    }
    setDraft("");
    setDraftMentions([]);
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

  const updateTodo = async (id: string, title: string, mentions: MentionRef[]) => {
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, title, mentions } : t));
    await sb.from("personal_todos").update({ title, mentions }).eq("id", id);
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addTodo();
    if (e.key === "Escape") { setAdding(false); setDraft(""); setDraftMentions([]); }
  };

  const open = todos.filter((t) => !t.is_complete);
  const done = todos.filter((t) => t.is_complete);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-5 elevation-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">To Do</h3>
        <button
          onClick={() => { setAdding(true); setTimeout(() => addInputRef.current?.focus(), 50); }}
          className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      <div className="space-y-1.5">
        {open.map((todo) => (
          <TodoRow key={todo.id} todo={todo} onToggle={toggle} onRemove={remove} onUpdate={updateTodo} />
        ))}

        {adding && (
          <div className="flex items-start gap-2 py-1">
            <div className="h-4 w-4 rounded border border-border/60 shrink-0 mt-1.5" />
            <MentionInput
              value={draft}
              onChange={setDraft}
              mentions={draftMentions}
              onMentionsChange={setDraftMentions}
              placeholder="New to-do… type @ to link an item"
              onKeyDown={handleAddKeyDown as any}
              inputRef={addInputRef}
              autoFocus
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
                <TodoRow key={todo.id} todo={todo} onToggle={toggle} onRemove={remove} onUpdate={updateTodo} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function TodoRow({
  todo,
  onToggle,
  onRemove,
  onUpdate,
}: {
  todo: Todo;
  onToggle: (id: string, current: boolean) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, title: string, mentions: MentionRef[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [editMentions, setEditMentions] = useState<MentionRef[]>(todo.mentions);

  const save = () => {
    const trimmed = editTitle.trim();
    if (trimmed) onUpdate(todo.id, trimmed, editMentions);
    else { setEditTitle(todo.title); setEditMentions(todo.mentions); }
    setEditing(false);
  };

  const cancel = () => {
    setEditTitle(todo.title);
    setEditMentions(todo.mentions);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-start gap-2 py-0.5">
        <button
          onClick={() => onToggle(todo.id, todo.is_complete)}
          className="h-4 w-4 rounded border border-border/60 shrink-0 mt-1.5 flex items-center justify-center"
        />
        <MentionInput
          value={editTitle}
          onChange={setEditTitle}
          mentions={editMentions}
          onMentionsChange={setEditMentions}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="flex-1 bg-transparent text-sm text-foreground border-b border-border/50 outline-none py-1 placeholder:text-muted-foreground/40"
          placeholder="Edit to-do…"
        />
        <button onClick={save} className="text-primary/70 hover:text-primary mt-1.5 shrink-0">
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 group py-0.5">
      <button
        onClick={() => onToggle(todo.id, todo.is_complete)}
        className={cn(
          "h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors mt-0.5",
          todo.is_complete
            ? "bg-primary/20 border-primary/40"
            : "border-border/60 hover:border-primary/50",
        )}
      >
        {todo.is_complete && <Check className="h-2.5 w-2.5 text-primary" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            onClick={() => { if (!todo.is_complete) setEditing(true); }}
            className={cn(
              "flex-1 text-sm leading-snug",
              todo.is_complete ? "line-through text-muted-foreground/50" : "text-foreground cursor-text",
            )}
          >
            {todo.title}
          </span>
          <button
            onClick={() => onRemove(todo.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        {!todo.is_complete && todo.mentions.length > 0 && (
          <MentionChips
            mentions={todo.mentions}
            onRemove={(id) => onUpdate(todo.id, todo.title, todo.mentions.filter((m) => m.id !== id))}
          />
        )}
      </div>
    </div>
  );
}
