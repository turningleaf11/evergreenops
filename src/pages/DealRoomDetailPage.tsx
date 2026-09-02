import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  KeyRound, Plus, Trash2, Link2, ChevronLeft,
} from "lucide-react";
import { useDealRoom } from "@/hooks/useDealRooms";
import { DD_CATEGORIES, DD_CATEGORY_LABELS, rollupCategoryStatus, type DdCategory } from "@/hooks/useDealRooms";
import { StatusPill } from "@/components/primitives";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const RISK_LEVELS = ["low", "medium", "high"] as const;
const RISK_DOT: Record<string, string> = { high: "hsl(var(--destructive))", medium: "hsl(38 92% 50%)", low: "hsl(220 12% 55%)" };

export default function DealRoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    room, ddItems, risks, decisions, bookings, investors, loading,
    updateRoom, addDdItem, updateDdItem, deleteDdItem,
    addRisk, updateRisk, deleteRisk, addDecision,
    addBooking, deleteBooking, addInvestor, updateInvestor, deleteInvestor,
  } = useDealRoom(id);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [tab, setTab] = useState("overview");

  if (loading || !room) {
    return <div className="text-sm text-muted-foreground py-16 text-center">Loading…</div>;
  }

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft.trim() !== room.name) updateRoom({ name: titleDraft.trim() });
    setEditingTitle(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link to="/deal-rooms" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="h-3.5 w-3.5" />Deal Rooms
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="crm-eyebrow">Deal Room</div>
            {editingTitle ? (
              <Input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                className="text-2xl font-bold tracking-tight h-auto py-1 px-1 -ml-1"
              />
            ) : (
              <h1
                className="page-title text-2xl cursor-text"
                onClick={() => { setTitleDraft(room.name); setEditingTitle(true); }}
              >
                {room.name}
              </h1>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill kind="deal_room" value={room.status} onChange={(v) => updateRoom({ status: v })} />
          <LinkedDealChip room={room} updateRoom={updateRoom} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="dd">DD Tracker</TabsTrigger>
          <TabsTrigger value="risk">Risk Register</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="capital">Capital Raise</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab room={room} ddItems={ddItems} updateRoom={updateRoom} />
        </TabsContent>
        <TabsContent value="dd" className="mt-6">
          <DdTrackerTab items={ddItems} onAdd={addDdItem} onUpdate={updateDdItem} onDelete={deleteDdItem} />
        </TabsContent>
        <TabsContent value="risk" className="mt-6">
          <RiskTab risks={risks} onAdd={addRisk} onUpdate={updateRisk} onDelete={deleteRisk} />
        </TabsContent>
        <TabsContent value="bookings" className="mt-6">
          <BookingsTab bookings={bookings} onAdd={addBooking} onDelete={deleteBooking} />
        </TabsContent>
        <TabsContent value="capital" className="mt-6">
          <CapitalTab room={room} investors={investors} onAdd={addInvestor} onUpdate={updateInvestor} onDelete={deleteInvestor} />
        </TabsContent>
        <TabsContent value="decisions" className="mt-6">
          <DecisionsTab decisions={decisions} onAdd={addDecision} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Linked CRM deal chip ────────────────────────────────────────────────
function LinkedDealChip({ room, updateRoom }: { room: any; updateRoom: (f: any) => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        const id = window.prompt("CRM Deal ID to link (leave blank to unlink):", room.linked_deal_id ?? "");
        if (id === null) return;
        updateRoom({ linked_deal_id: id.trim() || null });
      }}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
    >
      <Link2 className="h-3 w-3" />
      {room.linked_deal_id ? "Linked to CRM Deal" : "Link CRM Deal"}
    </button>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────
function OverviewTab({ room, ddItems, updateRoom }: { room: any; ddItems: any[]; updateRoom: (f: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const openEdit = () => {
    setForm({
      purchase_price: room.purchase_price ?? "",
      real_estate_price: room.real_estate_price ?? "",
      business_price: room.business_price ?? "",
      capital_raise_target: room.capital_raise_target ?? "",
      cash_at_closing: room.cash_at_closing ?? "",
      seller_financing_amount: room.seller_financing_amount ?? "",
      seller_financing_terms: room.seller_financing_terms ?? "",
      investor_multiple_min: room.investor_multiple_min ?? "",
      investor_multiple_max: room.investor_multiple_max ?? "",
      target_close_date: room.target_close_date ?? "",
    });
    setOpen(true);
  };
  const save = () => {
    const num = (v: any) => (v === "" ? null : Number(v));
    updateRoom({
      purchase_price: num(form.purchase_price),
      real_estate_price: num(form.real_estate_price),
      business_price: num(form.business_price),
      capital_raise_target: num(form.capital_raise_target),
      cash_at_closing: num(form.cash_at_closing),
      seller_financing_amount: num(form.seller_financing_amount),
      seller_financing_terms: form.seller_financing_terms || null,
      investor_multiple_min: num(form.investor_multiple_min),
      investor_multiple_max: num(form.investor_multiple_max),
      target_close_date: form.target_close_date || null,
    });
    setOpen(false);
  };

  return (
    <div className="crm-section-stack">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">Deal terms</h3>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" onClick={openEdit}>Edit terms</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Deal terms</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <Field label="Purchase price"><Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></Field>
                <Field label="Target close"><Input type="date" value={form.target_close_date} onChange={(e) => setForm({ ...form, target_close_date: e.target.value })} /></Field>
                <Field label="Real estate"><Input type="number" value={form.real_estate_price} onChange={(e) => setForm({ ...form, real_estate_price: e.target.value })} /></Field>
                <Field label="Business"><Input type="number" value={form.business_price} onChange={(e) => setForm({ ...form, business_price: e.target.value })} /></Field>
                <Field label="Capital raise target"><Input type="number" value={form.capital_raise_target} onChange={(e) => setForm({ ...form, capital_raise_target: e.target.value })} /></Field>
                <Field label="Cash at closing"><Input type="number" value={form.cash_at_closing} onChange={(e) => setForm({ ...form, cash_at_closing: e.target.value })} /></Field>
                <Field label="Seller financing amount"><Input type="number" value={form.seller_financing_amount} onChange={(e) => setForm({ ...form, seller_financing_amount: e.target.value })} /></Field>
                <Field label="Seller financing terms"><Input value={form.seller_financing_terms} onChange={(e) => setForm({ ...form, seller_financing_terms: e.target.value })} placeholder="0%, $3K/mo, 7-yr balloon" /></Field>
                <Field label="Investor multiple min"><Input type="number" step="0.01" value={form.investor_multiple_min} onChange={(e) => setForm({ ...form, investor_multiple_min: e.target.value })} /></Field>
                <Field label="Investor multiple max"><Input type="number" step="0.01" value={form.investor_multiple_max} onChange={(e) => setForm({ ...form, investor_multiple_max: e.target.value })} /></Field>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatTile label="Purchase Price" value={money(room.purchase_price)}
            sub={room.real_estate_price || room.business_price ? `RE ${money(room.real_estate_price)} · Biz ${money(room.business_price)}` : undefined} primary />
          <StatTile label="Capital Raise" value={money(room.capital_raise_target)} />
          <StatTile label="Cash at Closing" value={money(room.cash_at_closing)} />
          <StatTile label="Seller Financing" value={money(room.seller_financing_amount)} sub={room.seller_financing_terms ?? undefined} />
          <StatTile label="Target Close" value={room.target_close_date ? fmtDate(room.target_close_date) : "—"}
            sub={room.investor_multiple_min ? `${room.investor_multiple_min}x–${room.investor_multiple_max}x offer` : undefined} />
        </div>
      </div>

      <div>
        <h3 className="section-title">Status by area</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DD_CATEGORIES.map((cat) => {
            const status = rollupCategoryStatus(ddItems, cat);
            const count = ddItems.filter((i) => i.category === cat).length;
            return (
              <div key={cat} className="rounded-xl border bg-card p-4">
                <div className="text-xs font-semibold text-muted-foreground mb-2">{DD_CATEGORY_LABELS[cat]}</div>
                {status ? <StatusPill kind="dd_item" value={status} size="sm" /> : <StatusPill kind="dd_item" value="not_started" size="sm" />}
                <div className="text-[11px] text-muted-foreground mt-1.5">{count} item{count === 1 ? "" : "s"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="col-span-1"><Label className="text-xs mb-1 block">{label}</Label>{children}</div>;
}

function StatTile({ label, value, sub, primary }: { label: string; value: string; sub?: string; primary?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${primary ? "bg-primary/5 border-primary/25" : "bg-card"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

// ── DD Tracker ───────────────────────────────────────────────────────────
function DdTrackerTab({ items, onAdd, onUpdate, onDelete }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ category: "legal", risk: "medium", status: "not_started" });

  const submit = () => {
    if (!form.title?.trim()) return;
    onAdd({
      title: form.title.trim(),
      category: form.category,
      status: form.status,
      risk: form.risk,
      owner_name: form.owner_name || null,
      due_date: form.due_date || null,
      doc_url: form.doc_url || null,
      notes: form.notes || null,
    });
    setForm({ category: "legal", risk: "medium", status: "not_started" });
    setOpen(false);
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Item</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add DD Item</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <Field label="Title"><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{DD_CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Risk">
                  <Select value={form.risk} onValueChange={(v) => setForm({ ...form, risk: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RISK_LEVELS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Owner"><Input value={form.owner_name ?? ""} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></Field>
                <Field label="Due date"><Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
              </div>
              <Field label="Doc link (Drive)"><Input value={form.doc_url ?? ""} onChange={(e) => setForm({ ...form, doc_url: e.target.value })} placeholder="https://drive.google.com/…" /></Field>
              <Field label="Notes"><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
            <DialogFooter><Button onClick={submit}>Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={KeyRound} title="No DD items yet" description="Add the first thing you're requesting or tracking." size="sm" />
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left font-semibold px-4 py-2.5">Item</th>
                <th className="text-left font-semibold px-4 py-2.5">Owner</th>
                <th className="text-left font-semibold px-4 py-2.5">Due</th>
                <th className="text-left font-semibold px-4 py-2.5">Status</th>
                <th className="text-left font-semibold px-4 py-2.5">Risk</th>
                <th className="text-left font-semibold px-4 py-2.5">Doc</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[13px]">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground">{DD_CATEGORY_LABELS[item.category as DdCategory] ?? item.category}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.owner_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(item.due_date)}</td>
                  <td className="px-4 py-3"><StatusPill kind="dd_item" value={item.status} size="sm" onChange={(v) => onUpdate(item.id, { status: v })} /></td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: RISK_DOT[item.risk] }} />
                      <span className="capitalize">{item.risk}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.doc_url ? <a href={item.doc_url} target="_blank" rel="noreferrer" className="text-primary text-xs font-medium hover:underline">Drive →</a> : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="px-2 py-3">
                    <button onClick={() => onDelete(item.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Risk Register ────────────────────────────────────────────────────────
const SEVERITIES = ["critical", "material", "manageable", "cleared"] as const;

function RiskTab({ risks, onAdd, onUpdate, onDelete }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ severity: "material" });

  const submit = () => {
    if (!form.title?.trim()) return;
    onAdd({ title: form.title.trim(), description: form.description || null, severity: form.severity, owner_name: form.owner_name || null });
    setForm({ severity: "material" });
    setOpen(false);
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Risk</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Risk</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <Field label="Title"><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></Field>
              <Field label="Description"><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Severity">
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Owner"><Input value={form.owner_name ?? ""} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></Field>
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {risks.length === 0 ? (
        <EmptyState icon={KeyRound} title="No risks logged" description="Flag anything that could gate or change the deal." size="sm" />
      ) : (
        <div className="space-y-6">
          {SEVERITIES.map((sev) => {
            const group = risks.filter((r: any) => r.severity === sev);
            if (group.length === 0) return null;
            return (
              <div key={sev}>
                <h4 className="text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-2">
                  <StatusPill kind="deal_room_risk" value={sev} size="sm" showDot />
                </h4>
                <div className="space-y-2">
                  {group.map((r: any) => (
                    <div key={r.id} className="rounded-lg border bg-card p-3.5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">{r.title}</div>
                        {r.description && <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {r.owner_name && <span className="text-[11px] text-muted-foreground">{r.owner_name}</span>}
                        <StatusPill kind="deal_room_risk" value={r.severity} size="sm" onChange={(v) => onUpdate(r.id, { severity: v })} />
                        <button onClick={() => onDelete(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Bookings ─────────────────────────────────────────────────────────────
function BookingsTab({ bookings, onAdd, onDelete }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const totals = useMemo(() => bookings.reduce((acc: any, b: any) => ({
    contract: acc.contract + (b.contract_amount ?? 0),
    collected: acc.collected + (b.seller_collected ?? 0),
    due: acc.due + (b.remaining_due ?? 0),
    vendor: acc.vendor + (b.vendor_cost ?? 0),
  }), { contract: 0, collected: 0, due: 0, vendor: 0 }), [bookings]);

  const submit = () => {
    if (!form.event_name?.trim()) return;
    const num = (v: any) => (v === "" || v === undefined ? null : Number(v));
    onAdd({
      event_name: form.event_name.trim(),
      event_date: form.event_date || null,
      contract_amount: num(form.contract_amount),
      seller_collected: num(form.seller_collected),
      remaining_due: num(form.remaining_due),
      vendor_cost: num(form.vendor_cost),
    });
    setForm({});
    setOpen(false);
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatTile label="Contracted Revenue" value={money(totals.contract)} sub={`${bookings.length} event${bookings.length === 1 ? "" : "s"}`} />
        <StatTile label="Collected by Seller" value={money(totals.collected)} />
        <StatTile label="Remaining Receivables" value={money(totals.due)} />
        <StatTile label="Remaining Vendor Cost" value={money(totals.vendor)} />
      </div>

      <div className="flex justify-end mb-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Event</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Booking</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Event"><Input value={form.event_name ?? ""} onChange={(e) => setForm({ ...form, event_name: e.target.value })} autoFocus /></Field>
                <Field label="Date"><Input type="date" value={form.event_date ?? ""} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></Field>
                <Field label="Contract amount"><Input type="number" value={form.contract_amount ?? ""} onChange={(e) => setForm({ ...form, contract_amount: e.target.value })} /></Field>
                <Field label="Seller collected"><Input type="number" value={form.seller_collected ?? ""} onChange={(e) => setForm({ ...form, seller_collected: e.target.value })} /></Field>
                <Field label="Remaining due"><Input type="number" value={form.remaining_due ?? ""} onChange={(e) => setForm({ ...form, remaining_due: e.target.value })} /></Field>
                <Field label="Vendor cost"><Input type="number" value={form.vendor_cost ?? ""} onChange={(e) => setForm({ ...form, vendor_cost: e.target.value })} /></Field>
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {bookings.length === 0 ? (
        <EmptyState icon={KeyRound} title="No bookings tracked yet" size="sm" />
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left font-semibold px-4 py-2.5">Event</th>
                <th className="text-left font-semibold px-4 py-2.5">Date</th>
                <th className="text-right font-semibold px-4 py-2.5">Contract</th>
                <th className="text-right font-semibold px-4 py-2.5">Collected</th>
                <th className="text-right font-semibold px-4 py-2.5">Remaining Due</th>
                <th className="text-right font-semibold px-4 py-2.5">Vendor Cost</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {bookings.map((b: any) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{b.event_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(b.event_date)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{money(b.contract_amount)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{money(b.seller_collected)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{money(b.remaining_due)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{money(b.vendor_cost)}</td>
                  <td className="px-2 py-3"><button onClick={() => onDelete(b.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Capital Raise ────────────────────────────────────────────────────────
function CapitalTab({ room, investors, onAdd, onUpdate, onDelete }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ status: "interested" });

  const committed = investors
    .filter((i: any) => i.status === "committed" || i.status === "funded")
    .reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
  const target = room.capital_raise_target ?? 0;
  const pct = target > 0 ? Math.min(100, (committed / target) * 100) : 0;

  const submit = () => {
    if (!form.investor_name?.trim()) return;
    const num = (v: any) => (v === "" || v === undefined ? null : Number(v));
    onAdd({
      investor_name: form.investor_name.trim(),
      amount: num(form.amount),
      multiple_offered: num(form.multiple_offered),
      status: form.status,
      notes: form.notes || null,
    });
    setForm({ status: "interested" });
    setOpen(false);
  };

  return (
    <div className="crm-section-stack">
      <div>
        <h3 className="section-title">Investor pipeline</h3>
        {target > 0 && (
          <>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
              <div className="h-full bg-[hsl(262_65%_60%)]" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs text-muted-foreground mb-4">{money(committed)} committed of {money(target)} target</div>
          </>
        )}

        <div className="flex justify-end mb-3">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Investor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Investor</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Field label="Investor"><Input value={form.investor_name ?? ""} onChange={(e) => setForm({ ...form, investor_name: e.target.value })} autoFocus /></Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Amount"><Input type="number" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
                  <Field label="Multiple"><Input type="number" step="0.01" value={form.multiple_offered ?? ""} onChange={(e) => setForm({ ...form, multiple_offered: e.target.value })} /></Field>
                  <Field label="Status">
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interested">Interested</SelectItem>
                        <SelectItem value="reviewing">Reviewing</SelectItem>
                        <SelectItem value="committed">Committed</SelectItem>
                        <SelectItem value="funded">Funded</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Notes"><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              </div>
              <DialogFooter><Button onClick={submit}>Add</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {investors.length === 0 ? (
          <EmptyState icon={KeyRound} title="No investors in the pipeline yet" size="sm" />
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left font-semibold px-4 py-2.5">Investor</th>
                  <th className="text-right font-semibold px-4 py-2.5">Amount</th>
                  <th className="text-right font-semibold px-4 py-2.5">Multiple</th>
                  <th className="text-left font-semibold px-4 py-2.5">Status</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {investors.map((inv: any) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{inv.investor_name}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{money(inv.amount)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{inv.multiple_offered ? `${inv.multiple_offered}x` : "—"}</td>
                    <td className="px-4 py-3"><StatusPill kind="deal_room_investor" value={inv.status} size="sm" onChange={(v) => onUpdate(inv.id, { status: v })} /></td>
                    <td className="px-2 py-3"><button onClick={() => onDelete(inv.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Decisions ────────────────────────────────────────────────────────────
function DecisionsTab({ decisions, onAdd }: any) {
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const submit = () => {
    if (!summary.trim()) return;
    onAdd({ summary: summary.trim(), decided_at: date });
    setSummary("");
  };

  return (
    <div>
      <div className="rounded-xl border bg-card p-4 flex gap-2 mb-5">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        <Input
          placeholder="What was decided…"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button onClick={submit} disabled={!summary.trim()}>Log</Button>
      </div>

      {decisions.length === 0 ? (
        <EmptyState icon={KeyRound} title="No decisions logged yet" size="sm" />
      ) : (
        <div className="crm-card divide-y">
          {decisions.map((d: any) => (
            <div key={d.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
              <div className="text-xs text-muted-foreground font-mono w-20 shrink-0 pt-0.5">{fmtDate(d.decided_at)}</div>
              <div className="text-sm">{d.summary}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
