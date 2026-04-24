import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  FileText,
  ListTodo,
  FolderKanban,
  User,
  Megaphone,
  X,
  UserSquare2,
  Briefcase,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type:
    | "task"
    | "project"
    | "document"
    | "profile"
    | "announcement"
    | "contact"
    | "deal"
    | "company";
}

const typeConfig = {
  task: { icon: ListTodo, label: "Tasks", path: (id: string) => `/tasks/${id}` },
  project: { icon: FolderKanban, label: "Projects", path: (id: string) => `/projects/${id}` },
  document: { icon: FileText, label: "Documents", path: () => `/docs` },
  profile: { icon: User, label: "People", path: () => `/people` },
  announcement: { icon: Megaphone, label: "Announcements", path: () => `/feed` },
  contact: { icon: UserSquare2, label: "Contacts", path: () => `/crm/contacts` },
  deal: { icon: Briefcase, label: "Deals", path: () => `/crm/deals` },
  company: { icon: Building2, label: "Companies", path: () => `/crm/companies` },
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    const pattern = `%${q}%`;
    const [tasks, projects, docs, profiles, announcements, contacts, deals, companies] = await Promise.all([
      supabase.from("tasks").select("id, title").ilike("title", pattern).limit(5),
      supabase.from("projects").select("id, title").ilike("title", pattern).limit(5),
      supabase.from("documents").select("id, title").ilike("title", pattern).limit(5),
      supabase.from("profiles").select("user_id, full_name").ilike("full_name", pattern).limit(5),
      supabase.from("announcements").select("id, title").ilike("title", pattern).limit(5),
      supabase.from("contacts").select("id, first_name, last_name, email").or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`).limit(5),
      supabase.from("deals").select("id, title, status").ilike("title", pattern).limit(5),
      supabase.from("companies").select("id, name, industry").ilike("name", pattern).limit(5),
    ]);
    const r: SearchResult[] = [
      ...(tasks.data || []).map((t) => ({ id: t.id, title: t.title, type: "task" as const })),
      ...(projects.data || []).map((p) => ({ id: p.id, title: p.title, type: "project" as const })),
      ...(docs.data || []).map((d) => ({ id: d.id, title: d.title, type: "document" as const })),
      ...(profiles.data || []).map((p) => ({ id: p.user_id, title: p.full_name || "Unnamed", type: "profile" as const })),
      ...(announcements.data || []).map((a) => ({ id: a.id, title: a.title, type: "announcement" as const })),
      ...(contacts.data || []).map((c: any) => ({ id: c.id, title: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Contact", subtitle: c.email || undefined, type: "contact" as const })),
      ...(deals.data || []).map((d: any) => ({ id: d.id, title: d.title, subtitle: d.status, type: "deal" as const })),
      ...(companies.data || []).map((c: any) => ({ id: c.id, title: c.name, subtitle: c.industry || undefined, type: "company" as const })),
    ];
    setResults(r);
    setOpen(r.length > 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (r: SearchResult) => {
    navigate(typeConfig[r.type].path(r.id));
    setQuery("");
    setOpen(false);
  };

  const grouped = Object.entries(
    results.reduce<Record<string, SearchResult[]>>((acc, r) => {
      (acc[r.type] = acc[r.type] || []).push(r);
      return acc;
    }, {})
  );

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setQuery(""); } }}
        placeholder="Search..."
        className="w-full h-8 rounded-full bg-muted/50 pl-9 pr-8 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors border-0"
      />
      {query && (
        <button onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2">
          <X className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground" />
        </button>
      )}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto">
          {grouped.map(([type, items]) => {
            const cfg = typeConfig[type as keyof typeof typeConfig];
            const Icon = cfg.icon;
            return (
              <div key={type}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                  {cfg.label}
                </div>
                {items.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                    <span className="truncate flex-1">{r.title}</span>
                    {r.subtitle && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[40%]">
                        {r.subtitle}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>}
        </div>
      )}
    </div>
  );
}
