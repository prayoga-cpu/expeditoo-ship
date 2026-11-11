import { describe, expect, it } from "vitest";
import { blankForm, missingFor } from "../TripRouteFormDialog";

const place = { address: "", city: "Lyon", postalCode: "69002", lat: null, lng: null };

describe("« Créer » on the trip form never stays grey without a reason", () => {
  it("names the first thing missing, in the order the form reads", () => {
    const form = blankForm();
    expect(missingFor(form)).toBe("origin");
    expect(missingFor({ ...form, origin: place })).toBe("destination");
    expect(missingFor({ ...form, origin: place, destination: place })).toBe("days");
    expect(
      missingFor({ ...form, kind: "occasional", origin: place, destination: place })
    ).toBe("dates");
  });

  it("is satisfied by two towns and a weekday — no street, no pin", () => {
    expect(
      missingFor({ ...blankForm(), origin: place, destination: place, daysOfWeek: [2] })
    ).toBeNull();
  });
});
