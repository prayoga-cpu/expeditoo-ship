import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * expedion_source_hidden_spec.md — the client's "No need to inform about
 * expedion-Encheres". An escalated job's title and description are what a
 * driver reads on the board and the job page, so neither may say where the job
 * came from. `origin` says it, for operators.
 *
 * A file of its own rather than a case in `expedion-escalation.escalate.test.ts`,
 * which other work was editing at the same time; the harness is the same.
 */

vi.mock("@/server/dal/expedion.dal", () => ({
  expedionDal: {
    getById: vi.fn(),
    update: vi.fn(),
    addEvent: vi.fn(),
    claimForEscalation: vi.fn(),
  },
}));
vi.mock("@/server/dal/listings.dal", () => ({
  listingsDal: { getByExternalRef: vi.fn(), update: vi.fn() },
}));
vi.mock("@/server/services/listings.service", () => ({
  listingsService: { createListing: vi.fn() },
}));
vi.mock("@/server/services/offers.service", () => ({
  offersService: { submitOffer: vi.fn(), acceptOffer: vi.fn() },
}));
vi.mock("@/server/dal/carriers.dal", () => ({
  carriersDal: { getById: vi.fn(), getByUserId: vi.fn() },
}));
vi.mock("@/server/dal/users.dal", () => ({ userHasRole: vi.fn() }));
vi.mock("@/server/services/expedion-sms.service", () => ({
  expedionSmsService: { deliveryUpdate: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/server/services/expedion-realtime.service", () => ({
  notifyExpedionAdmins: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/db", () => ({
  db: {
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})),
    query: { categories: { findFirst: vi.fn() } },
    select: vi.fn(),
  },
}));

import { expedionEscalationService } from "../expedion-escalation.service";
import { expedionDal } from "@/server/dal/expedion.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { listingsService } from "@/server/services/listings.service";
import { db } from "@/db";

const paidQuote = (over: Record<string, unknown> = {}) => ({
  id: "q_1",
  status: "paid",
  paymentStatus: "paid",
  listingId: null,
  acceptedPriceCents: 10_000,
  weightKg: 40,
  description: "Commode Louis XV, lot 12",
  auctionHouseName: "Hôtel Drouot",
  bordereauNumber: "B-2026-042",
  isProtected: true,
  pickupLat: 48.87,
  pickupLng: 2.34,
  pickupAddress: "9 rue Drouot",
  pickupCity: "Paris",
  pickupPostalCode: "75009",
  deliveryLat: 43.3,
  deliveryLng: 5.37,
  deliveryAddress: "2 rue du Client",
  deliveryCity: "Marseille",
  deliveryPostalCode: "13000",
  photoUrls: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXPEDION_SYSTEM_USER_ID = "system-account";

  vi.mocked(expedionDal.getById).mockResolvedValue(paidQuote() as never);
  vi.mocked(expedionDal.claimForEscalation).mockResolvedValue(true as never);
  vi.mocked(expedionDal.update).mockResolvedValue({ phone: null } as never);
  vi.mocked(expedionDal.addEvent).mockResolvedValue(undefined as never);
  vi.mocked(listingsDal.getByExternalRef).mockResolvedValue(undefined as never);
  vi.mocked(listingsDal.update).mockResolvedValue(undefined as never);
  vi.mocked(listingsService.createListing).mockResolvedValue({
    id: "lst_new",
  } as never);
  vi.mocked(db.query.categories.findFirst).mockResolvedValue({
    id: "cat-encheres",
  } as never);
});

afterEach(() => {
  delete process.env.EXPEDION_SYSTEM_USER_ID;
});

const escalatedPayload = async () => {
  await expedionEscalationService.escalate("q_1", {});
  return vi.mocked(listingsService.createListing).mock.calls[0][1];
};

describe("expedionEscalationService.escalate — what a driver reads", () => {
  it("does not say the job came from Expedion Enchères", async () => {
    const payload = await escalatedPayload();

    expect(payload.title).not.toMatch(/expedion/i);
    expect(payload.description).not.toMatch(/expedion/i);
  });

  it("still tells the driver what they need at the pickup", async () => {
    const { description } = await escalatedPayload();

    expect(description).toContain("Commode Louis XV, lot 12");
    expect(description).toContain("Retrait chez Hôtel Drouot.");
    expect(description).toContain("Bordereau B-2026-042.");
    expect(description).toContain("Objet emballé.");
  });

  it("keeps the description over its 20-character floor with no lot text", async () => {
    vi.mocked(expedionDal.getById).mockResolvedValue(
      paidQuote({ description: null, auctionHouseName: null, bordereauNumber: null }) as never
    );

    const { description } = await escalatedPayload();

    expect(description.length).toBeGreaterThanOrEqual(20);
  });
});
