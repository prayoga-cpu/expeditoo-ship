import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/create?draft=…` without a session (draft_requests_spec.md §2): the way
 * back after signing in is the whole link — « Publier maintenant » opens the
 * Budget step with « Maintenant » chosen, and must still do so.
 */

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } },
}));
vi.mock("@/features/app/create/ui/RequestForms", () => ({
  DraftForm: () => null,
  NewRequestForm: () => null,
}));

import CreateJobPage from "../page";

/** Where the sign-in page is told to come back to. */
async function callbackFor(query: { draft?: string; step?: string; publish?: string }) {
  await expect(CreateJobPage({ searchParams: Promise.resolve(query) })).rejects.toThrow(
    "NEXT_REDIRECT"
  );
  const url = new URL(redirect.mock.calls[0][0], "https://expeditoo.test");
  expect(url.pathname).toBe("/signin");
  // Encoded whole: nothing of the link leaks out as the sign-in page's own.
  expect([...url.searchParams.keys()]).toEqual(["callbackUrl"]);
  return url.searchParams.get("callbackUrl");
}

beforeEach(() => {
  getSession.mockResolvedValue(null);
});

describe("/create?draft=…, signed out", () => {
  it("comes back to « Publier maintenant »'s Budget step", async () => {
    expect(await callbackFor({ draft: "job-1", step: "budget", publish: "now" })).toBe(
      "/create?draft=job-1&step=budget&publish=now"
    );
  });

  it("comes back to « Publier »'s Budget step", async () => {
    expect(await callbackFor({ draft: "job-1", step: "budget" })).toBe(
      "/create?draft=job-1&step=budget"
    );
  });

  it("comes back to « Reprendre » as it was", async () => {
    expect(await callbackFor({ draft: "job-1" })).toBe("/create?draft=job-1");
  });
});
