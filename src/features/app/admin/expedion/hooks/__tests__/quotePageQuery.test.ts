import { describe, expect, it } from "vitest";

import { quotePageQuery, QUOTE_PAGE_LIMIT } from "../useExpedionReport";

/** client_feedback_2026_10_29_spec.md §A2 — the window « Récents » asks for. */
describe("quotePageQuery", () => {
  const read = (qs: string) => Object.fromEntries(new URLSearchParams(qs));

  it("asks for the order and the page, with no window when none is picked", () => {
    const q = read(quotePageQuery({ from: "", to: "", order: "asc", page: 3 }));
    expect(q).toEqual({ order: "asc", page: "3", limit: String(QUOTE_PAGE_LIMIT) });
  });

  it("turns the picked days into the operator's own midnights", () => {
    const q = read(quotePageQuery({ from: "2026-10-03", to: "2026-10-05", order: "desc", page: 1 }));
    expect(new Date(q.from).getTime()).toBe(new Date(2026, 9, 3).getTime());
    // `to` is exclusive: the day after the last day picked, so the 5th counts whole.
    expect(new Date(q.to).getTime()).toBe(new Date(2026, 9, 6).getTime());
  });

  it("allows an open-ended window on either side", () => {
    expect(read(quotePageQuery({ from: "2026-10-03", to: "", order: "desc", page: 1 })).to).toBeUndefined();
    expect(read(quotePageQuery({ from: "", to: "2026-10-05", order: "desc", page: 1 })).from).toBeUndefined();
  });
});
