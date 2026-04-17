import RichTextEditor from "@/components/RichTextEditor";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

export default function ProjectNotesTab({ content, onChange }: Props) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-6 min-h-[60vh]">
      <RichTextEditor
        content={content}
        onChange={onChange}
        placeholder="Capture the why, plans, decisions, meeting notes…"
        borderless
      />
    </div>
  );
}
