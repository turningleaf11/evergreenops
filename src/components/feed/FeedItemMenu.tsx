import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface FeedItemMenuProps {
  table: "announcements" | "kudos" | "polls" | "posts";
  id: string;
  authorId: string | null | undefined;
  label?: string;
  onDeleted?: () => void;
}

export function FeedItemMenu({ table, id, authorId, label = "post", onDeleted }: FeedItemMenuProps) {
  const { user, isAdmin } = useAuth();
  const canManage = !!user && (user.id === authorId || isAdmin);
  if (!canManage) return null;

  const handleDelete = async () => {
    if (!confirm(`Delete this ${label}?`)) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted`);
      onDeleted?.();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/70 hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
