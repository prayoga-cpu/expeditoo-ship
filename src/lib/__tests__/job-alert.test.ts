import { describe, expect, it } from "vitest";
import { jobAlertFrom } from "../job-alert";

const event = (over: Record<string, unknown> = {}) => ({
  type: "new_job",
  title: "Nouvelle course disponible",
  message: "« Canapé » : Lyon → Paris.",
  data: { listingId: "job-1", linkUrl: "/listing/job-1" },
  ...over,
});

describe("jobAlertFrom", () => {
  it("reads a new job and a route match as alerts that open the job", () => {
    expect(jobAlertFrom(event())).toEqual({
      title: "Nouvelle course disponible",
      message: "« Canapé » : Lyon → Paris.",
      href: "/listing/job-1",
    });
    expect(jobAlertFrom(event({ type: "carrier_route_match" }))?.href).toBe("/listing/job-1");
  });

  it("builds the link from the listing id when no link was sent", () => {
    expect(jobAlertFrom(event({ data: { listingId: "job-2" } }))?.href).toBe("/listing/job-2");
  });

  it("ignores every other kind of notification", () => {
    expect(jobAlertFrom(event({ type: "message" }))).toBeNull();
    expect(jobAlertFrom(event({ type: "listing_posted" }))).toBeNull();
  });

  it("refuses a link that leaves the app, and malformed events", () => {
    expect(jobAlertFrom(event({ data: { linkUrl: "https://evil.example" } }))).toBeNull();
    expect(jobAlertFrom(event({ data: { linkUrl: "//evil.example" } }))).toBeNull();
    expect(jobAlertFrom(null)).toBeNull();
    expect(jobAlertFrom("new_job")).toBeNull();
    expect(jobAlertFrom(event({ title: 3 }))).toBeNull();
    expect(jobAlertFrom(event({ data: null }))).toBeNull();
  });
});
