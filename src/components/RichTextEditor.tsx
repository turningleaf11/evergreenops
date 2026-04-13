import { useEditor, EditorContent } from "@tiptap/react";
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
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { SlashCommands } from "@/components/SlashCommandMenu";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Link as LinkIcon, Palette, Plus,
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
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#9333ea" },
  { label: "Pink", value: "#db2777" },
];

export default function RichTextEditor({ content, onChange, placeholder = "Type '/' for commands..." }: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");

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
      Image.configure({ inline: false, allowBase64: true }),
      SlashCommands,
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

  return (
    <div className="rich-editor border rounded-lg bg-background">
      {/* Bubble Menu — appears on text selection */}
      <BubbleMenu editor={editor} className="bubble-menu">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={`bubble-btn ${editor.isActive("bold") ? "is-active" : ""}`} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`bubble-btn ${editor.isActive("italic") ? "is-active" : ""}`} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`bubble-btn ${editor.isActive("underline") ? "is-active" : ""}`} title="Underline">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`bubble-btn ${editor.isActive("strike") ? "is-active" : ""}`} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => editor.chain().focus().toggleCode().run()} className={`bubble-btn ${editor.isActive("code") ? "is-active" : ""}`} title="Code">
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
            // Insert a slash to trigger the command menu
            editor.chain().focus().insertContent("/").run();
          }}
          title="Add block"
        >
          <Plus className="h-4 w-4" />
        </button>
      </FloatingMenu>

      <EditorContent editor={editor} />
    </div>
  );
}
