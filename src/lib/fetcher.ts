/**
 * Typed client for the REST layer.
 *
 * Every route answers with the envelope produced by `src/lib/api-response.ts`,
 * so unwrapping and error translation happen once here rather than in each
 * hook (docs/rules.md §3.5).
 */

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    issues?: { path: string; message: string }[];
  };
}

/** Carries the server's error code so callers can branch on it. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly issues?: { path: string; message: string }[]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError("INVALID_RESPONSE", "Unexpected server response", res.status);
  }

  if (!res.ok || !envelope.success) {
    throw new ApiError(
      envelope.error?.code ?? "UNKNOWN",
      envelope.error?.message ?? "Request failed",
      res.status,
      envelope.error?.issues
    );
  }

  return envelope.data as T;
}

const withBody = (method: string) =>
  <T,>(url: string, body?: unknown) =>
    request<T>(url, {
      method,
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    });

export const api = {
  get: <T,>(url: string) => request<T>(url),
  post: withBody("POST"),
  patch: withBody("PATCH"),
  delete: <T,>(url: string) => request<T>(url, { method: "DELETE" }),
};

/** Serialises a filter object into a query string, dropping empty values. */
export function toQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
