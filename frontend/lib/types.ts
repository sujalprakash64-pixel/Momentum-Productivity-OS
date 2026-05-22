export type TaskStatus = "pending" | "in_progress" | "completed" | "archived";
export type Priority = "low" | "medium" | "high" | "urgent";

export type Task = {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  actual_minutes: number;
  start_time?: string | null;
  end_time?: string | null;
  priority: Priority;
  deadline?: string | null;
  tags: string[];
  productivity_score: number;
  deep_work_score: number;
  ai_priority_score: number;
  status: TaskStatus;
  notes: string;
  recurrence_rule?: string | null;
  context_switches: number;
  idle_minutes: number;
};

export type Idea = {
  id: string;
  title: string;
  description: string;
  impact: number;
  difficulty: number;
  interest: number;
  tags: string[];
  converted_task_id?: string | null;
};
