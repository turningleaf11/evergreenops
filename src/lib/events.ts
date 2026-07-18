// Client-side event emitter — writes a row to the events backbone that powers
// the Activity page (Feed = all, Inbox = needs_action & unresolved). Fire and
// forget: an event never blocks or breaks the action that triggered it.

import { supabase } from "@/integrations/supabase/client";

const events = supabase as unknown as { from: (t: string) => any };

export type EventSeverity = "info" | "success" | "warning" | "error";

export interface LogEventInput {
  type: string;
  title: string;
  severity?: EventSeverity;
  body?: string | null;
  source?: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  actor?: string | null;
  needsAction?: boolean;
  metadata?: Record<string, unknown> | null;
}

export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    await events.from("events").insert({
      type: input.type,
      title: input.title,
      severity: input.severity ?? "info",
      body: input.body ?? null,
      source: input.source ?? "opshq",
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel ?? null,
      actor: input.actor ?? null,
      needs_action: input.needsAction ?? false,
      metadata: input.metadata ?? null,
    });
  } catch (e) {
    // Never let telemetry break the user's action.
    console.error("logEvent failed", e);
  }
}
