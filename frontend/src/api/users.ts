export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface UserInput {
  name: string;
  email: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function extractErrorMessage(body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item === "object" && item && "msg" in item ? String(item.msg) : String(item)))
      .join(", ");
  }
  if (typeof detail === "string") {
    return detail;
  }
  return "Request failed";
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(extractErrorMessage(body));
  }
  return response.json();
}

export async function fetchUsers(): Promise<User[]> {
  const response = await fetch(`${API_URL}/users`);
  return handleResponse<User[]>(response);
}

export async function createUser(input: UserInput): Promise<User> {
  const response = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse<User>(response);
}

export async function updateUser(id: number, input: UserInput): Promise<User> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse<User>(response);
}

export async function deleteUser(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/users/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(extractErrorMessage(body));
  }
}

export async function bulkCreateUsers(inputs: UserInput[]): Promise<User[]> {
  const response = await fetch(`${API_URL}/users/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inputs),
  });
  return handleResponse<User[]>(response);
}

export async function bulkDeleteUsers(ids: number[]): Promise<{ deleted: number }> {
  const response = await fetch(`${API_URL}/users/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  return handleResponse<{ deleted: number }>(response);
}

export function getExportUrl(): string {
  return `${API_URL}/users/export`;
}

export async function importUsersCsv(file: File): Promise<{ imported: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/users/import`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<{ imported: number }>(response);
}
