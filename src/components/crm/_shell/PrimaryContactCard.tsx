import { useState } from "react";
import { Plus, Search, UserPlus, X, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import {
  CONTACT_TYPE_COLOR,
  contactTypeColor,
  contactTypeLabel,
} from "../contactTypes";

export interface PrimaryContactLite {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_type?: string | null;
  last_contacted_at?: string | null;
  created_at?: string | null;
}

function fullName(c: PrimaryContactLite | null | undefined) {
  if (!c) return "";
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unnamed";
}

function initialsOf(c: PrimaryContactLite | null | undefined) {
  if (!c) return "?";
  return (
    `${c.first_name?.[0] ?? ""}${c.last_name?.[0] ?? ""}`.toUpperCase() || "?"
  );
}

interface SearchResult {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

/**
 * "Primary Contact" card used as the FIRST sidebar item on Lead/Deal/Transaction
 * detail sheets. Mirrors the visual identity of the Contact peek (avatar +
 * name + type chip + last-contacted + added) but with avatar to the left and
 * smaller — designed to live inside a 320px sidebar column.
 *
 * Renders an inline "+ Add" picker (popover) when no contact is linked, and
 * a small "× unlink" affordance when one is.
 */
export function PrimaryContactCard({
  contact,
  onUnlink,
  onLink,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onCreateNew,
  canEdit = true,
}: {
  contact: PrimaryContactLite | null;
  onUnlink?: (id: string) => void | Promise<void>;
  onLink?: (id: string) => void | Promise<void>;
  searchQuery: string;
  onSearchQueryChange: (s: string) => void;
  searchResults: SearchResult[];
  onCreateNew?: () => void;
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (contact) {
    const name = fullName(contact);
    const typeLabel = contact.contact_type
      ? contactTypeLabel(contact.contact_type)
      : null;
    const typeHsl = contactTypeColor(contact.contact_type);
    const lastContacted = contact.last_contacted_at
      ? formatDistanceToNow(new Date(contact.last_contacted_at), {
          addSuffix: true,
        })
      : null;
    const added = contact.created_at
      ? new Date(contact.created_at).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;

    return (
      <section className="pb-5 border-b border-border/40">
        <div className="flex items-start gap-3">
          {/* Avatar — smaller, to the left */}
          <div
            className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white font-semibold text-sm"
            style={{ backgroundColor: `hsl(${typeHsl})` }}
            aria-label="Contact avatar"
          >
            {initialsOf(contact)}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold leading-tight text-foreground break-words">
                {name}
              </h3>
              {canEdit && onUnlink && (
                <button
                  onClick={() => onUnlink(contact.id)}
                  className="text-muted-foreground hover:text-destructive p-0.5 rounded shrink-0"
                  title="Unlink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {typeLabel && (
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: `hsl(${typeHsl})` }}
                />
                <span className="text-[12px] text-muted-foreground">
                  {typeLabel}
                </span>
              </div>
            )}

            {lastContacted && (
              <div className="text-[11px] italic text-muted-foreground/70">
                Last contacted {lastContacted}
              </div>
            )}
            {added && (
              <div className="text-[11px] text-muted-foreground/70">
                Added {added}
              </div>
            )}

            {(contact.email || contact.phone) && (
              <div className="pt-1 space-y-0.5">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-[11px] text-muted-foreground hover:text-primary truncate flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="text-[11px] text-muted-foreground hover:text-primary truncate flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" /> {contact.phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Empty state — inline "+ Add contact" popover
  return (
    <section className="pb-5 border-b border-border/40">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="w-full flex items-center gap-3 rounded-md border border-dashed border-border/60 bg-card/50 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
            disabled={!canEdit}
          >
            <div className="h-10 w-10 shrink-0 rounded-full bg-muted/50 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground">
                Add primary contact
              </div>
              <div className="text-[11px] text-muted-foreground">
                Link a person to this record
              </div>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="p-2 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Search contacts…"
                className="h-8 pl-7 text-sm"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-auto">
            {searchResults.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onLink?.(c.id);
                  setOpen(false);
                  onSearchQueryChange("");
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
              >
                <div className="font-medium truncate">
                  {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
                    "Unnamed"}
                </div>
                {c.email && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    {c.email}
                  </div>
                )}
              </button>
            ))}
            {searchResults.length === 0 && searchQuery.trim().length >= 2 && (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                No matches
              </div>
            )}
          </div>
          {onCreateNew && (
            <div className="border-t border-border/40 p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-8 text-xs"
                onClick={() => {
                  setOpen(false);
                  onCreateNew();
                }}
              >
                <UserPlus className="h-3.5 w-3.5" /> Create new contact
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </section>
  );
}
