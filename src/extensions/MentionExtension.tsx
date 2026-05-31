// Universal @mention extension for TipTap.
// On `@`, opens a popover that searches across people, docs, notes, tasks, projects,
// goals, and database records via the `universal-search` edge function.
// Inserts a styled mention chip linking to the entity.
import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, FileText, StickyNote, CheckSquare, Folder, Target, Database, Sparkles } from "lucide-react";

interface Hit {
  id: string;
  type: "person" | "doc" | "note" | "task" | "project" | "goal" | "record" | "albus";
  title: string;
  subtitle?: string;
  url: string;
}

const ICONS: Record<Hit["type"], any> = {
  person: User,
  doc: FileText,
  note: StickyNote,
  task: CheckSquare,
  project: Folder,
  goal: Target,
  record: Database,
  albus: Sparkles,
};

interface ListProps {
  items: Hit[];
  command: (item: { id: string; label: string; type: string; url: string }) => void;
}

const MentionList = forwardRef<{ onKeyDown: (p: { event: KeyboardEvent }) => boolean }, ListProps>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0);

    useEffect(() => setSelected(0), [items]);

    const select = (i: number) => {
      const item = items[i];
      if (item) command({ id: item.id, label: item.title, type: item.type, url: item.url });
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") { setSelected((s) => (s + items.length - 1) % items.length); return true; }
        if (event.key === "ArrowDown") { setSelected((s) => (s + 1) % items.length); return true; }
        if (event.key === "Enter") { select(selected); return true; }
        return false;
      },
    }));

    if (!items.length) {
      return <div className="rounded-md border bg-popover shadow-lg p-2 text-xs text-muted-foreground">No matches</div>;
    }

    return (
      <div className="rounded-md border bg-popover shadow-lg p-1 max-h-72 overflow-y-auto w-72">
        {items.map((it, i) => {
          const Icon = ICONS[it.type];
          return (
            <button
              key={`${it.type}-${it.id}`}
              onClick={() => select(i)}
              onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm ${i === selected ? "bg-accent" : "hover:bg-accent/50"}`}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.title}</div>
                {it.subtitle && <div className="text-[10px] text-muted-foreground truncate">{it.subtitle}</div>}
              </div>
              <span className="text-[9px] uppercase text-muted-foreground tracking-wider shrink-0">{it.type}</span>
            </button>
          );
        })}
      </div>
    );
  },
);
MentionList.displayName = "MentionList";

const renderItems = () => {
  let component: ReactRenderer | null = null;
  let popup: TippyInstance[] | null = null;

  return {
    onStart: (props: any) => {
      component = new ReactRenderer(MentionList, { props, editor: props.editor });
      if (!props.clientRect) return;
      // Mount inside the nearest Radix Dialog/Sheet content if there is one —
      // otherwise Radix's pointer-events: none lockdown on the body blocks
      // clicks/hovers on the dropdown. Falls back to body when not in a dialog.
      const editorEl: HTMLElement | undefined = props.editor?.options?.element;
      const dialogContent =
        editorEl?.closest('[role="dialog"]') as HTMLElement | null
        ?? editorEl?.closest('[data-radix-popper-content-wrapper]') as HTMLElement | null
        ?? null;
      const mountTarget = dialogContent ?? document.body;
      popup = tippy("body", {
        getReferenceClientRect: props.clientRect,
        appendTo: () => mountTarget,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start",
        zIndex: 99999,
      });
    },
    onUpdate: (props: any) => {
      component?.updateProps(props);
      if (props.clientRect) popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect });
    },
    onKeyDown: (props: any) => {
      if (props.event.key === "Escape") { popup?.[0]?.hide(); return true; }
      return (component?.ref as any)?.onKeyDown(props) ?? false;
    },
    onExit: () => { popup?.[0]?.destroy(); component?.destroy(); },
  };
};

export const UniversalMention = Mention.extend({
  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
      type: { default: null },
      url: { default: null },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    // Render as a span (NOT an anchor) so the browser can never natively navigate.
    // The global MentionClickHandler reads data-url and routes via React Router.
    return [
      "span",
      {
        ...HTMLAttributes,
        role: "button",
        tabindex: "0",
        "data-type": "mention",
        "data-mention-type": node.attrs.type,
        "data-mention-id": node.attrs.id,
        "data-url": node.attrs.url || "",
        class: "mention-chip",
      },
      `@${node.attrs.label}`,
    ];
  },
}).configure({
  HTMLAttributes: { class: "mention-chip" },
  suggestion: {
    char: "@",
    items: async ({ query }: { query: string }) => {
      // Always offer Albus (AI assistant) as a synthetic top hit when the
      // query is empty or starts with "alb". When inserted as a mention,
      // surfaces consuming code can route based on type === "albus".
      const q = (query || "").toLowerCase();
      const albusHit: Hit = {
        id: "albus",
        type: "albus" as any,
        title: "Albus",
        subtitle: "AI assistant",
        url: "",
      };
      const showAlbus = !q || "albus".startsWith(q) || q.startsWith("al");

      try {
        const { data } = await supabase.functions.invoke(`universal-search?q=${encodeURIComponent(query)}&limit=8`, { method: "GET" } as any);
        const hits = (data?.hits ?? []) as Hit[];
        return showAlbus ? [albusHit, ...hits] : hits;
      } catch {
        return showAlbus ? [albusHit] : [];
      }
    },
    render: renderItems,
    command: ({ editor, range, props }: any) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: "mention", attrs: { id: props.id, label: props.label, type: props.type, url: props.url } },
          { type: "text", text: " " },
        ])
        .run();
    },
  },
});
