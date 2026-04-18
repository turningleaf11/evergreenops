import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import CommentsSection from "@/components/CommentsSection";

interface ProjectChatRailProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export default function ProjectChatRail({ open, onClose, projectId }: ProjectChatRailProps) {
  if (!open) return null;
  return (
    <aside className="fixed right-0 top-0 z-40 flex h-screen w-[360px] flex-col border-l border-border/60 bg-background/95 shadow-xl backdrop-blur-md animate-in slide-in-from-right duration-200">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Comments</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 px-4 pt-4 pb-3">
        <CommentsSection entityType="project" entityId={projectId} hideHeader />
      </div>
    </aside>
  );
}
