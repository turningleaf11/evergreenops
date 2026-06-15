import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Callout from "@/extensions/CalloutNode";
import Badge from "@/extensions/BadgeNode";
import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { SlashCommands } from "@/components/SlashCommandMenu";
import { UniversalMention } from "@/extensions/MentionExtension";
import { uploadFile } from "@/lib/file-upload";
import { Plugin } from "@tiptap/pm/state";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Link as LinkIcon, Palette, Plus, GripVertical, List, ListOrdered, CheckSquare, Quote,
} from "lucide-react";
import DragHandle from "@tiptap/extension-drag-handle-react";
import "./RichTextEditor.css";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  borderless?: boolean;
  compact?: boolean;
  /** Override the editor's min-height (e.g. "220px") */
  minHeight?: string;
  /** Show a permanent top toolbar above the editor (for surfaces without their own chrome) */
  showToolbar?: boolean;
}

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#9333ea" },
  { label: "Pink", value: "#db2777" },
];

function createImageUploadPlugin() {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              uploadFile(file).then((url) => {
                if (url) {
                  const { schema } = view.state;
                  const node = schema.nodes.image.create({ src: url });
                  const tr = view.state.tr.replaceSelectionWith(node);
                  view.dispatch(tr);
                }
              });
            }
            return true;
          }
        }
        return false;
      },
      handleDrop(view, event) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const file = files[0];
        if (file.type.startsWith("image/")) {
          event.preventDefault();
          const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
          uploadFile(file).then((url) => {
            if (url && coordinates) {
              const { schema } = view.state;
              const node = schema.nodes.image.create({ src: url });
              const tr = view.state.tr.insert(coordinates.pos, node);
              view.dispatch(tr);
            }
          });
          return true;
        }
        return false;
      },
    },
  });
}

export default function RichTextEditor({ content, onChange, placeholder = "Type '/' for commands...", borderless = false, compact = false, minHeight, showToolbar = false }: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const isInternalChange = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        dropcursor: { color: "hsl(var(--primary))", width: 3 },
      }) as any,
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Callout,
      Badge,
      SlashCommands,
      UniversalMention,
      Extension.create({
        name: "imageUpload",
        addProseMirrorPlugins() {
          return [createImageUploadPlugin()];
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      isInternalChange.current = true;
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none focus:outline-none" },
    },
  });

  // Sync external `content` changes into the editor (e.g. async-loaded
  // signature, template insertion). Skip changes that came from the
  // editor itself to avoid clobbering the user's caret/selection.
  useEffect(() => {
    if (!editor) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const current = editor.getHTML();
    if (current === content) return;
    editor.commands.setContent(content || "", { emitUpdate: false });
  }, [content, editor]);

  // Click below the editor content focuses cursor at the end (Notion-style)
  const handleSurfaceClick = (e: React.MouseEvent) => {
    if (!editor) return;
    const target = e.target as HTMLElement;
    // Only when clicking the wrapper itself, not nested content
    if (target.closest(".ProseMirror")) return;
    editor.chain().focus("end").run();
  };

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rich-editor bg-background",
        !borderless && "border rounded-lg",
        borderless && !compact && "rich-editor-borderless",
        compact && "rich-editor-compact"
      )}
      onClick={handleSurfaceClick}
    >
      {/* Fixed top toolbar — opt-in for surfaces without their own chrome */}
      {showToolbar && (
        <div className="flex items-center gap-0.5 flex-wrap border-b border-border/40 px-2 py-1.5 bg-muted/30 rounded-t-lg">
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={cn("toolbar-btn text-[11px] font-bold px-1.5", editor.isActive("heading", { level: 1 }) && "is-active")} title="Heading 1">H1</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cn("toolbar-btn text-[11px] font-bold px-1.5", editor.isActive("heading", { level: 2 }) && "is-active")} title="Heading 2">H2</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={cn("toolbar-btn text-[11px] font-bold px-1.5", editor.isActive("heading", { level: 3 }) && "is-active")} title="Heading 3">H3</button>
          <div className="h-4 w-px bg-border/40 mx-1" />
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleMark("bold").run()} className={cn("toolbar-btn", editor.isActive("bold") && "is-active")} title="Bold"><Bold className="h-3.5 w-3.5" /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleMark("italic").run()} className={cn("toolbar-btn", editor.isActive("italic") && "is-active")} title="Italic"><Italic className="h-3.5 w-3.5" /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()} className={cn("toolbar-btn", editor.isActive("underline") && "is-active")} title="Underline"><UnderlineIcon className="h-3.5 w-3.5" /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleMark("strike").run()} className={cn("toolbar-btn", editor.isActive("strike") && "is-active")} title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleMark("code").run()} className={cn("toolbar-btn", editor.isActive("code") && "is-active")} title="Inline code"><Code className="h-3.5 w-3.5" /></button>
          <div className="h-4 w-px bg-border/40 mx-1" />
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn("toolbar-btn", editor.isActive("bulletList") && "is-active")} title="Bullet list"><List className="h-3.5 w-3.5" /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn("toolbar-btn", editor.isActive("orderedList") && "is-active")} title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleTaskList().run()} className={cn("toolbar-btn", editor.isActive("taskList") && "is-active")} title="Task list"><CheckSquare className="h-3.5 w-3.5" /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBlockquote().run()} className={cn("toolbar-btn", editor.isActive("blockquote") && "is-active")} title="Quote"><Quote className="h-3.5 w-3.5" /></button>
          <div className="h-4 w-px bg-border/40 mx-1" />
          <span className="text-[10px] text-muted-foreground/60 px-1">Type "/" for more</span>
        </div>
      )}

      {/* Bubble Menu — appears on text selection */}
      <BubbleMenu editor={editor} className="bubble-menu">
        <button onClick={() => editor.chain().focus().toggleMark("bold").run()} className={`bubble-btn ${editor.isActive("bold") ? "is-active" : ""}`} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => editor.chain().focus().toggleMark("italic").run()} className={`bubble-btn ${editor.isActive("italic") ? "is-active" : ""}`} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`bubble-btn ${editor.isActive("underline") ? "is-active" : ""}`} title="Underline">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => editor.chain().focus().toggleMark("strike").run()} className={`bubble-btn ${editor.isActive("strike") ? "is-active" : ""}`} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => editor.chain().focus().toggleMark("code").run()} className={`bubble-btn ${editor.isActive("code") ? "is-active" : ""}`} title="Code">
          <Code className="h-3.5 w-3.5" />
        </button>

        <div className="bubble-separator" />

        <Popover>
          <PopoverTrigger asChild>
            <button className={`bubble-btn ${editor.isActive("link") ? "is-active" : ""}`} title="Link">
              <LinkIcon className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 space-y-2" align="start">
            <Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-7 text-xs" />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-xs" onClick={() => { editor.chain().focus().setLink({ href: linkUrl }).run(); setLinkUrl(""); }}>Set</Button>
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkUrl(""); }}>Remove</Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button className="bubble-btn" title="Text Color">
              <Palette className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="flex gap-1">
              {TEXT_COLORS.map(c => (
                <button key={c.label} className="h-5 w-5 rounded-full border border-border/50 hover:scale-125 transition-transform" style={{ background: c.value || "hsl(var(--foreground))" }} title={c.label} onClick={() => { c.value ? editor.chain().focus().setColor(c.value).run() : editor.chain().focus().unsetColor().run(); }} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </BubbleMenu>

      {/* Floating Menu — shows + button on empty lines */}
      <FloatingMenu editor={editor} className="floating-menu">
        <button
          className="floating-add-btn"
          onClick={() => {
            editor.chain().focus().insertContent("/").run();
          }}
          title="Add block"
        >
          <Plus className="h-4 w-4" />
        </button>
      </FloatingMenu>

      <DragHandle editor={editor}>
        <button className="drag-handle" title="Drag to move" type="button">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </DragHandle>

      <div style={minHeight ? { minHeight } : undefined}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
