import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, HelpCircle, Search, Mail, Plus, Pencil, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsDeveloperWorkspace, SUPPORT_EMAIL } from "@/lib/developer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  body_md: string;
  published: boolean;
  sort_order: number;
}

const DEFAULT_CATEGORY = "General";

export default function HelpPage() {
  const { isPrimaryAdmin } = useAuth();
  const isDevWorkspace = useIsDeveloperWorkspace();
  const canEdit = isPrimaryAdmin && isDevWorkspace;

  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<HelpArticle | null>(null);

  const load = async () => {
    setLoading(true);
    const query = supabase.from("help_articles").select("*").order("sort_order").order("title");
    const { data } = canEdit ? await query : await query.eq("published", true);
    setArticles((data ?? []) as HelpArticle[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.body_md.toLowerCase().includes(q) ||
        (a.category ?? "").toLowerCase().includes(q),
    );
  }, [articles, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, HelpArticle[]>();
    for (const a of filtered) {
      const cat = a.category || DEFAULT_CATEGORY;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(a);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const selected = articles.find((a) => a.id === selectedId) ?? filtered[0] ?? null;
  useEffect(() => {
    if (!selectedId && filtered[0]) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const startNew = () => {
    setEditing({
      id: "",
      slug: "",
      title: "",
      category: DEFAULT_CATEGORY,
      body_md: "",
      published: true,
      sort_order: 100,
    });
  };

  const saveArticle = async () => {
    if (!editing) return;
    const slug =
      editing.slug ||
      editing.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    const payload = { ...editing, slug };
    const { error } = editing.id
      ? await supabase.from("help_articles").update(payload).eq("id", editing.id)
      : await supabase.from("help_articles").insert({ ...payload, id: undefined } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Article saved");
    setEditing(null);
    load();
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    const { error } = await supabase.from("help_articles").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (selectedId === id) setSelectedId(null);
    load();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Link to="/" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
      </Link>

      <div className="flex items-center justify-between mt-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Help & documentation</h1>
            <p className="text-sm text-muted-foreground">Learn how to get the most out of the platform.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={`mailto:${SUPPORT_EMAIL}`}>
            <Button variant="outline" size="sm">
              <Mail className="h-3.5 w-3.5 mr-1.5" /> Contact support
            </Button>
          </a>
          {canEdit && (
            <Button size="sm" onClick={startNew}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New article
            </Button>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search articles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
        <aside className="space-y-4">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : grouped.length === 0 ? (
            <p className="text-xs text-muted-foreground">No articles yet.</p>
          ) : (
            grouped.map(([cat, items]) => (
              <div key={cat}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-2">
                  {cat}
                </div>
                <div className="space-y-0.5">
                  {items.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors",
                        selected?.id === a.id
                          ? "bg-primary/10 text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {a.title}
                      {!a.published && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground/70">(draft)</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </aside>

        <Card>
          <CardContent className="p-6">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select an article to read.</p>
            ) : (
              <article>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="text-2xl font-semibold">{selected.title}</h2>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(selected)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteArticle(selected.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                  {selected.body_md}
                </pre>
              </article>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit article" : "New article"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Input
                placeholder="Title"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
              <Input
                placeholder="Category"
                value={editing.category ?? ""}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              />
              <Input
                placeholder="Slug (auto-generated if empty)"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
              />
              <Textarea
                placeholder="Markdown content…"
                value={editing.body_md}
                onChange={(e) => setEditing({ ...editing, body_md: e.target.value })}
                rows={14}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                />
                Published
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveArticle}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
