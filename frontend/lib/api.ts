import { mockIdeas, mockTasks } from "./mock-data";
import { Idea, Task } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("momentum_token") : null;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function loadTasks(): Promise<Task[]> {
  try {
    return await apiFetch<Task[]>("/tasks");
  } catch {
    return mockTasks;
  }
}

export async function loadIdeas(): Promise<Idea[]> {
  try {
    return await apiFetch<Idea[]>("/ideas");
  } catch {
    return mockIdeas;
  }
}
