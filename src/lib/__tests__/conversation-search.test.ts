import { describe, expect, it } from "vitest";

import { matchesConversationSearch } from "../conversation-search";

/** client_feedback_2026_10_21_spec.md §D5 */
const THREAD = {
  participantNames: ["Jean Transport"],
  listing: {
    title: "Sofa",
    reference: 100018,
    pickupCity: "Paris",
    dropoffCity: "Clamart",
  },
};

describe("matchesConversationSearch", () => {
  it.each(["", "  "])("matches everything on an empty search (%j)", (q) => {
    expect(matchesConversationSearch(THREAD, q)).toBe(true);
  });

  it("matches the other person and the title, as it always did", () => {
    expect(matchesConversationSearch(THREAD, "jean")).toBe(true);
    expect(matchesConversationSearch(THREAD, "sofa")).toBe(true);
  });

  it("matches either town", () => {
    expect(matchesConversationSearch(THREAD, "clamart")).toBe(true);
    expect(matchesConversationSearch(THREAD, "PARIS")).toBe(true);
  });

  it.each(["Paris → Clamart", "paris -> clamart", "paris - clamart", "Par > Cla"])(
    "matches the route typed as %j",
    (q) => {
      expect(matchesConversationSearch(THREAD, q)).toBe(true);
    }
  );

  it("does not match the route the other way round", () => {
    expect(matchesConversationSearch(THREAD, "Clamart → Paris")).toBe(false);
  });

  it("matches the reference, with or without its prefix and letters", () => {
    expect(matchesConversationSearch(THREAD, "100018")).toBe(true);
    expect(matchesConversationSearch(THREAD, "Réf. PAR-CLA-100018")).toBe(true);
    expect(matchesConversationSearch(THREAD, "100019")).toBe(false);
  });

  it("ignores accents", () => {
    const evry = { ...THREAD, listing: { ...THREAD.listing, dropoffCity: "Évry" } };
    expect(matchesConversationSearch(evry, "evry")).toBe(true);
  });

  it("still finds a title that holds a dash", () => {
    const dashed = { ...THREAD, listing: { ...THREAD.listing, title: "BETA - Bureau plat" } };
    expect(matchesConversationSearch(dashed, "beta - bureau")).toBe(true);
  });

  it("handles a thread about no job", () => {
    expect(matchesConversationSearch({ participantNames: ["Support"], listing: null }, "paris")).toBe(false);
    expect(matchesConversationSearch({ participantNames: ["Support"], listing: null }, "supp")).toBe(true);
  });
});
