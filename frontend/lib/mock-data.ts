import { addHours, addDays, startOfToday } from "date-fns";
import { Idea, Task } from "./types";

const today = startOfToday();

export const mockTasks: Task[] = [
  {
    id: "task-1",
    title: "Deep work: product roadmap",
    description: "Turn raw goals into next sprint milestones.",
    estimated_minutes: 120,
    actual_minutes: 80,
    start_time: addHours(today, 9).toISOString(),
    end_time: addHours(today, 11).toISOString(),
    priority: "urgent",
    deadline: addHours(today, 18).toISOString(),
    tags: ["strategy", "deep-work"],
    productivity_score: 86,
    deep_work_score: 91,
    ai_priority_score: 94,
    status: "in_progress",
    notes: "Protect this block.",
    recurrence_rule: null,
    context_switches: 1,
    idle_minutes: 5
  },
  {
    id: "task-2",
    title: "Ship task API tests",
    description: "Cover CRUD, scoring and auth paths.",
    estimated_minutes: 90,
    actual_minutes: 65,
    start_time: addHours(today, 12).toISOString(),
    end_time: addHours(today, 13).toISOString(),
    priority: "high",
    deadline: addDays(today, 1).toISOString(),
    tags: ["engineering"],
    productivity_score: 78,
    deep_work_score: 72,
    ai_priority_score: 82,
    status: "pending",
    notes: "",
    recurrence_rule: null,
    context_switches: 2,
    idle_minutes: 8
  },
  {
    id: "task-3",
    title: "Weekly reflection",
    description: "Summarize wins, misses, and next week commitments.",
    estimated_minutes: 30,
    actual_minutes: 25,
    start_time: addHours(today, 20).toISOString(),
    end_time: addHours(today, 20.5).toISOString(),
    priority: "medium",
    deadline: addDays(today, 2).toISOString(),
    tags: ["reflection"],
    productivity_score: 68,
    deep_work_score: 58,
    ai_priority_score: 51,
    status: "pending",
    notes: "",
    recurrence_rule: "FREQ=WEEKLY;BYDAY=FR",
    context_switches: 0,
    idle_minutes: 2
  }
];

export const mockIdeas: Idea[] = [
  {
    id: "idea-1",
    title: "WhatsApp-first task capture",
    description: "Voice-note and text capture that automatically becomes tagged tasks.",
    impact: 5,
    difficulty: 3,
    interest: 5,
    tags: ["ai", "mobile"],
    converted_task_id: null
  },
  {
    id: "idea-2",
    title: "Burnout early warning",
    description: "Detect overloaded weeks and suggest schedule recovery.",
    impact: 4,
    difficulty: 4,
    interest: 4,
    tags: ["wellbeing"],
    converted_task_id: null
  }
];
