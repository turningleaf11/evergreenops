export const AI_STAGES = [
  { id: "idea", label: "Idea", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { id: "prototyping", label: "Prototyping", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  { id: "building", label: "Building", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  { id: "live", label: "Live", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  { id: "paused", label: "Paused", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  { id: "archived", label: "Archived", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
] as const;

export type AiStage = typeof AI_STAGES[number]["id"];

export const PLATFORM_OPTIONS = [
  "Lovable", "Cursor", "Bolt", "Replit", "v0", "Claude", "ChatGPT",
  "Gemini", "n8n", "Zapier", "Make", "Custom code", "Other",
];

export interface AiProject {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  stage: AiStage;
  platforms: string[];
  tags: string[];
  live_url: string | null;
  repo_url: string | null;
  prompt: string | null;
  notes_content: string | null;
  cover_url: string | null;
  owner_id: string | null;
  created_by: string;
  visibility: "workspace" | "departments" | "private";
  shared_department_ids: string[];
  shared_member_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface AiProjectLink {
  id: string;
  project_id: string;
  label: string;
  url: string;
  sort_order: number;
}
