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
vi.mock("@/features/app/create/ui/PrefilledRequestForm", () => ({
  PrefilledRequestForm: () => null,
}));

import CreateJobPage from "../page";
import { DraftForm, NewRequestForm } from "@/features/app/create/ui/RequestForms";
import { PrefilledRequestForm } from "@/features/app/create/ui/PrefilledRequestForm";

type Query = {
  draft?: string;
  step?: string;
  publish?: string;
  type?: string;
  title?: string;
  from?: string;
  to?: string;
  date?: string;
};

/** A day well ahead of any clock this suite runs on, as `YYYY-MM-DD`. */
function dayAhead(days: number) {
  const d = new Date(Date.now() + days * 24 * 3600_000);
  return d.toISOString().slice(0, 10);
}

/** Where the sign-in page is told to come back to. */
async function callbackFor(query: Query) {
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

/**
 * landing_2026_11_spec.md §5 — the landing page's search card. Its four
 * values are checked here, carried through sign-in, and never applied to a
 * draft.
 */
describe("/create?title=&from=&to=&date=", () => {
  it("comes back from sign-in with the checked values", async () => {
    const date = dayAhead(10);
    const callback = await callbackFor({ title: "Piano droit", from: "Paris", to: "Lyon", date });
    const back = new URL(callback ?? "", "https://expeditoo.test");

    expect(back.pathname).toBe("/create");
    expect(Object.fromEntries(back.searchParams)).toEqual({
      title: "Piano droit",
      from: "Paris",
      to: "Lyon",
      date,
    });
  });

  it("drops what fails its check on the way through sign-in", async () => {
    expect(await callbackFor({ title: "Piano", from: "<script>", date: "2020-01-01" })).toBe(
      "/create?title=Piano"
    );
  });

  it("keeps a move a move beside the prefill", async () => {
    expect(await callbackFor({ type: "moving", from: "Lille" })).toBe(
      "/create?type=moving&from=Lille"
    );
  });

  it("carries no prefill on a draft's way back", async () => {
    expect(await callbackFor({ draft: "job-1", title: "Piano", from: "Paris" })).toBe(
      "/create?draft=job-1"
    );
  });

  it("opens a new request with the prefill once signed in", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });

    const page = await CreateJobPage({
      searchParams: Promise.resolve({ title: "Piano", to: "Lyon", from: "<b>" }),
    });

    expect(page.type).toBe(PrefilledRequestForm);
    expect(page.props).toEqual({ kind: "items", prefill: { title: "Piano", to: "Lyon" } });
  });

  it("opens the blank form when nothing in the query survives", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });

    const page = await CreateJobPage({ searchParams: Promise.resolve({ from: "<b>" }) });

    expect(page.type).toBe(NewRequestForm);
  });

  it("never applies a prefill to a draft", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });

    const page = await CreateJobPage({
      searchParams: Promise.resolve({ draft: "job-1", title: "Piano", from: "Paris" }),
    });

    expect(page.type).toBe(DraftForm);
    expect(page.props).not.toHaveProperty("prefill");
  });
});
