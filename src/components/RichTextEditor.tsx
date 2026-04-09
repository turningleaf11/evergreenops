import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks,
  Quote, Minus, Link as LinkIcon, Highlighter, Palette,
  Info, AlertTriangle, CheckCircle, XCircle, Code2,
} from "lucide-react";
import "./RichTextEditor.css";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Yellow", value: "#ca8a04" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#9333ea" },
  { label: "Pink", value: "#db2777" },
];

const HIGHLIGHT_COLORS = [
  { label: "None", value: "" },
  { label: "Yellow", value: "#fef08a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Orange", value: "#fed7aa" },
  { label: "Purple", value: "#e9d5ff" },
];

export default function RichTextEditor({ content, onChange, placeholder = "Start writing..." }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none focus:outline-none" },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  if (!editor) return null;

  const insertCallout = (type: string) => {
    editor.chain().focus().insertContent(
      `<div class="callout callout-${type}"><p>${type.charAt(0).toUpperCase() + type.slice(1)}: </p></div>`
    ).run();
  };

  return (
    <div className="rich-editor border rounded-md bg-background">
      <Toolbar editor={editor} onInsertCallout={insertCallout} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, onInsertCallout }: { editor: any; onInsertCallout: (type: string) => void }) {
  const [linkUrl, setLinkUrl] = useState("");

  const btn = (active: boolean) =>
    `h-7 w-7 p-0 ${active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-muted/30">
      {/* Headings */}
      <Button variant="ghost" size="icon" className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3"><Heading3 className="h-3.5 w-3.5" /></Button>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Formatting */}
      <Button variant="ghost" size="icon" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline Code"><Code className="h-3.5 w-3.5" /></Button>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Colors */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={btn(false)} title="Text Color"><Palette className="h-3.5 w-3.5" /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {TEXT_COLORS.map(c => (
              <button key={c.label} className="h-6 w-6 rounded-full border border-border hover:scale-110 transition-transform" style={{ background: c.value || "hsl(var(--foreground))" }} title={c.label} onClick={() => { c.value ? editor.chain().focus().setColor(c.value).run() : editor.chain().focus().unsetColor().run(); }} />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={btn(editor.isActive("highlight"))} title="Highlight"><Highlighter className="h-3.5 w-3.5" /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {HIGHLIGHT_COLORS.map(c => (
              <button key={c.label} className="h-6 w-6 rounded-full border border-border hover:scale-110 transition-transform" style={{ background: c.value || "transparent" }} title={c.label} onClick={() => { c.value ? editor.chain().focus().toggleHighlight({ color: c.value }).run() : editor.chain().focus().unsetHighlight().run(); }} />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Lists */}
      <Button variant="ghost" size="icon" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List"><List className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List"><ListOrdered className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("taskList"))} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task List"><ListChecks className="h-3.5 w-3.5" /></Button>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Blocks */}
      <Button variant="ghost" size="icon" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote"><Quote className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block"><Code2 className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className={btn(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus className="h-3.5 w-3.5" /></Button>

      {/* Link */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={btn(editor.isActive("link"))} title="Link"><LinkIcon className="h-3.5 w-3.5" /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 space-y-2" align="start">
          <Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-8 text-sm" />
          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs" onClick={() => { editor.chain().focus().setLink({ href: linkUrl }).run(); setLinkUrl(""); }}>Set Link</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkUrl(""); }}>Remove</Button>
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Callouts */}
      <Button variant="ghost" size="icon" className={btn(false)} onClick={() => onInsertCallout("info")} title="Info Callout"><Info className="h-3.5 w-3.5 text-blue-500" /></Button>
      <Button variant="ghost" size="icon" className={btn(false)} onClick={() => onInsertCallout("warning")} title="Warning Callout"><AlertTriangle className="h-3.5 w-3.5 text-yellow-500" /></Button>
      <Button variant="ghost" size="icon" className={btn(false)} onClick={() => onInsertCallout("success")} title="Success Callout"><CheckCircle className="h-3.5 w-3.5 text-green-500" /></Button>
      <Button variant="ghost" size="icon" className={btn(false)} onClick={() => onInsertCallout("error")} title="Error Callout"><XCircle className="h-3.5 w-3.5 text-red-500" /></Button>
    </div>
  );
}
