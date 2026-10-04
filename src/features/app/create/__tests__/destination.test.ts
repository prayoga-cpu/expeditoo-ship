import { describe, expect, it } from "vitest";

import { postCreateDestination } from "../destination";

// request_posted_page_spec.md §1
describe("postCreateDestination", () => {
  it("sends a published or scheduled request to its thank-you page", () => {
    expect(postCreateDestination({ id: "job-1" }, true)).toBe("/create/success/job-1");
  });

  it("sends a draft to the requester's list", () => {
    expect(postCreateDestination({ id: "job-1" }, false)).toBe("/listings/me");
  });
});
