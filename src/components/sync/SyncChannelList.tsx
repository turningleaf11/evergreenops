import { Inbox, Bell, Users, Hash, User } from "lucide-react";
import { SyncChannel } from "@/hooks/useSync";
import { cn } from "@/lib/utils";

type View = { kind: "all" } | { kind: "needs_you" } | { kind: "channel"; channelId: string };

interface Props {
  channels: SyncChannel[];
  view: View;
  onSelect: (view: View) => void;
  unreadByChannel?: Record<string, number>;
  needsYouCount?: number;
}

export function SyncChannelList({ channels, view, onSelect, unreadByChannel = {}, needsYouCount = 0 }: Props) {
  const directs = channels.filter((c) => c.type === "direct");
  const groups = channels.filter((c) => c.type === "group");
  const adhocs = channels.filter((c) => c.type === "adhoc");

  const isActive = (v: View) => {
    if (v.kind === "all" && view.kind === "all") return true;
    if (v.kind === "needs_you" && view.kind === "needs_you") return true;
    if (v.kind === "channel" && view.kind === "channel" && v.channelId === view.channelId) return true;
    return false;
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-0.5">
        <NavRow
          icon={<Inbox className="h-3.5 w-3.5" />}
          label="All Threads"
          active={isActive({ kind: "all" })}
          onClick={() => onSelect({ kind: "all" })}
        />
        <NavRow
          icon={<Bell className="h-3.5 w-3.5" />}
          label="Needs You"
          badge={needsYouCount}
          active={isActive({ kind: "needs_you" })}
          onClick={() => onSelect({ kind: "needs_you" })}
        />
      </div>

      {directs.length > 0 && (
        <Section title="Direct">
          {directs.map((c) => (
            <NavRow
              key={c.id}
              icon={<User className="h-3.5 w-3.5" />}
              label={c.displayName}
              badge={unreadByChannel[c.id]}
              active={isActive({ kind: "channel", channelId: c.id })}
              onClick={() => onSelect({ kind: "channel", channelId: c.id })}
            />
          ))}
        </Section>
      )}

      {groups.length > 0 && (
        <Section title="Groups">
          {groups.map((c) => (
            <NavRow
              key={c.id}
              icon={<Users className="h-3.5 w-3.5" />}
              label={c.displayName}
              badge={unreadByChannel[c.id]}
              active={isActive({ kind: "channel", channelId: c.id })}
              onClick={() => onSelect({ kind: "channel", channelId: c.id })}
            />
          ))}
        </Section>
      )}

      {adhocs.length > 0 && (
        <Section title="Ad-hoc">
          {adhocs.map((c) => (
            <NavRow
              key={c.id}
              icon={<Hash className="h-3.5 w-3.5" />}
              label={c.displayName}
              badge={unreadByChannel[c.id]}
              active={isActive({ kind: "channel", channelId: c.id })}
              onClick={() => onSelect({ kind: "channel", channelId: c.id })}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-2 pb-1">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavRow({
  icon, label, active, onClick, badge,
}: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className={cn("shrink-0", active ? "text-primary" : "")}>{icon}</span>
      <span className="flex-1 truncate text-xs">{label}</span>
      {badge && badge > 0 ? (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
