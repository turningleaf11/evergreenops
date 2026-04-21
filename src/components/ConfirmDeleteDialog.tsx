import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What you're deleting, e.g. "project", "goal", "list". */
  entityLabel: string;
  /** Specific name shown to user, e.g. project title. */
  entityName?: string;
  /** When true, force user to type the confirmation phrase (default true). Set false for low-stakes items. */
  requireType?: boolean;
  onConfirm: () => void | Promise<void>;
  description?: string;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  entityLabel,
  entityName,
  requireType = true,
  onConfirm,
  description,
}: ConfirmDeleteDialogProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const phrase = "delete";

  useEffect(() => {
    if (!open) { setTyped(""); setBusy(false); }
  }, [open]);

  const canConfirm = !requireType || typed.trim().toLowerCase() === phrase;

  const handleConfirm = async () => {
    if (!canConfirm || busy) return;
    setBusy(true);
    try { await onConfirm(); }
    finally { setBusy(false); onOpenChange(false); }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Delete {entityLabel}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              {description || (
                <>This will permanently remove {entityName ? <strong className="text-foreground">{entityName}</strong> : `this ${entityLabel}`}. This action cannot be undone.</>
              )}
            </span>
            {requireType && (
              <span className="block text-xs">
                Type <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono">{phrase}</code> to confirm.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requireType && (
          <Input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={phrase}
            onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) handleConfirm(); }}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm || busy}
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
