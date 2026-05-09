import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogContentText, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface DeleteAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  agentName: string;
  isDeleting: boolean;
}

export function DeleteAgentDialog({ open, onClose, onConfirm, agentName, isDeleting }: DeleteAgentDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => isOpen ? null : onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete {agentName}?</AlertDialogTitle>
          <AlertDialogContentText>
            This action cannot be undone. All associated data will be permanently removed.
          </AlertDialogContentText>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
            {isDeleting ? "Deleting..." : "Delete Agent"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
