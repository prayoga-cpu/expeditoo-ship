import type { ApiUser } from "../lib/map-api-user";

/**
 * Client API for the admin users surface (docs/rules.md §6: the UI talks to
 * these, never to fetch directly).
 */

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// `Parameters<typeof fetch>[1]` rather than `RequestInit`: the lint config
// declares no DOM globals for .ts files, and this needs no new ones.
async function request<T>(
  url: string,
  init?: Parameters<typeof fetch>[1]
): Promise<T> {
  const response = await fetch(url, init);
  const json: ApiEnvelope<T> = await response.json().catch(() => ({
    success: false,
  }));

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Request failed");
  }

  return json.data as T;
}

export interface UserListResponse {
  users: ApiUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function fetchUsers(params: { role?: string; search?: string } = {}) {
  const query = new URLSearchParams({ pageSize: "100" });
  if (params.role) query.set("role", params.role);
  if (params.search) query.set("search", params.search);

  return request<UserListResponse>(`/api/admin/users?${query}`);
}

export function updateUserStatus(userId: string, banned: boolean) {
  return request<{ id: string; banned: boolean }>(
    `/api/admin/users/${userId}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned }),
    }
  );
}

export function deleteUser(userId: string) {
  return request<{ id: string; email: string }>(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });
}

export function revokeUserSessions(userId: string) {
  return request<{ revoked: number }>(
    `/api/admin/users/${userId}/sessions`,
    { method: "DELETE" }
  );
}

export function sendPasswordReset(userId: string) {
  return request<{ email: string }>(
    `/api/admin/users/${userId}/password-reset`,
    { method: "POST" }
  );
}

/**
 * Impersonation lives under /api/auth rather than /api/admin: only the auth
 * layer can mint a session and sign its cookie. See src/lib/auth-impersonation.ts.
 */
async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      (json as { message?: string }).message || "Request failed"
    );
  }

  return json as T;
}

export interface ImpersonationResult {
  user: { id: string; name: string; email: string };
  expiresAt: string;
}

export function impersonateUser(userId: string) {
  return authRequest<ImpersonationResult>("/impersonate-user", { userId });
}

export function stopImpersonating() {
  return authRequest<{ user: { id: string; name: string; email: string } }>(
    "/stop-impersonating"
  );
}
