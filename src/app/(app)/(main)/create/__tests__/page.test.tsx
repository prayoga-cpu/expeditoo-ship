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
async function callbackFor(query: {
  draft?: string;
  step?: string;
  publish?: string;
  type?: string;
}) {
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
  redirect.mockClear();
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

/**
 * 2.95.0: `/create` itself. It is not in the proxy's protected list, so the
 * page is what stands between a signed-out visitor and a five-step form
 * whose « Publier » can only answer 401.
 */
describe("/create, signed out", () => {
  it("sends a new request to sign in and back to the blank form", async () => {
    expect(await callbackFor({})).toBe("/create");
  });

  it("keeps « devis déménagement » a move on the way back", async () => {
    expect(await callbackFor({ type: "moving" })).toBe("/create?type=moving");
  });
});

describe("/create, signed in", () => {
  it("renders the form and redirects nowhere", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });

    const page = await CreateJobPage({ searchParams: Promise.resolve({}) });

    expect(redirect).not.toHaveBeenCalled();
    expect(page).toBeTruthy();
  });

  it("opens a draft without a detour", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });

    await CreateJobPage({ searchParams: Promise.resolve({ draft: "job-1" }) });

    expect(redirect).not.toHaveBeenCalled();
  });
});
