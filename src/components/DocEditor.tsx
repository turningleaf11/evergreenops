import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocPage } from "@/lib/mock-data";

interface DocEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { title: string; content: string; tags: string[]; parentId: string | null }) => void;
  onDelete?: () => void;
  doc?: DocPage | null;
  allDocs: DocPage[];
}

export default function DocEditor({ open, onClose, onSave, onDelete, doc, allDocs }: DocEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content);
      setTagsStr(doc.tags.join(", "));
      setParentId(doc.parentId);
    } else {
      setTitle("");
      setContent("");
      setTagsStr("");
      setParentId(null);
    }
  }, [doc, open]);

  const rootDocs = allDocs.filter((d) => !d.parentId && d.id !== doc?.id);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      content: content.trim(),
      tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
      parentId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{doc ? "Edit Page" : "New Page"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title" />
          </div>
          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your content..." rows={6} />
          </div>
          <div className="space-y-2">
            <Label>Tags (comma separated)</Label>
            <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="tag1, tag2" />
          </div>
          <div className="space-y-2">
            <Label>Parent Page</Label>
            <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="None (root page)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (root page)</SelectItem>
                {rootDocs.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!title.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
