"use client";

import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Bell,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  Gauge,
  Lightbulb,
  ListTodo,
  MessageCircle,
  Moon,
  Play,
  Plus,
  Send,
  Sparkles,
  Target
} from "lucide-react";
import { addMinutes, format, isBefore, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadIdeas, loadTasks } from "@/lib/api";
import { Idea, Task } from "@/lib/types";

const nav = [
  ["dashboard", Gauge, "Dashboard"],
  ["calendar", CalendarDays, "Calendar"],
  ["tasks", ListTodo, "Tasks"],
  ["analytics", Brain, "Analytics"],
  ["ideas", Lightbulb, "Idea Vault"],
  ["whatsapp", MessageCircle, "WhatsApp"],
  ["focus", Target, "Focus"]
] as const;

const colors = ["#f4b942", "#4cc9f0", "#54d68a", "#ff6b7a", "#a78bfa"];

export default function Page() {
  const [view, setView] = useState<(typeof nav)[number][0]>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [seconds, setSeconds] = useState(25 * 60);
  const [waInput, setWaInput] = useState("/today");
  const [waLog, setWaLog] = useState(["Momentum: Send /today, /start <task>, /stop, /done <id>, /add <task>, /move <id> <time>, or /idea <text>."]);

  useEffect(() => {
    loadTasks().then(setTasks);
    loadIdeas().then(setIdeas);
  }, []);

  useEffect(() => {
    if (!focusTask) return;
    const id = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [focusTask]);

  const metrics = useMemo(() => {
    const completed = tasks.filter((task) => task.status === "completed").length;
    const totalMinutes = tasks.reduce((sum, task) => sum + task.actual_minutes, 0);
    const avg = (key: "productivity_score" | "deep_work_score") =>
      tasks.length ? Math.round(tasks.reduce((sum, task) => sum + task[key], 0) / tasks.length) : 0;
    return { completed, total: tasks.length, totalMinutes, productivity: avg("productivity_score"), deep: avg("deep_work_score") };
  }, [tasks]);

  const deadlines = [...tasks]
    .filter((task) => task.status !== "completed")
    .sort((a, b) => (b.ai_priority_score ?? 0) - (a.ai_priority_score ?? 0))
    .slice(0, 8);

  function addTask() {
    const start = new Date();
    const task: Task = {
      id: crypto.randomUUID(),
      title: "New focused task",
      description: "Created from dashboard",
      estimated_minutes: 45,
      actual_minutes: 0,
      start_time: start.toISOString(),
      end_time: addMinutes(start, 45).toISOString(),
      priority: "medium",
      deadline: addMinutes(start, 180).toISOString(),
      tags: ["quick-add"],
      productivity_score: 0,
      deep_work_score: 0,
      ai_priority_score: 58,
      status: "pending",
      notes: "",
      context_switches: 0,
      idle_minutes: 0
    };
    setTasks((items) => [task, ...items]);
  }

  function completeTask(id: string) {
    setTasks((items) => items.map((task) => (task.id === id ? { ...task, status: "completed", productivity_score: 90 } : task)));
  }

  function runCommand() {
    const text = waInput.trim();
    if (!text) return;
    let response = "Momentum: Command received.";
    if (text === "/today") {
      response = `Momentum: ${tasks.length} tasks today. Top priority: ${deadlines[0]?.title ?? "nothing urgent"}.`;
    } else if (text.startsWith("/add ")) {
      addTask();
      response = `Momentum: Added "${text.slice(5)}".`;
    } else if (text.startsWith("/idea ")) {
      const idea: Idea = { id: crypto.randomUUID(), title: text.slice(6), description: text.slice(6), impact: 3, difficulty: 3, interest: 4, tags: ["whatsapp"] };
      setIdeas((items) => [idea, ...items]);
      response = "Momentum: Saved to idea vault.";
    } else if (text.startsWith("/done ")) {
      completeTask(text.slice(6));
      response = "Momentum: Marked complete if the ID matched.";
    }
    setWaLog((items) => [...items, `You: ${text}`, response]);
    setWaInput("");
  }

  const weekly = [
    { day: "Mon", score: 64, focus: 3.5, done: 5 },
    { day: "Tue", score: 82, focus: 5.2, done: 8 },
    { day: "Wed", score: 71, focus: 4.4, done: 6 },
    { day: "Thu", score: 88, focus: 6.1, done: 9 },
    { day: "Fri", score: 76, focus: 4.8, done: 7 }
  ];

  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((task) => (task.tags.length ? task.tags : ["uncategorized"]).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-panel p-4 md:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-background">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="font-semibold">Momentum</div>
              <div className="text-xs text-muted">Productivity OS</div>
            </div>
          </div>
          <nav className="space-y-1">
            {nav.map(([key, Icon, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition ${view === key ? "bg-accent text-background" : "text-muted hover:bg-panel2 hover:text-foreground"}`}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-background/90 px-4 py-3 backdrop-blur md:px-6">
            <div>
              <h1 className="text-lg font-semibold capitalize">{view.replace("-", " ")}</h1>
              <p className="text-xs text-muted">AI scheduling, focus tracking, deadlines, and WhatsApp control.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={addTask}>
                <Plus size={16} />
                Task
              </Button>
              <Button onClick={() => setView("focus")}>
                <Play size={16} />
                Focus
              </Button>
            </div>
          </header>

          <div className="grid gap-0 xl:grid-cols-[1fr_320px]">
            <div className="p-4 md:p-6">
              {view === "dashboard" && (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric icon={<CheckCircle2 size={18} />} label="Completion" value={`${metrics.completed}/${metrics.total}`} />
                    <Metric icon={<Clock size={18} />} label="Tracked" value={`${Math.round(metrics.totalMinutes / 60)}h`} />
                    <Metric icon={<Brain size={18} />} label="Productivity" value={`${metrics.productivity}%`} />
                    <Metric icon={<Target size={18} />} label="Deep work" value={`${metrics.deep}%`} />
                  </div>
                  <Card className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="font-semibold">Today’s Operating Plan</h2>
                      <Button onClick={() => setView("calendar")}>Optimize</Button>
                    </div>
                    <TaskList tasks={tasks.slice(0, 6)} onDone={completeTask} onFocus={(task) => { setFocusTask(task); setSeconds(25 * 60); setView("focus"); }} />
                  </Card>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ChartCard title="Daily Productivity">
                      <AreaChart data={weekly}>
                        <CartesianGrid stroke="#263241" />
                        <XAxis dataKey="day" stroke="#9aa4b2" />
                        <YAxis stroke="#9aa4b2" />
                        <Tooltip />
                        <Area dataKey="score" stroke="#f4b942" fill="#f4b94244" />
                      </AreaChart>
                    </ChartCard>
                    <ChartCard title="Weekly Focus Hours">
                      <BarChart data={weekly}>
                        <CartesianGrid stroke="#263241" />
                        <XAxis dataKey="day" stroke="#9aa4b2" />
                        <YAxis stroke="#9aa4b2" />
                        <Tooltip />
                        <Bar dataKey="focus" fill="#4cc9f0" radius={6} />
                      </BarChart>
                    </ChartCard>
                  </div>
                </div>
              )}

              {view === "calendar" && (
                <Card className="p-3">
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
                    editable
                    selectable
                    height="78vh"
                    events={tasks.map((task) => ({
                      id: task.id,
                      title: task.title,
                      start: task.start_time ?? task.deadline ?? new Date().toISOString(),
                      end: task.end_time ?? addMinutes(parseISO(task.start_time ?? new Date().toISOString()), task.estimated_minutes).toISOString(),
                      backgroundColor: task.priority === "urgent" ? "#ff6b7a" : task.priority === "high" ? "#f4b942" : "#4cc9f0"
                    }))}
                    eventDrop={(info) => setTasks((items) => items.map((task) => (task.id === info.event.id ? { ...task, start_time: info.event.start?.toISOString() } : task)))}
                    eventResize={(info) => setTasks((items) => items.map((task) => (task.id === info.event.id ? { ...task, end_time: info.event.end?.toISOString() } : task)))}
                  />
                </Card>
              )}

              {view === "tasks" && <TaskList tasks={tasks} onDone={completeTask} onFocus={(task) => { setFocusTask(task); setView("focus"); }} />}

              {view === "analytics" && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChartCard title="Task Completion Trends">
                    <BarChart data={weekly}>
                      <XAxis dataKey="day" stroke="#9aa4b2" />
                      <YAxis stroke="#9aa4b2" />
                      <Tooltip />
                      <Bar dataKey="done" fill="#54d68a" radius={6} />
                    </BarChart>
                  </ChartCard>
                  <ChartCard title="Category Distribution">
                    <PieChart>
                      <Pie data={distribution} dataKey="value" nameKey="name" outerRadius={90}>
                        {distribution.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ChartCard>
                  <Card className="lg:col-span-2">
                    <h2 className="mb-3 font-semibold">AI Reflection Summary</h2>
                    <p className="text-sm leading-6 text-muted">
                      Completion is strongest when deep work is placed before noon. The current workload is balanced, but urgent tasks should stay limited to one or two per day to reduce recovery debt.
                    </p>
                  </Card>
                </div>
              )}

              {view === "ideas" && (
                <div className="grid gap-3">
                  {ideas.map((idea) => (
                    <Card key={idea.id} className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-semibold">{idea.title}</h2>
                        <p className="mt-1 text-sm text-muted">{idea.description}</p>
                        <div className="mt-3 flex gap-2 text-xs text-muted">
                          <span>Impact {idea.impact}</span>
                          <span>Difficulty {idea.difficulty}</span>
                          <span>Interest {idea.interest}</span>
                        </div>
                      </div>
                      <Button onClick={() => addTask()}>Convert</Button>
                    </Card>
                  ))}
                </div>
              )}

              {view === "whatsapp" && (
                <Card className="mx-auto max-w-2xl p-0">
                  <div className="border-b border-line p-4">
                    <h2 className="font-semibold">WhatsApp Assistant Simulator</h2>
                    <p className="text-xs text-muted">The backend webhook accepts Meta Cloud API and Twilio payloads.</p>
                  </div>
                  <div className="h-96 space-y-2 overflow-auto p-4">
                    {waLog.map((line, index) => (
                      <div key={index} className={`max-w-[80%] rounded-lg p-3 text-sm ${line.startsWith("You:") ? "ml-auto bg-green text-background" : "bg-panel2"}`}>
                        {line}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 border-t border-line p-3">
                    <input className="h-10 flex-1 rounded-md border border-line bg-background px-3 text-sm outline-none" value={waInput} onChange={(event) => setWaInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && runCommand()} />
                    <Button onClick={runCommand}>
                      <Send size={16} />
                    </Button>
                  </div>
                </Card>
              )}

              {view === "focus" && (
                <div className="flex min-h-[70vh] items-center justify-center">
                  <Card className="w-full max-w-xl text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-accent text-background">
                      <Target size={30} />
                    </div>
                    <h2 className="text-2xl font-semibold">{focusTask?.title ?? "Select a task to begin"}</h2>
                    <div className="my-8 font-mono text-7xl font-semibold">
                      {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
                    </div>
                    <div className="flex justify-center gap-2">
                      <Button onClick={() => setSeconds(25 * 60)}>Pomodoro</Button>
                      <Button onClick={() => setSeconds(50 * 60)}>Deep Block</Button>
                      <Button onClick={() => focusTask && completeTask(focusTask.id)}>Done</Button>
                    </div>
                  </Card>
                </div>
              )}
            </div>

            <aside className="border-l border-line bg-panel/55 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Deadline Rail</h2>
                <Bell size={17} className="text-accent" />
              </div>
              <div className="space-y-3">
                {deadlines.map((task) => (
                  <Card key={task.id} className="bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium">{task.title}</h3>
                        <p className="mt-1 text-xs text-muted">{task.deadline ? format(parseISO(task.deadline), "MMM d, h:mm a") : "No deadline"}</p>
                      </div>
                      <span className="rounded-sm bg-accent px-2 py-1 text-xs font-semibold text-background">{Math.round(task.ai_priority_score)}</span>
                    </div>
                    <div className={`mt-3 text-xs ${task.deadline && isBefore(parseISO(task.deadline), new Date()) ? "text-red" : "text-muted"}`}>
                      {task.priority.toUpperCase()} priority
                    </div>
                  </Card>
                ))}
              </div>
              <Card className="mt-4 bg-background">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Flame size={16} className="text-accent" />
                  Burnout Signal
                </div>
                <p className="text-xs leading-5 text-muted">Low risk. You have enough spacing between deep work blocks and shallow tasks.</p>
              </Card>
              <Card className="mt-4 bg-background">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Moon size={16} className="text-cyan" />
                  6 AM IST Automation
                </div>
                <p className="text-xs leading-5 text-muted">Celery Beat sends schedule, pending tasks, deadlines, and AI insight over WhatsApp.</p>
              </Card>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between text-muted">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-semibold">{value}</div>
    </Card>
  );
}

function TaskList({ tasks, onDone, onFocus }: { tasks: Task[]; onDone: (id: string) => void; onFocus: (task: Task) => void }) {
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <Card key={task.id} className="flex items-center gap-3 bg-panel2">
          <button onClick={() => onDone(task.id)} className={`h-5 w-5 rounded-sm border ${task.status === "completed" ? "border-green bg-green" : "border-muted"}`} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{task.title}</h3>
            <p className="truncate text-xs text-muted">{task.description}</p>
          </div>
          <span className="hidden rounded-sm border border-line px-2 py-1 text-xs text-muted sm:inline">{task.priority}</span>
          <Button onClick={() => onFocus(task)}>
            <Play size={14} />
          </Button>
        </Card>
      ))}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
