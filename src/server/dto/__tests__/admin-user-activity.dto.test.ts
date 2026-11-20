import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/services/user.service", () => ({ hasAnyRole: vi.fn() }));
vi.mock("@/server/dal/carriers.dal", () => ({ carriersDal: { getByUserId: vi.fn() } }));

import {
  toConversationView,
  toMessageView,
  toOfferView,
  toPage,
  toRequestView,
  type ActivityConversationRow,
  type ActivityMessageRow,
  type ActivityOfferRow,
  type ActivityRequestRow,
} from "../admin-user-activity.dto";
import {
  COORDINATE_FIELDS,
  PRIVATE_LISTING_FIELDS,
  VETTED_LISTING_FIELDS,
} from "@/server/services/listing-view";

/**
 * admin_user_management_spec.md §7.4 — what « Demandes et messages » puts on
 * the wire. The lists are narrower than the staff `full` view of a listing:
 * towns, never a street, a pin, a contact or the requester's row
 * (CLAUDE.md gotcha 16). Each projection is pinned key by key, so a new
 * field is a decision and not an accident.
 */

const NOW = new Date("2026-11-20T10:00:00.000Z");

/** A listing row as the DAL could one day hand it over: with everything on it. */
const wideJob = {
  id: "l1",
  reference: 100042,
  title: "Commode Louis XV",
  pickupCity: "Lyon",
  dropoffCity: "Marseille",
  status: "open",
  shipperId: "u1",
  pickupAddress: "12 rue de la République",
  dropoffAddress: "3 quai du Port",
  pickupPostalCode: "69002",
  dropoffPostalCode: "13002",
  pickupLat: 45.76,
  pickupLng: 4.83,
  dropoffLat: 43.29,
  dropoffLng: 5.37,
  pickupNote: "Code 4521",
  pickupContactName: "Mme Martin",
  pickupContactPhone: "+33612345678",
  dropoffNote: "Sonner deux fois",
  dropoffContactName: "M. Durand",
  dropoffContactPhone: "+33698765432",
  budgetCents: 50_000,
  shipper: { id: "u1", email: "n@example.com", stripeCustomerId: "cus_123" },
};

const JOB_KEYS = ["dropoffCity", "id", "pickupCity", "reference", "status", "title"];

const FORBIDDEN = [
  ...VETTED_LISTING_FIELDS,
  ...COORDINATE_FIELDS,
  ...PRIVATE_LISTING_FIELDS,
  "pickupPostalCode",
  "dropoffPostalCode",
  "shipper",
  "shipperId",
  "email",
  "phone",
  "stripeCustomerId",
];

/** Every key at every depth of a projection. */
function keysDeep(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) => [
    key,
    ...keysDeep(inner),
  ]);
}

function expectNothingPrivate(view: unknown) {
  const keys = keysDeep(view);
  for (const field of FORBIDDEN) expect(keys).not.toContain(field);
  const text = JSON.stringify(view);
  for (const secret of ["République", "quai du Port", "69002", "+336", "Code 4521", "cus_123"]) {
    expect(text).not.toContain(secret);
  }
}

describe("toRequestView", () => {
  const row = {
    ...wideJob,
    pickupFrom: NOW,
    expiresAt: NOW,
    offersCount: 3,
    createdAt: NOW,
  } as ActivityRequestRow;

  it("carries exactly the ten fields of a request line", () => {
    expect(Object.keys(toRequestView(row)).sort()).toEqual(
      [...JOB_KEYS, "createdAt", "expiresAt", "offersCount", "pickupFrom"].sort()
    );
  });

  it("drops the street, the pin, the contacts and the requester from a wider row", () => {
    expectNothingPrivate(toRequestView(row));
  });

  it("writes dates as ISO strings", () => {
    expect(toRequestView(row).pickupFrom).toBe("2026-11-20T10:00:00.000Z");
  });
});

describe("toOfferView", () => {
  const row = {
    id: "o1",
    priceCents: 21_000,
    status: "pending",
    createdAt: NOW,
    job: wideJob,
    message: "Je peux passer mardi",
    carrierId: "u1",
    counterNote: "trop cher",
    proposedBy: "admin-1",
  } as ActivityOfferRow;

  it("carries the price, the status, the date and the job line — nothing else", () => {
    const view = toOfferView(row);

    expect(Object.keys(view).sort()).toEqual(["createdAt", "id", "job", "priceCents", "status"]);
    expect(Object.keys(view.job).sort()).toEqual(JOB_KEYS);
  });

  it("never carries who recommended the offer, nor the job's private fields", () => {
    const view = toOfferView(row);

    expect(keysDeep(view)).not.toContain("proposedBy");
    expectNothingPrivate(view);
  });
});

describe("toConversationView", () => {
  const row = {
    id: "c1",
    type: "LISTING",
    lastMessageAt: null,
    createdAt: NOW,
    job: wideJob,
    others: [{ id: "u2", name: "Jean Transport", email: "jean@example.com", phone: "+33611111111" }],
    messageCount: 4,
  } as unknown as ActivityConversationRow;

  it("names the other party by id and name only", () => {
    const view = toConversationView(row);

    expect(view.others).toEqual([{ id: "u2", name: "Jean Transport" }]);
    expect(Object.keys(view).sort()).toEqual(
      ["createdAt", "id", "job", "lastMessageAt", "messageCount", "others", "type"].sort()
    );
    expectNothingPrivate(view);
  });

  it("keeps a conversation with no job and no message readable", () => {
    const view = toConversationView({ ...row, job: null });

    expect(view.job).toBeNull();
    expect(view.lastMessageAt).toBeNull();
  });
});

describe("toMessageView", () => {
  const row: ActivityMessageRow = {
    id: "m1",
    senderId: "u2",
    senderName: "Jean Transport",
    content: "Bonjour",
    attachmentUrl: "https://files.example/a.jpg",
    createdAt: NOW,
    offerPriceCents: null,
    offerStatus: null,
  };

  it("says a file is attached without serving its address", () => {
    const view = toMessageView(row);

    expect(view.hasAttachment).toBe(true);
    expect(JSON.stringify(view)).not.toContain("files.example");
  });

  it("carries no read flag: staff reading is not the participant reading", () => {
    const view = toMessageView({ ...row, isRead: true } as ActivityMessageRow);

    expect(Object.keys(view).sort()).toEqual(
      ["content", "createdAt", "hasAttachment", "id", "offer", "senderId", "senderName"].sort()
    );
  });

  it("reduces a thread offer to its price and status", () => {
    expect(toMessageView({ ...row, offerPriceCents: 21_000, offerStatus: "accepted" }).offer).toEqual({
      priceCents: 21_000,
      status: "accepted",
    });
  });
});

describe("toPage", () => {
  it("knows when there is more to read", () => {
    expect(toPage([1], 1, 51).hasMore).toBe(true);
    expect(toPage([1], 2, 51).hasMore).toBe(false);
    expect(toPage([], 1, 0)).toMatchObject({ page: 1, pageSize: 50, total: 0, hasMore: false });
  });
});
