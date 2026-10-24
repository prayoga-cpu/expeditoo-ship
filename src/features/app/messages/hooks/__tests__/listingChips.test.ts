import { describe, expect, it } from "vitest";

import type { Job } from "@/features/app/listing/types";
import type { ConversationResponse } from "../../api";
import { listingChips } from "../useMessages";

/** client_feedback_2026_10_21_spec.md §D5 */
const conv = (id: string, listing: ConversationResponse["listing"]) =>
  ({
    id,
    listing,
    otherParticipant: null,
    lastMessageAt: null,
    lastMessage: null,
    isUnread: false,
  }) as ConversationResponse;

describe("listingChips", () => {
  it("offers each job with a thread once, then the viewer's own live requests", () => {
    const chips = listingChips(
      [
        conv("c1", { id: "j1", title: "Sofa", reference: 1, pickupCity: "Paris", dropoffCity: "Clamart" }),
        conv("c2", { id: "j1", title: "Sofa", reference: 1, pickupCity: "Paris", dropoffCity: "Clamart" }),
        conv("c3", null),
      ],
      [
        { id: "j1", title: "Sofa", pickupCity: "Paris", dropoffCity: "Clamart" } as Job,
        { id: "j2", title: "Fauteuil", pickupCity: "Vannes", dropoffCity: "Montrouge" } as Job,
      ]
    );

    expect(chips).toEqual([
      { id: "j1", route: "Paris → Clamart", title: "Sofa", own: true },
      { id: "j2", route: "Vannes → Montrouge", title: "Fauteuil", own: true },
    ]);
  });

  it("marks a job the viewer does not own", () => {
    const [chip] = listingChips(
      [conv("c1", { id: "j9", title: "Armoire", reference: 2, pickupCity: "Caen", dropoffCity: "Rennes" })],
      []
    );
    expect(chip.own).toBe(false);
  });
});
