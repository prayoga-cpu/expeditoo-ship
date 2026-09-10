import { describe, expect, it } from "vitest";

import {
  feedbackPriorityEnum,
  feedbackStatusEnum,
  feedbackTypeEnum,
  type FeedbackTicket,
} from "@/db/schema/feedback";
import {
  feedbackPrioritySchema,
  feedbackQuerySchema,
  feedbackStatusSchema,
  feedbackTypeSchema,
  submitFeedbackSchema,
  toAdminFeedbackView,
  toFeedbackView,
  triageFeedbackSchema,
} from "../feedback.dto";

// Covers docs/specs/feedback_spec.md §2 and §8.

function ticket(overrides: Partial<FeedbackTicket> = {}): FeedbackTicket {
  return {
    id: "fb_123456789",
    userId: "u1",
    userName: "Frozen Name",
    userEmail: "frozen@example.com",
    userRole: "shipper",
    type: "bug",
    surface: "home",
    pathname: "/home",
    description: "Something went wrong on the dashboard.",
    screenshotUrls: ["https://cdn.example.com/a.jpg"],
    appVersion: "2.37.2",
    locale: "fr",
    status: "OPEN",
    priority: "urgent",
    devNote: "internal only — do not leak",
    resolvedAt: null,
    resolvedByUserId: null,
    createdAt: new Date("2026-09-10T10:00:00Z"),
    updatedAt: new Date("2026-09-10T11:00:00Z"),
    ...overrides,
  } as FeedbackTicket;
}

describe("toFeedbackView — the privacy boundary", () => {
  it("emits exactly the submitter's fields and nothing else", () => {
    expect(Object.keys(toFeedbackView(ticket())).sort()).toEqual(
      [
        "createdAt",
        "description",
        "id",
        "screenshotUrls",
        "status",
        "surface",
        "type",
      ].sort()
    );
  });

  // Named one by one so deleting a column cannot quietly delete the assertion.
  it.each([
    "devNote",
    "priority",
    "userEmail",
    "userName",
    "userRole",
    "pathname",
    "appVersion",
    "locale",
    "resolvedAt",
    "resolvedByUserId",
    "updatedAt",
    "userId",
  ])("never leaks %s to the person the note is about", (field) => {
    expect(toFeedbackView(ticket())).not.toHaveProperty(field);
  });

  it("survives a null screenshot array", () => {
    const view = toFeedbackView(
      ticket({ screenshotUrls: null as unknown as string[] })
    );
    expect(view.screenshotUrls).toEqual([]);
  });
});

describe("toAdminFeedbackView", () => {
  it("prefers the live account over the frozen snapshot", () => {
    const view = toAdminFeedbackView(ticket(), {
      id: "u1",
      name: "Renamed Since",
      email: "new@example.com",
    });
    expect(view.reporter).toMatchObject({
      name: "Renamed Since",
      email: "new@example.com",
      accountExists: true,
    });
  });

  it("falls back to the snapshot once the account is gone", () => {
    const view = toAdminFeedbackView(ticket({ userId: null }), null);
    expect(view.reporter).toMatchObject({
      id: null,
      name: "Frozen Name",
      email: "frozen@example.com",
      accountExists: false,
    });
  });

  it("carries the internal note staff are allowed to read", () => {
    expect(toAdminFeedbackView(ticket(), null).devNote).toBe(
      "internal only — do not leak"
    );
  });
});

describe("submitFeedbackSchema", () => {
  const base = {
    type: "bug",
    surface: "home",
    description: "0123456789",
    locale: "fr",
  };

  it("accepts a description at the minimum and rejects one below it", () => {
    expect(submitFeedbackSchema.safeParse(base).success).toBe(true);
    expect(
      submitFeedbackSchema.safeParse({ ...base, description: "012345678" })
        .success
    ).toBe(false);
  });

  it("rejects a description past the maximum", () => {
    expect(
      submitFeedbackSchema.safeParse({ ...base, description: "x".repeat(2001) })
        .success
    ).toBe(false);
  });

  it("rejects a fifth screenshot", () => {
    const urls = Array.from({ length: 5 }, (_, i) => `https://x.test/${i}.jpg`);
    expect(
      submitFeedbackSchema.safeParse({ ...base, screenshotUrls: urls }).success
    ).toBe(false);
  });

  it.each(["home", "no-leading-slash", "/has space"])(
    "rejects the pathname %s unless it is a clean path",
    (pathname) => {
      expect(
        submitFeedbackSchema.safeParse({ ...base, pathname }).success
      ).toBe(false);
    }
  );

  it("strips anything the client is not allowed to decide", () => {
    const parsed = submitFeedbackSchema.parse({
      ...base,
      status: "RESOLVED",
      priority: "urgent",
      devNote: "I am not staff",
      userEmail: "someone@else.test",
    });
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("priority");
    expect(parsed).not.toHaveProperty("devNote");
    expect(parsed).not.toHaveProperty("userEmail");
  });
});

describe("the schemas derive from the database, never restate it", () => {
  it.each([
    ["type", feedbackTypeSchema.options, feedbackTypeEnum.enumValues],
    ["status", feedbackStatusSchema.options, feedbackStatusEnum.enumValues],
    ["priority", feedbackPrioritySchema.options, feedbackPriorityEnum.enumValues],
  ])("%s matches its pgEnum exactly", (_name, schemaValues, enumValues) => {
    expect([...schemaValues]).toEqual([...enumValues]);
  });
});

describe("triageFeedbackSchema", () => {
  it("refuses an empty patch, with a code the client can branch on", () => {
    const result = triageFeedbackSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("TRIAGE_PATCH_EMPTY");
      expect(result.error.issues[0].path).toEqual(["status"]);
    }
  });

  it.each([
    { status: "RESOLVED" },
    { priority: "low" },
    { devNote: "looked at it" },
    { devNote: null },
  ])("accepts %o on its own", (patch) => {
    expect(triageFeedbackSchema.safeParse(patch).success).toBe(true);
  });
});

describe("feedbackQuerySchema", () => {
  it("coerces the paging numbers a query string delivers as text", () => {
    expect(feedbackQuerySchema.parse({ limit: "10", offset: "20" })).toMatchObject(
      { limit: 10, offset: 20 }
    );
  });

  it("defaults to one page from the start", () => {
    expect(feedbackQuerySchema.parse({})).toMatchObject({
      limit: 25,
      offset: 0,
    });
  });

  it("refuses a limit past the ceiling rather than silently clamping", () => {
    expect(feedbackQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });
});
