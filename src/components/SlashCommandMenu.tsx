import { Extension } from "@tiptap/core";
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Code2,
  Image as ImageIcon,
  Paperclip,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TableIcon,
  ChevronRight,
  Sparkles,
  ListChecks as ListChecksIcon,
  FileText as FileTextIcon,
} from "lucide-react";
import { uploadFile, triggerFileInput } from "@/lib/file-upload";
import { toast } from "sonner";

const NOTES_AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notes-ai`;

async function runNotesAi(editor: any, action: "plan" | "tasks" | "summarize") {
  // Pull plain text from the editor for grounding
  const text = (editor?.getText?.() || "").trim();
  // Insert a header so the user sees something happen immediately
  const headerByAction: Record<string, string> = {
    plan: "AI plan",
    tasks: "AI-generated tasks",
    summarize: "AI summary",
  };
  editor.chain().focus().insertContent(`\n\n**${headerByAction[action]}**\n\n`).run();
  try {
    const resp = await fetch(NOTES_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ action, text }),
    });
    if (!resp.ok) {
      if (resp.status === 429) toast.error("AI rate limit hit. Try again shortly.");
      else if (resp.status === 402) toast.error("AI credits exhausted.");
      else toast.error("AI request failed.");
      return;
    }
    if (!resp.body) return;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;
    while (!done) {
      const { done: d, value } = await reader.read();
      if (d) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") { done = true; break; }
        try {
          const parsed = JSON.parse(json);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) editor.chain().focus().insertContent(delta).run();
        } catch { /* ignore */ }
      }
    }
  } catch (e: any) {
    toast.error(e?.message || "AI request failed");
  }
}

interface CommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: any; range: any }) => void;
}

const getSuggestionItems = (): CommandItem[] => [
  {
    title: "Text",
    description: "Plain paragraph",
    icon: <Type className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: "Heading 1",
    description: "Large heading",
    icon: <Heading1 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium heading",
    icon: <Heading2 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small heading",
    icon: <Heading3 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Unordered list",
    icon: <List className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Ordered list",
    icon: <ListOrdered className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Checklist",
    description: "Task list with checkboxes",
    icon: <ListChecks className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Blockquote",
    description: "Indented quote",
    icon: <Quote className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Badge",
    description: "Highlighted note — pick a type, emoji & color",
    icon: <Info className="h-4 w-4 text-primary" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range)
        .insertContent({
          type: "badge",
          attrs: { preset: "note", emoji: "📝", color: "220 15% 45%" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Note: " }] }],
        })
        .run();
    },
  },
  {
    title: "Code Block",
    description: "Syntax-highlighted code",
    icon: <Code2 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    icon: <Minus className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Table",
    description: "Insert a simple table",
    icon: <TableIcon className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: "Toggle List",
    description: "Collapsible content block",
    icon: <ChevronRight className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(
        `<details><summary>Toggle heading</summary><p>Hidden content</p></details>`
      ).run();
    },
  },
  {
    title: "Image",
    description: "Upload an image",
    icon: <ImageIcon className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      triggerFileInput("image/*", async (file) => {
        const url = await uploadFile(file);
        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      });
    },
  },
  {
    title: "File Attachment",
    description: "Upload and attach a file",
    icon: <Paperclip className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      triggerFileInput("*", async (file) => {
        const url = await uploadFile(file);
        if (url) {
          editor.chain().focus().insertContent(
            `<p><a href="${url}" target="_blank" rel="noopener noreferrer" class="file-attachment">📎 ${file.name}</a></p>`
          ).run();
        }
      });
    },
  },
  // AI actions — at the end of the menu
  {
    title: "AI: Plan",
    description: "Turn these notes into a phased plan",
    icon: <Sparkles className="h-4 w-4 text-primary" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      runNotesAi(editor, "plan");
    },
  },
  {
    title: "AI: Extract tasks",
    description: "Pull a checklist of action items from notes",
    icon: <ListChecksIcon className="h-4 w-4 text-primary" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      runNotesAi(editor, "tasks");
    },
  },
  {
    title: "AI: Summarize",
    description: "Tight summary of these notes",
    icon: <FileTextIcon className="h-4 w-4 text-primary" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      runNotesAi(editor, "summarize");
    },
  },
];

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className="slash-menu">
          <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>
        </div>
      );
    }

    return (
      <div className="slash-menu">
        {items.map((item, index) => (
          <button
            key={item.title}
            className={`slash-menu-item ${index === selectedIndex ? "is-selected" : ""}`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="slash-menu-icon">{item.icon}</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

CommandList.displayName = "CommandList";

const renderItems = () => {
  let component: ReactRenderer<CommandListRef> | null = null;
  let popup: TippyInstance[] | null = null;

  return {
    onStart: (props: SuggestionProps) => {
      component = new ReactRenderer(CommandList, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) return;

      popup = tippy("body", {
        getReferenceClientRect: props.clientRect as () => DOMRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start",
      });
    },
    onUpdate: (props: SuggestionProps) => {
      component?.updateProps(props);
      if (props.clientRect) {
        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      }
    },
    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === "Escape") {
        popup?.[0]?.hide();
        return true;
      }
      return component?.ref?.onKeyDown(props) ?? false;
    },
    onExit: () => {
      popup?.[0]?.destroy();
      component?.destroy();
    },
  };
};

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: { editor: any; range: any; props: CommandItem }) => {
          props.command({ editor, range });
        },
        items: ({ query }: { query: string }) => {
          return getSuggestionItems().filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase())
          );
        },
        render: renderItems,
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
