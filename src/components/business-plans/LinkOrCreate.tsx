// LinkOrCreate — the one control Business Plans uses to attach an existing
// record to a plan OR spin up a new one, without leaving the page.
//
// Used for Goals, Cadences, Wiki pages, and Whiteboards. Records live in
// their own native table; attaching just stamps `business_plan_id`, so a
// goal created here still shows up in Execution Hub like any other goal.
//
// Pattern: combobox (Popover + Command). Search filters the unattached
// candidates; typing something that doesn't exist offers "Create <query>".

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Plus, Link2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LinkCandidate {
  id: string;
  title: string;
  /** Optional right-aligned hint — e.g. "Q3 2026", "Weekly", "edited 3d ago". */
  hint?: string | null;
}

interface Props {
  /** Singular noun used in the UI copy — "goal", "cadence", "page", "board". */
  noun: string;
  /** Records not yet attached to any plan. */
  candidates: LinkCandidate[];
  /** Attach an existing record to this plan. */
  onLink: (id: string) => Promise<void> | void;
  /** Create a brand-new record already attached to this plan. */
  onCreate: (title: string) => Promise<void> | void;
  /** Disable creating (rare — used when creation needs a fuller form). */
  allowCreate?: boolean;
  className?: string;
}

export function LinkOrCreate({ noun, candidates, onLink, onCreate, allowCreate = true, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const trimmed = query.trim();
  const exactExists = candidates.some((c) => c.title.toLowerCase() === trimmed.toLowerCase());

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
      setOpen(false);
      setQuery("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-7 text-xs", className)} disabled={busy}>
          <Plus className="h-3 w-3 mr-1" />
          Add {noun}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder={`Search or name a new ${noun}…`}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {candidates.length > 0 && (
              <CommandGroup heading={`Link an existing ${noun}`}>
                {candidates.map((c) => (
                  <CommandItem key={c.id} value={c.title} onSelect={() => run(() => onLink(c.id))}>
                    <Link2 className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{c.title}</span>
                    {c.hint && <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{c.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {allowCreate && trimmed.length > 0 && !exactExists && (
              <CommandGroup heading="Create new">
                {/* forceMount-ish: give it a value that always matches the query
                    so cmdk's filter never hides the create affordance. */}
                <CommandItem value={trimmed} onSelect={() => run(() => onCreate(trimmed))}>
                  <Plus className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                  <span className="truncate">Create “{trimmed}”</span>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandEmpty>
              {allowCreate && trimmed.length === 0
                ? `Type to name a new ${noun}.`
                : `No matching ${noun} found.`}
            </CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Small inline confirmation used after linking, kept here so the pattern
    stays consistent wherever LinkOrCreate is used. */
export function LinkedTick({ className }: { className?: string }) {
  return <Check className={cn("h-3.5 w-3.5 text-emerald-500", className)} />;
}
