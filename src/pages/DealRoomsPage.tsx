import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Plus } from "lucide-react";
import { useAddonEnabled } from "@/hooks/useAddonEnabled";
import { useDealRooms } from "@/hooks/useDealRooms";
import { StatusPill } from "@/components/primitives";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";

function formatMoney(n: number | null) {
  if (n === null || n === undefined) return null;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function DealRoomsPage() {
  const enabled = useAddonEnabled("deal-rooms");
  const { rooms, loading, createRoom } = useDealRooms();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  if (!enabled) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Card className="p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Deal Rooms</h1>
          <p className="text-muted-foreground mb-6">
            Due-diligence workspaces for acquisitions — DD tracker, risk register, bookings and capital raise, kept separate from the Deals CRM pipeline. Enable this add-on to get started.
          </p>
          <Button asChild>
            <Link to="/settings">Enable in Settings → Add-ons</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const room = await createRoom(name.trim());
    setCreating(false);
    if (room) {
      setOpen(false);
      setName("");
      navigate(`/deal-rooms/${room.id}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-title text-2xl">Deal Rooms</h1>
            <p className="text-sm text-muted-foreground">Due diligence, risk, and closing — one workspace per acquisition.</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="h-4 w-4" />New Deal Room</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Deal Room</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="room-name">Name</Label>
              <Input
                id="room-name"
                placeholder="e.g. Weber Manor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!name.trim() || creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-16 text-center">Loading…</div>
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No deal rooms yet"
          description="Start one for the acquisition you're diligencing — DD tracker, risk register, bookings, and capital raise all live inside it."
          actionLabel="New Deal Room"
          actionIcon={Plus}
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              onClick={() => navigate(`/deal-rooms/${room.id}`)}
              className="rounded-xl border bg-card p-5 hover:shadow-lg hover:-translate-y-px transition-all cursor-pointer"
              style={{ borderLeft: "3px solid hsl(var(--primary))" }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="text-[15px] font-semibold tracking-tight">{room.name}</h3>
                <StatusPill kind="deal_room" value={room.status} size="sm" />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {room.purchase_price != null && <span>{formatMoney(room.purchase_price)} purchase</span>}
                {room.target_close_date && <span>Target close {new Date(room.target_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
