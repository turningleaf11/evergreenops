export type AiLogCategory =
  | 'task_created'
  | 'task_status'
  | 'task_updated'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'agent_message'
  | 'agent_thought'
  | 'agent_tool';

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
