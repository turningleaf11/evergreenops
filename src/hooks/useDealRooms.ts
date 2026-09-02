// Deal Rooms — acquisition/DD workspaces. Deliberately separate data model
// from the Deals/CRM sales pipeline; a room may optionally carry
// linked_deal_id but every hook here works with no CRM deal at all.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type DealRoom = Tables<"deal_rooms">;
export type DdItem = Tables<"deal_room_dd_items">;
export type Risk = Tables<"deal_room_risks">;
export type Decision = Tables<"deal_room_decisions">;
export type Booking = Tables<"deal_room_bookings">;
export type Investor = Tables<"deal_room_investors">;

export const DD_CATEGORIES = ["legal", "financial", "property", "bookings", "insurance", "capital", "tax"] as const;
export type DdCategory = (typeof DD_CATEGORIES)[number];

export const DD_CATEGORY_LABELS: Record<DdCategory, string> = {
  legal: "Legal",
  financial: "Financial",
  property: "Property",
  bookings: "Bookings",
  insurance: "Insurance",
  capital: "Capital Raise",
  tax: "Tax / Ag",
};

// Worst-first ranking so a category tile reflects its riskiest open item.
const DD_STATUS_RANK: Record<string, number> = {
  issue: 5,
  waiting_on_seller: 4,
  not_started: 3,
  requested: 2,
  in_review: 1,
  complete: 0,
};

/** Rolls a category's DD items up into the single worst status among them. */
export function rollupCategoryStatus(items: DdItem[], category: string): string | null {
  const inCategory = items.filter((i) => i.category === category);
  if (inCategory.length === 0) return null;
  return inCategory.reduce((worst, item) => {
    const rank = DD_STATUS_RANK[item.status] ?? 0;
    const worstRank = DD_STATUS_RANK[worst] ?? 0;
    return rank > worstRank ? item.status : worst;
  }, inCategory[0].status);
}

function onError(err: unknown, action: string) {
  console.error(err);
  toast.error(`Couldn't ${action}`, { description: err instanceof Error ? err.message : String(err) });
}

/** List + create for the Deal Rooms landing page. */
export function useDealRooms() {
  const { id: workspaceId } = useWorkspace();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<DealRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("deal_rooms")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) onError(error, "load deal rooms");
    setRooms(data ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { refetch(); }, [refetch]);

  const createRoom = async (name: string) => {
    if (!workspaceId) return null;
    const payload: TablesInsert<"deal_rooms"> = { workspace_id: workspaceId, name, created_by: user?.id ?? null };
    const { data, error } = await supabase.from("deal_rooms").insert(payload).select().single();
    if (error) { onError(error, "create deal room"); return null; }
    setRooms((prev) => [data, ...prev]);
    return data;
  };

  return { rooms, loading, createRoom, refetch };
}

/** Full detail state + mutations for a single deal room. */
export function useDealRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<DealRoom | null>(null);
  const [ddItems, setDdItems] = useState<DdItem[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    const [roomRes, ddRes, riskRes, decRes, bookRes, invRes] = await Promise.all([
      supabase.from("deal_rooms").select("*").eq("id", roomId).single(),
      supabase.from("deal_room_dd_items").select("*").eq("deal_room_id", roomId).order("created_at"),
      supabase.from("deal_room_risks").select("*").eq("deal_room_id", roomId).order("created_at"),
      supabase.from("deal_room_decisions").select("*").eq("deal_room_id", roomId).order("decided_at", { ascending: false }),
      supabase.from("deal_room_bookings").select("*").eq("deal_room_id", roomId).order("event_date"),
      supabase.from("deal_room_investors").select("*").eq("deal_room_id", roomId).order("updated_at", { ascending: false }),
    ]);
    if (roomRes.error) onError(roomRes.error, "load deal room");
    setRoom(roomRes.data ?? null);
    setDdItems(ddRes.data ?? []);
    setRisks(riskRes.data ?? []);
    setDecisions(decRes.data ?? []);
    setBookings(bookRes.data ?? []);
    setInvestors(invRes.data ?? []);
    setLoading(false);
  }, [roomId]);

  useEffect(() => { refetch(); }, [refetch]);

  const updateRoom = async (fields: TablesUpdate<"deal_rooms">) => {
    if (!roomId) return;
    const { data, error } = await supabase.from("deal_rooms").update(fields).eq("id", roomId).select().single();
    if (error) return onError(error, "update deal room");
    setRoom(data);
  };

  const addDdItem = async (fields: Omit<TablesInsert<"deal_room_dd_items">, "deal_room_id">) => {
    if (!roomId) return;
    const { data, error } = await supabase.from("deal_room_dd_items").insert({ ...fields, deal_room_id: roomId }).select().single();
    if (error) return onError(error, "add DD item");
    setDdItems((prev) => [...prev, data]);
  };
  const updateDdItem = async (id: string, fields: TablesUpdate<"deal_room_dd_items">) => {
    const { data, error } = await supabase.from("deal_room_dd_items").update(fields).eq("id", id).select().single();
    if (error) return onError(error, "update DD item");
    setDdItems((prev) => prev.map((i) => (i.id === id ? data : i)));
  };
  const deleteDdItem = async (id: string) => {
    const { error } = await supabase.from("deal_room_dd_items").delete().eq("id", id);
    if (error) return onError(error, "delete DD item");
    setDdItems((prev) => prev.filter((i) => i.id !== id));
  };

  const addRisk = async (fields: Omit<TablesInsert<"deal_room_risks">, "deal_room_id">) => {
    if (!roomId) return;
    const { data, error } = await supabase.from("deal_room_risks").insert({ ...fields, deal_room_id: roomId }).select().single();
    if (error) return onError(error, "add risk");
    setRisks((prev) => [...prev, data]);
  };
  const updateRisk = async (id: string, fields: TablesUpdate<"deal_room_risks">) => {
    const { data, error } = await supabase.from("deal_room_risks").update(fields).eq("id", id).select().single();
    if (error) return onError(error, "update risk");
    setRisks((prev) => prev.map((r) => (r.id === id ? data : r)));
  };
  const deleteRisk = async (id: string) => {
    const { error } = await supabase.from("deal_room_risks").delete().eq("id", id);
    if (error) return onError(error, "delete risk");
    setRisks((prev) => prev.filter((r) => r.id !== id));
  };

  const addDecision = async (fields: Omit<TablesInsert<"deal_room_decisions">, "deal_room_id">) => {
    if (!roomId) return;
    const { data, error } = await supabase.from("deal_room_decisions").insert({ ...fields, deal_room_id: roomId }).select().single();
    if (error) return onError(error, "log decision");
    setDecisions((prev) => [data, ...prev]);
  };

  const addBooking = async (fields: Omit<TablesInsert<"deal_room_bookings">, "deal_room_id">) => {
    if (!roomId) return;
    const { data, error } = await supabase.from("deal_room_bookings").insert({ ...fields, deal_room_id: roomId }).select().single();
    if (error) return onError(error, "add booking");
    setBookings((prev) => [...prev, data].sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? "")));
  };
  const updateBooking = async (id: string, fields: TablesUpdate<"deal_room_bookings">) => {
    const { data, error } = await supabase.from("deal_room_bookings").update(fields).eq("id", id).select().single();
    if (error) return onError(error, "update booking");
    setBookings((prev) => prev.map((b) => (b.id === id ? data : b)));
  };
  const deleteBooking = async (id: string) => {
    const { error } = await supabase.from("deal_room_bookings").delete().eq("id", id);
    if (error) return onError(error, "delete booking");
    setBookings((prev) => prev.filter((b) => b.id !== id));
  };

  const addInvestor = async (fields: Omit<TablesInsert<"deal_room_investors">, "deal_room_id">) => {
    if (!roomId) return;
    const { data, error } = await supabase.from("deal_room_investors").insert({ ...fields, deal_room_id: roomId }).select().single();
    if (error) return onError(error, "add investor");
    setInvestors((prev) => [data, ...prev]);
  };
  const updateInvestor = async (id: string, fields: TablesUpdate<"deal_room_investors">) => {
    const { data, error } = await supabase.from("deal_room_investors").update(fields).eq("id", id).select().single();
    if (error) return onError(error, "update investor");
    setInvestors((prev) => prev.map((i) => (i.id === id ? data : i)));
  };
  const deleteInvestor = async (id: string) => {
    const { error } = await supabase.from("deal_room_investors").delete().eq("id", id);
    if (error) return onError(error, "delete investor");
    setInvestors((prev) => prev.filter((i) => i.id !== id));
  };

  return {
    room, ddItems, risks, decisions, bookings, investors, loading, refetch,
    updateRoom,
    addDdItem, updateDdItem, deleteDdItem,
    addRisk, updateRisk, deleteRisk,
    addDecision,
    addBooking, updateBooking, deleteBooking,
    addInvestor, updateInvestor, deleteInvestor,
  };
}
