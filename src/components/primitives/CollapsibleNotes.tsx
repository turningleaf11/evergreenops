// CollapsibleNotes — a height-capped RichTextEditor with an Expand/Collapse
// toggle. Use this instead of dropping <RichTextEditor> directly into any
// stacked/scrolling surface (a peek, a detail page's Overview section, a
// drawer) — an empty or short editor with no height cap still renders at
// full size, creating dead white space and pushing whatever's below it out
// of view. This bug shipped twice (Task Page, then Project Overview)
// before being fixed here once, structurally, instead of per call site.
// Ported from autumn-design-system/src/components/primitives/CollapsibleNotes.tsx.
//
// Tabbed surfaces (Notes as its own tab, like Task Peek) don't need this —
// the tab boundary already caps the scroll area. This is specifically for
// Notes living inline among other sections.

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Section label. Default: "Notes". */
  label?: string;
  /** Max height (px) while collapsed. Default: 140. */
  collapsedHeight?: number;
  /** Max height (px) while expanded. Default: 480. */
  expandedHeight?: number;
  defaultExpanded?: boolean;
  className?: string;
}

export function CollapsibleNotes({
  content,
  onChange,
  placeholder = "Write notes, plans, context…",
  label = "Notes",
  collapsedHeight = 140,
  expandedHeight = 480,
  defaultExpanded = false,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={cn("rounded-xl border border-border/50 bg-card/40 p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h4>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Collapse" : "Expand"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      <div
        className="overflow-y-auto transition-[max-height] duration-200"
        style={{ maxHeight: expanded ? expandedHeight : collapsedHeight }}
      >
        <RichTextEditor content={content} onChange={onChange} placeholder={placeholder} borderless />
      </div>
    </div>
  );
}
