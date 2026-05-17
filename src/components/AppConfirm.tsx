// App-styled replacement for window.confirm().
//
// Usage anywhere:
//   import { appConfirm } from "@/components/AppConfirm";
//   if (!(await appConfirm("Delete this thread?"))) return;
//
// Or with options:
//   await appConfirm({ title: "Delete thread?", body: "This can't be undone.", confirmLabel: "Delete", destructive: true });
//
// Mount <AppConfirmProvider /> once at the app root so the imperative API has
// somewhere to render. Resolves a Promise<boolean> based on user choice.

import { useState, useEffect, useCallback } from "react";
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
import { cn } from "@/lib/utils";

type ConfirmOpts =
  | string
  | {
      title?: string;
      body?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      destructive?: boolean;
    };

type Resolver = (v: boolean) => void;
type State = {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  resolve?: Resolver;
};

let stateRef: { setState: (s: Partial<State>) => void } | null = null;

export function appConfirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const normalized: State = typeof opts === "string"
      ? { open: true, title: opts, confirmLabel: "OK", cancelLabel: "Cancel", destructive: false, resolve }
      : {
          open: true,
          title: opts.title || "Are you sure?",
          body: opts.body,
          confirmLabel: opts.confirmLabel ?? "Confirm",
          cancelLabel: opts.cancelLabel ?? "Cancel",
          destructive: !!opts.destructive,
          resolve,
        };
    if (!stateRef) {
      // Fallback if provider not mounted yet
      resolve(window.confirm(normalized.title));
      return;
    }
    stateRef.setState(normalized);
  });
}

export function AppConfirmProvider() {
  const [state, setStateInternal] = useState<State>({
    open: false,
    title: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    destructive: false,
  });

  const setState = useCallback((patch: Partial<State>) => {
    setStateInternal((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    stateRef = { setState };
    return () => { stateRef = null; };
  }, [setState]);

  const close = (value: boolean) => {
    state.resolve?.(value);
    setState({ open: false, resolve: undefined });
  };

  return (
    <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          {state.body && <AlertDialogDescription>{state.body}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{state.cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={cn(state.destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {state.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
