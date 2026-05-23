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
  Trash2,
  Target
} from "lucide-react";
import { addDays, addMinutes, format, isBefore, parseISO, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  completeTaskRequest,
  createTask,
  deleteTaskRequest,
  loadCurrentUser,
  loadIdeas,
  loadTasks,
  requestWhatsAppOtp,
  verifyWhatsAppOtp
} from "@/lib/api";
import { Idea, Task, User, Priority } from "@/lib/types";

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
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authStep, setAuthStep] = useState<"number" | "otp">("number");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authOtp, setAuthOtp] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [view, setView] = useState<(typeof nav)[number][0]>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [seconds, setSeconds] = useState(25 * 60);
  const [waInput, setWaInput] = useState("/today");
  const [waLog, setWaLog] = useState(["Momentum: Send /today, /start <task>, /stop, /done <id>, /add <task>, /move <id> <time>, or /idea <text>."]);

  useEffect(() => {
    const token = localStorage.getItem("momentum_token");
    if (!token) {
      setAuthChecked(true);
      return;
    }
    loadCurrentUser()
      .then((currentUser) => {
        setUser(currentUser);
        return Promise.all([loadTasks(), loadIdeas()]);
      })
      .then(([taskItems, ideaItems]) => {
        setTasks(taskItems);
        setIdeas(ideaItems);
      })
      .catch(() => {
        localStorage.removeItem("momentum_token");
        setUser(null);
      })
      .finally(() => setAuthChecked(true));
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

  async function addTask() {
    const start = new Date();
    const payload = {
      title: "New focused task",
      description: "Created from dashboard",
      estimated_minutes: 45,
      actual_minutes: 0,
      start_time: start.toISOString(),
      end_time: addMinutes(start, 45).toISOString(),
      priority: "medium" as Priority,
      deadline: addMinutes(start, 180).toISOString(),
      tags: ["quick-add"],
      notes: ""
    };
    const optimisticTask: Task = {
      id: crypto.randomUUID(),
      ...payload,
      priority: "medium",
      productivity_score: 0,
      deep_work_score: 0,
      ai_priority_score: 58,
      status: "pending",
      context_switches: 0,
      idle_minutes: 0
    };
    setTasks((items) => [optimisticTask, ...items]);
    try {
      const saved = await createTask(payload);
      setTasks((items) => items.map((task) => (task.id === optimisticTask.id ? saved : task)));
    } catch {
      setAuthMessage("Could not save the task to your account.");
    }
  }

  async function completeTask(id: string) {
    setTasks((items) => items.map((task) => (task.id === id ? { ...task, status: "completed", productivity_score: 90 } : task)));
    try {
      const saved = await completeTaskRequest(id);
      setTasks((items) => items.map((task) => (task.id === id ? saved : task)));
    } catch {
      setAuthMessage("Could not mark the task complete on the server.");
    }
  }

  async function deleteTask(id: string) {
    const previous = tasks;
    setTasks((items) => items.filter((task) => task.id !== id));
    if (focusTask?.id === id) {
      setFocusTask(null);
    }
    try {
      await deleteTaskRequest(id);
    } catch {
      setTasks(previous);
      setAuthMessage("Could not delete the task on the server.");
    }
  }

  function deleteIdea(id: string) {
    setIdeas((items) => items.filter((idea) => idea.id !== id));
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

  async function handleRequestOtp(event: React.FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");
    try {
      const response = await requestWhatsAppOtp(authPhone, authName || undefined);
      setAuthStep("otp");
      setAuthMessage(response.dev_otp ? `OTP sent. Local dev OTP: ${response.dev_otp}` : response.message);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Could not send OTP.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");
    try {
      const response = await verifyWhatsAppOtp(authPhone, authOtp, authName || undefined);
      localStorage.setItem("momentum_token", response.access_token);
      setUser(response.user);
      const [taskItems, ideaItems] = await Promise.all([loadTasks(), loadIdeas()]);
      setTasks(taskItems);
      setIdeas(ideaItems);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Could not verify OTP.");
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("momentum_token");
    setUser(null);
    setTasks([]);
    setIdeas([]);
    setAuthOtp("");
    setAuthStep("number");
  }

  const weekly = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(today, index - 6);
      const key = format(day, "yyyy-MM-dd");
      const dayTasks = tasks.filter((task) => {
        const sourceDate = task.deadline ?? task.start_time ?? task.end_time;
        return sourceDate ? format(parseISO(sourceDate), "yyyy-MM-dd") === key : false;
      });
      const completed = dayTasks.filter((task) => task.status === "completed").length;
      const score = dayTasks.length ? Math.round(dayTasks.reduce((sum, task) => sum + task.productivity_score, 0) / dayTasks.length) : 0;
      const focus = Number((dayTasks.reduce((sum, task) => sum + task.actual_minutes, 0) / 60).toFixed(1));
      return { day: format(day, "EEE"), score, focus, done: completed, total: dayTasks.length };
    });
  }, [tasks]);

  const hasWeeklyData = weekly.some((item) => item.total > 0 || item.focus > 0 || item.score > 0);

  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((task) => (task.tags.length ? task.tags : ["uncategorized"]).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  if (!authChecked) {
    return <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted">Loading...</main>;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-background">
              <MessageCircle size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Sign in with WhatsApp</h1>
              <p className="text-xs text-muted">We will send an OTP and task updates to this chat.</p>
            </div>
          </div>

          {authStep === "number" ? (
            <form onSubmit={handleRequestOtp} className="space-y-3">
              <input
                className="h-10 w-full rounded-md border border-line bg-background px-3 text-sm outline-none"
                placeholder="Your name"
                value={authName}
                onChange={(event) => setAuthName(event.target.value)}
              />
              <input
                className="h-10 w-full rounded-md border border-line bg-background px-3 text-sm outline-none"
                placeholder="WhatsApp number with country code, e.g. +919876543210"
                value={authPhone}
                onChange={(event) => setAuthPhone(event.target.value)}
                required
              />
              <Button className="w-full" disabled={authLoading}>
                {authLoading ? "Sending..." : "Send OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <input
                className="h-10 w-full rounded-md border border-line bg-background px-3 text-sm outline-none"
                placeholder="Enter OTP"
                value={authOtp}
                onChange={(event) => setAuthOtp(event.target.value)}
                required
              />
              <Button className="w-full" disabled={authLoading}>
                {authLoading ? "Verifying..." : "Verify and Continue"}
              </Button>
              <button type="button" onClick={() => setAuthStep("number")} className="w-full text-xs text-muted hover:text-accent">
                Change WhatsApp number
              </button>
            </form>
          )}
          {authMessage && <p className="mt-4 rounded-md border border-line bg-background p-3 text-xs text-muted">{authMessage}</p>}
        </Card>
      </main>
    );
  }

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
              <p className="text-xs text-muted">Signed in as {user.whatsapp_number}. Updates go to WhatsApp.</p>
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
              <Button onClick={logout}>Logout</Button>
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
                    <TaskList tasks={tasks.slice(0, 6)} onDone={completeTask} onDelete={deleteTask} onFocus={(task) => { setFocusTask(task); setSeconds(25 * 60); setView("focus"); }} />
                  </Card>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ChartCard title="Daily Productivity" empty={!hasWeeklyData}>
                      <AreaChart data={weekly}>
                        <CartesianGrid stroke="#263241" />
                        <XAxis dataKey="day" stroke="#9aa4b2" />
                        <YAxis stroke="#9aa4b2" />
                        <Tooltip />
                        <Area dataKey="score" stroke="#f4b942" fill="#f4b94244" />
                      </AreaChart>
                    </ChartCard>
                    <ChartCard title="Weekly Focus Hours" empty={!hasWeeklyData}>
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

              {view === "tasks" && <TaskList tasks={tasks} onDone={completeTask} onDelete={deleteTask} onFocus={(task) => { setFocusTask(task); setView("focus"); }} />}

              {view === "analytics" && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChartCard title="Task Completion Trends" empty={!hasWeeklyData}>
                    <BarChart data={weekly}>
                      <XAxis dataKey="day" stroke="#9aa4b2" />
                      <YAxis stroke="#9aa4b2" />
                      <Tooltip />
                      <Bar dataKey="done" fill="#54d68a" radius={6} />
                    </BarChart>
                  </ChartCard>
                  <ChartCard title="Category Distribution" empty={!distribution.length}>
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
                  {ideas.length ? ideas.map((idea) => (
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
                      <div className="flex gap-2">
                        <Button onClick={() => addTask()}>Convert</Button>
                        <Button aria-label={`Delete ${idea.title}`} onClick={() => deleteIdea(idea.id)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </Card>
                  )) : (
                    <Card className="py-10 text-center text-sm text-muted">No ideas yet. Save one from WhatsApp with /idea or add your first project concept.</Card>
                  )}
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
                      <div className="flex items-center gap-2">
                        <span className="rounded-sm bg-accent px-2 py-1 text-xs font-semibold text-background">{Math.round(task.ai_priority_score)}</span>
                        <button aria-label={`Delete ${task.title}`} onClick={() => deleteTask(task.id)} className="text-muted transition hover:text-red">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <div className={`mt-3 text-xs ${task.deadline && isBefore(parseISO(task.deadline), new Date()) ? "text-red" : "text-muted"}`}>
                      {task.priority.toUpperCase()} priority
                    </div>
                  </Card>
                ))}
                {!deadlines.length && <Card className="bg-background py-8 text-center text-xs text-muted">No deadlines yet.</Card>}
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

function TaskList({
  tasks,
  onDone,
  onDelete,
  onFocus
}: {
  tasks: Task[];
  onDone: (id: string) => void;
  onDelete: (id: string) => void;
  onFocus: (task: Task) => void;
}) {
  if (!tasks.length) {
    return <Card className="py-10 text-center text-sm text-muted">No tasks yet. Create your first task to start planning.</Card>;
  }

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
          <Button aria-label={`Delete ${task.title}`} onClick={() => onDelete(task.id)}>
            <Trash2 size={14} />
          </Button>
        </Card>
      ))}
    </div>
  );
}

function ChartCard({ title, children, empty }: { title: string; children: React.ReactElement; empty?: boolean }) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="h-72">
        {empty ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-line text-sm text-muted">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
