import { mockIdeas, mockTasks } from "./mock-data";
import { Idea, Task, User } from "./types";

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

export async function requestWhatsAppOtp(whatsappNumber: string, name?: string): Promise<{ message: string; dev_otp?: string | null }> {
  return apiFetch("/auth/whatsapp/request-otp", {
    method: "POST",
    body: JSON.stringify({ whatsapp_number: whatsappNumber, name })
  });
}

export async function verifyWhatsAppOtp(
  whatsappNumber: string,
  otp: string,
  name?: string
): Promise<{ access_token: string; token_type: string; user: User }> {
  return apiFetch("/auth/whatsapp/verify", {
    method: "POST",
    body: JSON.stringify({ whatsapp_number: whatsappNumber, otp, name })
  });
}

export async function loadCurrentUser(): Promise<User> {
  return apiFetch<User>("/auth/me");
}

export async function createTask(payload: Partial<Task> & { title: string }): Promise<Task> {
  return apiFetch<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function completeTaskRequest(id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/done`, { method: "POST" });
}

export async function deleteTaskRequest(id: string): Promise<void> {
  await fetch(`${API_URL}/tasks/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("momentum_token") ?? ""}`
    }
  });
}
