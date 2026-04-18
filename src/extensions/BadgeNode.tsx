import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info, AlertTriangle, CheckCircle, Lightbulb, HelpCircle, Star, Flag, FileText } from "lucide-react";

export const BADGE_PRESETS = [
  { key: "info", label: "Info", emoji: "ℹ️", color: "210 100% 50%", Icon: Info },
  { key: "note", label: "Note", emoji: "📝", color: "220 15% 45%", Icon: FileText },
  { key: "warning", label: "Warning", emoji: "⚠️", color: "38 92% 50%", Icon: AlertTriangle },
  { key: "success", label: "Success", emoji: "✅", color: "142 71% 45%", Icon: CheckCircle },
  { key: "idea", label: "Idea", emoji: "💡", color: "48 96% 53%", Icon: Lightbulb },
  { key: "question", label: "Question", emoji: "❓", color: "262 83% 58%", Icon: HelpCircle },
  { key: "important", label: "Important", emoji: "⭐", color: "350 89% 60%", Icon: Star },
  { key: "todo", label: "TODO", emoji: "🚩", color: "20 90% 55%", Icon: Flag },
];

const COLOR_SWATCHES = [
  "210 100% 50%", "220 15% 45%", "38 92% 50%", "142 71% 45%",
  "48 96% 53%", "262 83% 58%", "350 89% 60%", "20 90% 55%",
  "180 70% 45%", "300 70% 55%",
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    badge: {
      setBadge: (attrs?: { preset?: string; emoji?: string; color?: string }) => ReturnType;
    };
  }
}

function BadgeView({ node, updateAttributes, editor }: any) {
  const [open, setOpen] = useState(false);
  const { preset, emoji, color } = node.attrs;
  const editable = editor?.isEditable;

  const displayEmoji = emoji || BADGE_PRESETS.find(p => p.key === preset)?.emoji || "📝";
  const displayColor = color || BADGE_PRESETS.find(p => p.key === preset)?.color || "220 15% 45%";

  return (
    <NodeViewWrapper
      as="div"
      className="badge-block"
      style={{
        borderLeftColor: `hsl(${displayColor})`,
        background: `hsl(${displayColor} / 0.08)`,
      }}
      data-preset={preset}
    >
      <Popover open={open} onOpenChange={(v) => editable && setOpen(v)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            contentEditable={false}
            className="badge-emoji-btn"
            title={editable ? "Customize badge" : ""}
            onClick={(e) => { e.preventDefault(); if (editable) setOpen(true); }}
          >
            <span className="badge-emoji">{displayEmoji}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start" onOpenAutoFocus={e => e.preventDefault()}>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Type</p>
              <div className="grid grid-cols-4 gap-1">
                {BADGE_PRESETS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => updateAttributes({ preset: p.key, emoji: p.emoji, color: p.color })}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-md hover:bg-accent text-[10px] ${preset === p.key ? "bg-accent" : ""}`}
                  >
                    <span className="text-base leading-none">{p.emoji}</span>
                    <span className="text-muted-foreground">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Custom emoji</p>
              <input
                type="text"
                maxLength={4}
                value={emoji || ""}
                onChange={(e) => updateAttributes({ emoji: e.target.value, preset: "custom" })}
                className="w-16 px-2 py-1 text-base text-center rounded-md border border-border bg-background"
                placeholder="🚀"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Color</p>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_SWATCHES.map(c => (
                  <button
                    key={c}
                    onClick={() => updateAttributes({ color: c })}
                    className={`h-5 w-5 rounded-full border-2 transition ${displayColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: `hsl(${c})` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <NodeViewContent className="badge-content" />
    </NodeViewWrapper>
  );
}

const Badge = Node.create({
  name: "badge",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      preset: {
        default: "note",
        parseHTML: (el) => el.getAttribute("data-badge-preset") || "note",
        renderHTML: (attrs) => ({ "data-badge-preset": attrs.preset }),
      },
      emoji: {
        default: "📝",
        parseHTML: (el) => el.getAttribute("data-badge-emoji") || "📝",
        renderHTML: (attrs) => ({ "data-badge-emoji": attrs.emoji }),
      },
      color: {
        default: "220 15% 45%",
        parseHTML: (el) => el.getAttribute("data-badge-color") || "220 15% 45%",
        renderHTML: (attrs) => ({ "data-badge-color": attrs.color }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-badge-preset]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "badge-block",
        style: `border-left-color: hsl(${node.attrs.color}); background: hsl(${node.attrs.color} / 0.08);`,
      }),
      ["span", { class: "badge-emoji", contenteditable: "false" }, node.attrs.emoji],
      ["div", { class: "badge-content" }, 0],
    ];
  },

  addCommands() {
    return {
      setBadge:
        (attrs) =>
        ({ commands }) => {
          const preset = BADGE_PRESETS.find(p => p.key === (attrs?.preset || "note"));
          return commands.wrapIn(this.name, {
            preset: attrs?.preset || "note",
            emoji: attrs?.emoji || preset?.emoji || "📝",
            color: attrs?.color || preset?.color || "220 15% 45%",
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(BadgeView);
  },
});

export default Badge;
