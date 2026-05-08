export type AiLogCategory = 'task_started' | 'task_completed' | 'task_failed' | 'agent_message';

export interface AiLog {
  id: string;
  task_id: string | null;
  agent_id: string | null;
  agent_name: string;
  agent_emoji: string | null;
  category: AiLogCategory;
  message: string;
  created_at: string;
}

export interface InsertAiLog {
  task_id?: string | null;
  agent_id?: string | null;
  agent_name: string;
  agent_emoji?: string | null;
  category: AiLogCategory;
  message: string;
}
