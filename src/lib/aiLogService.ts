import { supabase } from "@/integrations/supabase/client";
import type { AiLog, InsertAiLog } from "@/types/aiLogs";

const MAX_LOGS = 50;

export async function insertAiLog(log: InsertAiLog): Promise<void> {
  const { error } = await supabase.from("ai_logs" as never).insert(log as never);
  if (error) console.error("[aiLogService] insert failed", error);
}

export function subscribeToAiLogs(
  onLogs: (logs: AiLog[]) => void,
): () => void {
  let current: AiLog[] = [];

  const fetchInitial = async () => {
    const { data, error } = await supabase
      .from("ai_logs" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(MAX_LOGS);
    if (error) {
      console.error("[aiLogService] initial fetch failed", error);
      return;
    }
    current = (data ?? []) as unknown as AiLog[];
    onLogs(current);
  };

  void fetchInitial();

  const channel = supabase
    .channel("ai_logs_changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "ai_logs" },
      (payload) => {
        const incoming = payload.new as AiLog;
        if (current.some((l) => l.id === incoming.id)) return;
        current = [incoming, ...current].slice(0, MAX_LOGS);
        onLogs(current);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
