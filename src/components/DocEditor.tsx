import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/RichTextEditor";
import AccessPicker from "@/components/AccessPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocPage, Visibility, SharedWith } from "@/lib/mock-data";

interface DocEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { title: string; content: string; tags: string[]; parentId: string | null; visibility: Visibility; sharedWith: SharedWith }) => void;
  doc?: DocPage | null;
  allDocs: DocPage[];
}

export default function DocEditor({ open, onClose, onSave, doc, allDocs }: DocEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("workspace");
  const [sharedWith, setSharedWith] = useState<SharedWith>({ departmentIds: [], memberIds: [] });

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content);
      setTagsStr(doc.tags.join(", "));
      setParentId(doc.parentId);
      setVisibility(doc.visibility);
      setSharedWith(doc.sharedWith);
    } else {
      setTitle("");
      setContent("");
      setTagsStr("");
      setParentId(null);
      setVisibility("workspace");
      setSharedWith({ departmentIds: [], memberIds: [] });
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
      visibility,
      sharedWith,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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
            <RichTextEditor content={content} onChange={setContent} placeholder="Write your content..." />
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
          <AccessPicker
            visibility={visibility}
            sharedWith={sharedWith}
            onChange={(v, s) => { setVisibility(v); setSharedWith(s); }}
          />
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
