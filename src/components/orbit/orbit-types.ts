export type OrbitTrack = "dts" | "dta" | "deal_scout" | "underwriting" | "d4";
export type OrbitStatus = "active" | "on_notice" | "graduated" | "removed";

export const TRACK_OPTIONS: { value: OrbitTrack; label: string }[] = [
  { value: "dts", label: "DTS" },
  { value: "dta", label: "DTA" },
  { value: "deal_scout", label: "Deal Scout" },
  { value: "underwriting", label: "Underwriting" },
  { value: "d4", label: "D4$" },
];

export const STATUS_OPTIONS: { value: OrbitStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "on_notice", label: "On Notice" },
  { value: "graduated", label: "Graduated" },
  { value: "removed", label: "Removed" },
];

export const STATUS_COLORS: Record<OrbitStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  on_notice: "bg-amber-100 text-amber-700",
  graduated: "bg-blue-100 text-blue-700",
  removed: "bg-muted text-muted-foreground",
};

export const TRACK_COLORS: Record<OrbitTrack, string> = {
  dts: "bg-sky-100 text-sky-700",
  dta: "bg-violet-100 text-violet-700",
  deal_scout: "bg-rose-100 text-rose-700",
  underwriting: "bg-indigo-100 text-indigo-700",
  d4: "bg-amber-100 text-amber-700",
};

export const TRACK_LABEL: Record<OrbitTrack, string> = Object.fromEntries(
  TRACK_OPTIONS.map((t) => [t.value, t.label])
) as Record<OrbitTrack, string>;

export const STATUS_LABEL: Record<OrbitStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label])
) as Record<OrbitStatus, string>;

export interface OrbitMember {
  id: string;
  user_id: string;
  department_id: string;
  track: OrbitTrack;
  status: OrbitStatus;
  joined_at: string;
  track_started_at: string;
  graduated_at: string | null;
  removed_at: string | null;
  removal_reason: string | null;
  notes: string;
  ghl_user_id: string | null;
  ghl_synced_at: string | null;
}

export interface OrbitChecklistItem {
  id: string;
  member_id: string;
  item_key: string;
  label: string;
  sort_order: number;
  done: boolean;
  done_at: string | null;
  done_by: string | null;
  notes: string;
}

export interface OrbitStrike {
  id: string;
  member_id: string;
  strike_number: number;
  issued_at: string;
  issued_by: string | null;
  issued_by_name: string | null;
  reason: string;
  notes: string;
}

export interface OrbitPerformance {
  id: string;
  member_id: string;
  snapshot_date: string;
  calls_made: number;
  appointments_set: number;
  conversations: number;
  deals_closed: number;
  source: "manual" | "ghl";
  notes: string;
}
