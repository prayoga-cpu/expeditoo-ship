import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import {
  carrierDiscoveryService,
  CarrierDiscoveryError,
} from "../carrier-discovery.service";
import { carrierRoutesDal } from "@/server/dal/carrier-routes.dal";
import type { MatchCandidateRow } from "@/server/dal/carrier-routes.dal";
import { listingsDal } from "@/server/dal/listings.dal";
import { offersDal } from "@/server/dal/offers.dal";
import { paymentsService } from "@/server/services/payments.service";
import { messagesService } from "@/server/services/messages.service";
import { hasAnyRole } from "@/server/services/user.service";
import { MAX_MATCHES, MAX_MATCH_CANDIDATES } from "@/lib/route-match";
import { MAX_LEGAL_FORM_CHARS } from "@/server/dto/carrier-discovery.dto";

// Covers docs/specs/carriers_on_route_spec.md §10, the
// carrier-discovery.service.ts bullets.
//
// The DAL is mocked, so `matchRoute` runs for real against real coordinates:
// the prefilter is an optimisation and may never decide a match (spec §3.6),
// and these tests hold it to that by handing the service candidates the
// predicate then throws away.

// ========================================
// Mocks
// ========================================

/**
 * A chainable stand-in for drizzle that records the `where` it is handed.
 *
 * Only the prefilter block (§3.5) uses it: `findMatchCandidates` is the one
 * read whose eligibility rules live in SQL, so the only honest way to assert
 * "paused, non-discoverable, non-approved and banned are excluded" is to read
 * the condition the DAL builds. Every other test mocks the DAL outright.
 */
const dbStub = vi.hoisted(() => {
  const conditions: unknown[] = [];

  const builder = {
    from: () => builder,
    innerJoin: () => builder,
    where: (condition: unknown) => {
      conditions.push(condition);
      return builder;
    },
    limit: async () => [] as unknown[],
    // `exists()` serialises whatever it wraps; the subquery's own shape is not
    // what this assertion is about.
    getSQL: () => sql`1`,
  };

  return { conditions, db: { select: () => builder } };
});

vi.mock("@/db", () => ({ db: dbStub.db }));

vi.mock("@/server/dal/carrier-routes.dal", () => ({
  carrierRoutesDal: { findMatchCandidates: vi.fn() },
}));

vi.mock("@/server/dal/listings.dal", () => ({
  listingsDal: {
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    incrementViews: vi.fn(),
    createShipment: vi.fn(),
  },
}));

// Not imported by the service today. Mocked and asserted-against anyway: the
// day someone gives this discovery surface a write, spec §8 is broken and one
// of these spies is what says so.
vi.mock("@/server/dal/offers.dal", () => ({
  offersDal: {
    create: vi.fn(),
    createSlots: vi.fn(),
    updateStatus: vi.fn(),
    setPendingStatusForListing: vi.fn(),
    incrementListingOffersCount: vi.fn(),
  },
}));

vi.mock("@/server/services/payments.service", () => ({
  paymentsService: {
    chargeForShipment: vi.fn(),
    refundForJob: vi.fn(),
    schedulePayout: vi.fn(),
  },
}));

vi.mock("@/server/services/messages.service", () => ({
  messagesService: { sendMessage: vi.fn() },
}));

vi.mock("@/server/services/user.service", () => ({ hasAnyRole: vi.fn() }));

// ========================================
// Fixtures
// ========================================

// The corridor the specs argue about, borrowed from route-corridor.test.ts.
const BORDEAUX = { lat: 44.84, lng: -0.58 };
const PARIS = { lat: 48.86, lng: 2.35 };
const ANGOULEME = { lat: 45.65, lng: 0.16 };
const ORLEANS = { lat: 47.9, lng: 1.9 };

const NOW = new Date(2026, 8, 1, 9, 0);
const PICKUP_FROM = new Date(2026, 8, 7);
const PICKUP_UNTIL = new Date(2026, 8, 14, 23, 59, 59);
// 2026-09-01 is a Tuesday, so the window Mon 7th → Mon 14th holds Tue 8th.
const TUESDAY = 2;

const OWNER = "user-owner";
const OPERATOR = "user-operator";

const listing = (over: Record<string, unknown> = {}) => ({
  id: "listing-1",
  shipperId: OWNER,
  origin: "direct",
  status: "open",
  title: "Un canapé deux places",
  weightKg: 200,
  pickupCity: "Angoulême",
  pickupLat: ANGOULEME.lat,
  pickupLng: ANGOULEME.lng,
  dropoffCity: "Orléans",
  dropoffLat: ORLEANS.lat,
  dropoffLng: ORLEANS.lng,
  pickupFrom: PICKUP_FROM,
  pickupUntil: PICKUP_UNTIL,
  ...over,
});

/** A prefilter row: Bordeaux → Paris every Tuesday unless the test says otherwise. */
const candidate = (
  over: Partial<MatchCandidateRow> & { routeId: string; carrierId: string }
): MatchCandidateRow => ({
  userId: `${over.carrierId}-user`,
  userName: "Faissal B.",
  userImage: null,
  averageRating: 4,
  totalRatings: 3,
  // Most rows really are null: nothing has ever required a carrier to declare
  // one, which is the whole reason the badge is conditional (§4.4).
  legalForm: null,
  kind: "recurring",
  daysOfWeek: [TUESDAY],
  validFrom: null,
  validUntil: null,
  originCity: "Bordeaux",
  originLat: BORDEAUX.lat,
  originLng: BORDEAUX.lng,
  destinationCity: "Paris",
  destinationLat: PARIS.lat,
  destinationLng: PARIS.lng,
  radiusKm: 100,
  capacityKg: 800,
  dates: [],
  ...over,
});

/** The same trajet shifted east: still covers the job, but from further away. */
const DETOUR_SHIFT = 0.5;
const farther = (routeId: string, carrierId: string) =>
  candidate({
    routeId,
    carrierId,
    originLng: BORDEAUX.lng + DETOUR_SHIFT,
    destinationLng: PARIS.lng + DETOUR_SHIFT,
  });

/**
 * The same prefilter row, carrying columns `matchCandidateColumns` does not
 * select today.
 *
 * The cast is the point: `toMatch` spreads the row whole and lets the schema
 * strip it, so the assertion that a SIRET never reaches a card has to be made
 * against a row that actually holds one. Asserted against `candidate()` alone
 * it would pass on the fixture's silence and keep passing with the projection
 * deleted (§4.3).
 */
const withPrivateColumns = (row: MatchCandidateRow): MatchCandidateRow =>
  ({
    ...row,
    siret: "81234567800017",
    vatNumber: "FR40812345678",
  }) as MatchCandidateRow;

const givenCandidates = (rows: MatchCandidateRow[]) =>
  vi.mocked(carrierRoutesDal.findMatchCandidates).mockResolvedValue(rows);

const givenListing = (row: Record<string, unknown> | undefined) =>
  vi.mocked(listingsDal.getById).mockResolvedValue(row as never);

/** The refusal itself, so a test can read its code and status. */
async function refusal(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(CarrierDiscoveryError);
    return error as CarrierDiscoveryError;
  }

  throw new Error("expected the call to be refused");
}

/** Nothing but the message. Spec §8, asserted rather than asserted-in-prose. */
function expectNoWrites() {
  expect(listingsDal.update).not.toHaveBeenCalled();
  expect(listingsDal.delete).not.toHaveBeenCalled();
  expect(listingsDal.createShipment).not.toHaveBeenCalled();
  // `listingsService.getListing` would have fired this one, which is why the
  // service reads the listing through the DAL instead.
  expect(listingsDal.incrementViews).not.toHaveBeenCalled();
  expect(offersDal.create).not.toHaveBeenCalled();
  expect(offersDal.createSlots).not.toHaveBeenCalled();
  expect(offersDal.updateStatus).not.toHaveBeenCalled();
  expect(offersDal.setPendingStatusForListing).not.toHaveBeenCalled();
  expect(offersDal.incrementListingOffersCount).not.toHaveBeenCalled();
  expect(paymentsService.chargeForShipment).not.toHaveBeenCalled();
  expect(paymentsService.refundForJob).not.toHaveBeenCalled();
  expect(paymentsService.schedulePayout).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(hasAnyRole).mockResolvedValue(false);
  givenListing(listing());
  givenCandidates([]);
  vi.mocked(messagesService.sendMessage).mockResolvedValue({
    conversationId: "conv-1",
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

// ========================================
// The gate — §5.2, §6.3
// ========================================

describe("listForListing — who may look", () => {
  it("404s on a listing that does not exist", async () => {
    givenListing(undefined);

    const error = await refusal(() =>
      carrierDiscoveryService.listForListing(OWNER, "listing-1")
    );

    expect(error.code).toBe("LISTING_NOT_FOUND");
    expect(error.status).toBe(404);
  });

  it("gives the owner of a direct job their matches", async () => {
    givenCandidates([candidate({ routeId: "route-1", carrierId: "carrier-1" })]);

    const result = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(result.total).toBe(1);
    expect(result.items[0].matchId).toBe("route-1");
  });

  it("refuses a signed-in stranger with 403, not 404", async () => {
    const error = await refusal(() =>
      carrierDiscoveryService.listForListing("user-stranger", "listing-1")
    );

    expect(error.code).toBe("NOT_LISTING_OWNER");
    expect(error.status).toBe(403);
  });

  it("lets an operator look in the client's place on an escalated job", async () => {
    givenListing(listing({ origin: "expedion", shipperId: "expedion-system" }));
    vi.mocked(hasAnyRole).mockResolvedValue(true);
    givenCandidates([candidate({ routeId: "route-1", carrierId: "carrier-1" })]);

    const result = await carrierDiscoveryService.listForListing(
      OPERATOR,
      "listing-1"
    );

    expect(result.total).toBe(1);
    expect(hasAnyRole).toHaveBeenCalledWith(OPERATOR, ["operator", "admin"]);
  });

  it("refuses an operator on a direct job — nobody stands in for its owner", async () => {
    vi.mocked(hasAnyRole).mockResolvedValue(true);

    const error = await refusal(() =>
      carrierDiscoveryService.listForListing(OPERATOR, "listing-1")
    );

    expect(error.code).toBe("NOT_LISTING_OWNER");
    // The direct lane never even asks, because the answer cannot help.
    expect(hasAnyRole).not.toHaveBeenCalled();
  });

  it("refuses a non-staff stranger on an escalated job", async () => {
    givenListing(listing({ origin: "expedion", shipperId: "expedion-system" }));
    vi.mocked(hasAnyRole).mockResolvedValue(false);

    const error = await refusal(() =>
      carrierDiscoveryService.listForListing("user-stranger", "listing-1")
    );

    expect(error.code).toBe("NOT_LISTING_OWNER");
  });

  it.each(["draft", "awarded", "cancelled", "completed", "expired"])(
    "409s on a %s job, which takes no offers",
    async (status) => {
      givenListing(listing({ status }));

      const error = await refusal(() =>
        carrierDiscoveryService.listForListing(OWNER, "listing-1")
      );

      expect(error.code).toBe("LISTING_NOT_OPEN");
      expect(error.status).toBe(409);
    }
  );

  it("checks who is asking before it checks the status", async () => {
    givenListing(listing({ status: "draft" }));

    const error = await refusal(() =>
      carrierDiscoveryService.listForListing("user-stranger", "listing-1")
    );

    expect(error.code).toBe("NOT_LISTING_OWNER");
  });
});

// ========================================
// Matching — §3
// ========================================
// The requester is not their own match
// ========================================
// A requester may also be an approved carrier, and nothing stops them declaring
// a trajet along the job they posted. Beyond the absurdity of a card offering
// an introduction to yourself, `messagesDAL.findConversation(u, u, listingId)`
// asks for a conversation this user participates in twice — which any of their
// threads about this listing satisfies — so `contact` would have posted the
// opening line into some other carrier's thread.

describe("the viewer never matches themselves", () => {
  const ownCandidate = candidate({
    routeId: "route-own",
    carrierId: "carrier-own",
    userId: OWNER,
  });

  beforeEach(() => {
    givenListing(listing());
  });

  it("drops the requester's own trajet from the cards", async () => {
    givenCandidates([ownCandidate]);

    const result = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("keeps everyone else while dropping only the requester", async () => {
    givenCandidates([
      ownCandidate,
      candidate({ routeId: "route-1", carrierId: "carrier-1" }),
    ]);

    const { items } = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(items.map((item) => item.matchId)).toEqual(["route-1"]);
  });

  it("refuses to contact yourself, so no message is ever self-addressed", async () => {
    givenCandidates([ownCandidate]);

    const error = await refusal(() =>
      carrierDiscoveryService.contact(OWNER, "listing-1", "route-own")
    );

    expect(error.code).toBe("MATCH_NOT_FOUND");
    expect(messagesService.sendMessage).not.toHaveBeenCalled();
  });
});

// ========================================

describe("listForListing — the match", () => {
  it("asks the prefilter for the job's own window, capped at MAX_MATCH_CANDIDATES", async () => {
    await carrierDiscoveryService.listForListing(OWNER, "listing-1");

    expect(carrierRoutesDal.findMatchCandidates).toHaveBeenCalledWith(
      {
        pickup: { lat: ANGOULEME.lat, lng: ANGOULEME.lng },
        dropoff: { lat: ORLEANS.lat, lng: ORLEANS.lng },
        weightKg: 200,
        // The window opens after today, so the walk starts there.
        windowStart: new Date(2026, 8, 7),
        windowEnd: PICKUP_UNTIL,
      },
      MAX_MATCH_CANDIDATES
    );
  });

  it("starts the walk today when the window is already open", async () => {
    givenListing(listing({ pickupFrom: new Date(2026, 7, 20) }));

    await carrierDiscoveryService.listForListing(OWNER, "listing-1");

    expect(carrierRoutesDal.findMatchCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ windowStart: new Date(2026, 8, 1) }),
      MAX_MATCH_CANDIDATES
    );
  });

  it("projects a card the requester can read", async () => {
    givenCandidates([
      candidate({
        routeId: "route-1",
        carrierId: "carrier-1",
        userName: "Faissal B.",
        userImage: "https://cdn.example.test/a.jpg",
        averageRating: 5,
        totalRatings: 1,
        originCity: "Bordeaux",
        destinationCity: "Paris",
      }),
    ]);

    const { items } = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(items[0]).toEqual({
      matchId: "route-1",
      displayName: "Faissal B.",
      avatarUrl: "https://cdn.example.test/a.jpg",
      rating: 5,
      reviewCount: 1,
      // Not stated: this candidate declared no legal form, and the projection
      // says so rather than guessing « Particulier » (spec §4.5).
      legalForm: null,
      originCity: "Bordeaux",
      destinationCity: "Paris",
      // The calendar day, not an instant: `toISOString()` on the local
      // midnight `upcomingOccurrences` returns names the previous day
      // anywhere east of UTC, and a trajet runs on a day (spec §8).
      nextRuns: ["2026-09-08"],
      detourKm: expect.any(Number),
    });
    expect(Number.isInteger(items[0].detourKm)).toBe(true);
  });

  it("carries the carrier's declared legal form onto the card", async () => {
    givenCandidates([
      candidate({
        routeId: "route-1",
        carrierId: "carrier-1",
        legalForm: "SASU",
      }),
    ]);

    const { items } = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(items[0].legalForm).toBe("SASU");
  });

  it("carries a spelled-out legal form whole", async () => {
    // 45 characters, and a real one: the wire bound exists against an import or
    // an admin edit, not against a carrier filling in the KYC form the product
    // gives them — `carrier.dto.ts` accepts 100 (§4.4).
    const declared = "société par actions simplifiée unipersonnelle";

    givenCandidates([
      candidate({
        routeId: "route-1",
        carrierId: "carrier-1",
        legalForm: declared,
      }),
    ]);

    const { items } = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(items[0].legalForm).toBe(declared);
  });

  it("bounds a legal form long enough to break a card", async () => {
    givenCandidates([
      candidate({
        routeId: "route-1",
        carrierId: "carrier-1",
        legalForm: "société ".repeat(40),
      }),
    ]);

    const { items } = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    // Free text a human typed, on a surface a requester did not ask to see:
    // the wire is bounded here and the card truncates on top of it.
    expect(items[0].legalForm).toHaveLength(MAX_LEGAL_FORM_CHARS);
    // And says so, rather than passing a cut off as a complete declaration.
    expect(items[0].legalForm?.endsWith("…")).toBe(true);
  });

  it("keeps the rest of the carrier row off the card beside it", async () => {
    givenCandidates([
      withPrivateColumns(
        candidate({
          routeId: "route-1",
          carrierId: "carrier-1",
          legalForm: "EURL",
        })
      ),
    ]);

    const { items } = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    // A legal form is the public identity of a business; a SIRET is the key to
    // its registered address, which for an auto-entrepreneur is their home.
    // Disclosing the first must not drag the second along (spec §4.4).
    expect(items[0].legalForm).toBe("EURL");
    expect(items[0]).not.toHaveProperty("siret");
    expect(items[0]).not.toHaveProperty("vatNumber");
    expect(items[0]).not.toHaveProperty("userId");
    expect(JSON.stringify(items[0])).not.toContain("81234567800017");
  });

  it("shows at most three runs", async () => {
    givenCandidates([
      candidate({
        routeId: "route-1",
        carrierId: "carrier-1",
        daysOfWeek: [1, 2, 3, 4, 5],
      }),
    ]);

    const { items } = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(items[0].nextRuns).toHaveLength(3);
  });

  it("drops a candidate the prefilter admitted and the predicate refuses", async () => {
    givenCandidates([
      // Driving the other way: Paris → Bordeaux never carries Angoulême → Orléans.
      candidate({
        routeId: "route-reverse",
        carrierId: "carrier-1",
        originCity: "Paris",
        originLat: PARIS.lat,
        originLng: PARIS.lng,
        destinationCity: "Bordeaux",
        destinationLat: BORDEAUX.lat,
        destinationLng: BORDEAUX.lng,
      }),
      // Too small for the load.
      candidate({
        routeId: "route-light",
        carrierId: "carrier-2",
        capacityKg: 50,
      }),
      // Runs on a Sunday, and the window holds none.
      candidate({
        routeId: "route-sunday",
        carrierId: "carrier-3",
        daysOfWeek: [7],
        validUntil: new Date(2026, 8, 9),
      }),
      // Off the corridor entirely: a metre of tolerance admits nothing.
      candidate({
        routeId: "route-narrow",
        carrierId: "carrier-4",
        originLng: BORDEAUX.lng + 5,
        destinationLng: PARIS.lng + 5,
        radiusKm: 1,
      }),
    ]);

    const result = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("keeps one card per carrier, the one with the smaller detour", async () => {
    // What the shifted trajet is worth on its own, so the assertion below
    // compares against a measured number rather than a guessed one.
    givenCandidates([farther("route-far", "carrier-1")]);
    const alone = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    givenCandidates([
      farther("route-far", "carrier-1"),
      candidate({ routeId: "route-near", carrierId: "carrier-1" }),
    ]);

    const result = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].matchId).toBe("route-near");
    expect(result.items[0].detourKm).toBeLessThan(alone.items[0].detourKm);
  });

  it("counts carriers, not trajets", async () => {
    givenCandidates([
      candidate({ routeId: "route-a1", carrierId: "carrier-1" }),
      farther("route-a2", "carrier-1"),
      candidate({ routeId: "route-b1", carrierId: "carrier-2" }),
      farther("route-b2", "carrier-2"),
    ]);

    const result = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.matchId)).toEqual([
      "route-a1",
      "route-b1",
    ]);
  });

  it("orders by detour, then by the better-rated carrier", async () => {
    givenCandidates([
      farther("route-far", "carrier-far"),
      candidate({
        routeId: "route-near-poor",
        carrierId: "carrier-poor",
        averageRating: 3.1,
      }),
      candidate({
        routeId: "route-near-good",
        carrierId: "carrier-good",
        averageRating: 4.9,
      }),
    ]);

    const { items } = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(items.map((item) => item.matchId)).toEqual([
      "route-near-good",
      "route-near-poor",
      "route-far",
    ]);
  });

  it("caps the cards at MAX_MATCHES while the badge keeps counting", async () => {
    const many = Array.from({ length: MAX_MATCHES + 5 }, (_, index) =>
      candidate({ routeId: `route-${index}`, carrierId: `carrier-${index}` })
    );
    givenCandidates(many);

    const result = await carrierDiscoveryService.listForListing(
      OWNER,
      "listing-1"
    );

    expect(result.items).toHaveLength(MAX_MATCHES);
    expect(result.total).toBe(MAX_MATCHES + 5);
  });

  it("writes nothing while it looks", async () => {
    givenCandidates([candidate({ routeId: "route-1", carrierId: "carrier-1" })]);

    await carrierDiscoveryService.listForListing(OWNER, "listing-1");

    expect(messagesService.sendMessage).not.toHaveBeenCalled();
    expectNoWrites();
  });
});

// ========================================
// Eligibility lives in the prefilter — §3.5, §3.6
// ========================================

/**
 * The four exclusions of §3.5 are SQL, not TypeScript: `matchRoute` is handed
 * rows that already passed them. A service test with a mocked DAL cannot
 * exercise them at all, so this reads the condition the real DAL builds and
 * fails the day one of the four is dropped from it.
 */
describe("findMatchCandidates — who is eligible at all", () => {
  const buildWhere = async () => {
    const { carrierRoutesDal: real } = await vi.importActual<
      typeof import("@/server/dal/carrier-routes.dal")
    >("@/server/dal/carrier-routes.dal");

    dbStub.conditions.length = 0;
    await real.findMatchCandidates(
      {
        pickup: ANGOULEME,
        dropoff: ORLEANS,
        weightKg: 200,
        windowStart: PICKUP_FROM,
        windowEnd: PICKUP_UNTIL,
      },
      MAX_MATCH_CANDIDATES
    );

    // The exists() subquery closes its own `where` first; the outer one is last.
    const outer = dbStub.conditions.at(-1) as SQL;
    return new PgDialect().sqlToQuery(outer);
  };

  const boundTo = (query: { sql: string; params: unknown[] }, column: string) => {
    const match = new RegExp(`${column} = \\$(\\d+)`).exec(query.sql);
    return match ? query.params[Number(match[1]) - 1] : undefined;
  };

  it("excludes a paused trajet, a hidden one, an unapproved carrier and a banned account", async () => {
    const query = await buildWhere();

    expect(boundTo(query, '"carrier_routes"\\."is_active"')).toBe(true);
    expect(boundTo(query, '"carrier_routes"\\."is_discoverable"')).toBe(true);
    expect(boundTo(query, '"carriers"\\."status"')).toBe("approved");
    expect(boundTo(query, '"user"\\."banned"')).toBe(false);
  });

  it("admits a trajet that declares no capacity, and one big enough", async () => {
    const query = await buildWhere();

    expect(query.sql).toContain('"carrier_routes"."capacity_kg" is null');
    expect(query.sql).toContain('"carrier_routes"."capacity_kg" >=');
    expect(query.params).toContain(200);
  });

  it("bounds both of the job's endpoints, not just the pickup", async () => {
    const query = await buildWhere();

    // One padded box per endpoint, each built from `least`/`greatest`.
    expect(query.sql.match(/least\(/g)).toHaveLength(4);
    expect(query.params).toContain(ANGOULEME.lat);
    expect(query.params).toContain(ORLEANS.lat);
  });
});

// ========================================
// Contact — §6.2, §6.4
// ========================================

describe("contact", () => {
  const match = candidate({ routeId: "route-1", carrierId: "carrier-1" });

  it("refuses a matchId that is not in the match set", async () => {
    givenCandidates([match]);

    const error = await refusal(() =>
      carrierDiscoveryService.contact(OWNER, "listing-1", "route-elsewhere")
    );

    expect(error.code).toBe("MATCH_NOT_FOUND");
    expect(error.status).toBe(404);
    expect(messagesService.sendMessage).not.toHaveBeenCalled();
  });

  it("refuses a trajet the prefilter returned and the predicate threw away", async () => {
    // The predicate is the authorisation: a row surviving the cheap SQL half
    // is not a match, and this is the endpoint that would otherwise become a
    // carrier directory.
    givenCandidates([
      candidate({
        routeId: "route-reverse",
        carrierId: "carrier-1",
        originLat: PARIS.lat,
        originLng: PARIS.lng,
        destinationLat: BORDEAUX.lat,
        destinationLng: BORDEAUX.lng,
      }),
    ]);

    const error = await refusal(() =>
      carrierDiscoveryService.contact(OWNER, "listing-1", "route-reverse")
    );

    expect(error.code).toBe("MATCH_NOT_FOUND");
    expect(messagesService.sendMessage).not.toHaveBeenCalled();
  });

  it("refuses a stranger before it ever looks for the match", async () => {
    givenCandidates([match]);

    const error = await refusal(() =>
      carrierDiscoveryService.contact("user-stranger", "listing-1", "route-1")
    );

    expect(error.code).toBe("NOT_LISTING_OWNER");
    expect(carrierRoutesDal.findMatchCandidates).not.toHaveBeenCalled();
  });

  it("refuses on a job that is no longer open", async () => {
    givenListing(listing({ status: "awarded" }));
    givenCandidates([match]);

    const error = await refusal(() =>
      carrierDiscoveryService.contact(OWNER, "listing-1", "route-1")
    );

    expect(error.code).toBe("LISTING_NOT_OPEN");
  });

  it("opens a thread on the job with an opening line already written", async () => {
    givenCandidates([match]);

    const result = await carrierDiscoveryService.contact(
      OWNER,
      "listing-1",
      "route-1"
    );

    expect(result).toEqual({ conversationId: "conv-1" });
    expect(messagesService.sendMessage).toHaveBeenCalledTimes(1);

    const [senderId, input] = vi.mocked(messagesService.sendMessage).mock
      .calls[0];
    expect(senderId).toBe(OWNER);
    // `listingId` is what puts the thread on the job lane of `contextFor`,
    // where a bubble offer mints a real `offers` row (§6.4).
    expect(input.listingId).toBe("listing-1");
    expect(input.content).toBeTruthy();
    expect(input.content).toContain("Un canapé deux places");
    expect(input.content).toContain("Angoulême");
    expect(input.content).toContain("Orléans");
  });

  it("addresses the carrier's user row, never carriers.id or the trajet", async () => {
    // `carrier_routes.carrier_id` is a `carriers.id`; a conversation is
    // between `user` rows, and `carriers.user_id` is the only bridge.
    givenCandidates([
      candidate({
        routeId: "route-1",
        carrierId: "carrier-1",
        userId: "user-driver",
      }),
    ]);

    await carrierDiscoveryService.contact(OWNER, "listing-1", "route-1");

    const [, input] = vi.mocked(messagesService.sendMessage).mock.calls[0];
    expect(input.recipientId).toBe("user-driver");
    expect(input.recipientId).not.toBe("carrier-1");
    expect(input.recipientId).not.toBe("route-1");
  });

  it("lets an operator write in the client's place on an escalated job", async () => {
    givenListing(
      listing({
        origin: "expedion",
        shipperId: "expedion-system",
        status: "open",
      })
    );
    vi.mocked(hasAnyRole).mockResolvedValue(true);
    givenCandidates([match]);

    const result = await carrierDiscoveryService.contact(
      OPERATOR,
      "listing-1",
      "route-1"
    );

    expect(result.conversationId).toBe("conv-1");
    const [senderId] = vi.mocked(messagesService.sendMessage).mock.calls[0];
    expect(senderId).toBe(OPERATOR);
  });

  it("reaches a trajet deduplication dropped from the cards", async () => {
    // Deduplication and the display cap are presentation; the predicate is the
    // authorisation. A carrier's second matching trajet is still a real match,
    // so contacting through it is not a way around anything.
    givenCandidates([
      candidate({ routeId: "route-near", carrierId: "carrier-1" }),
      farther("route-far", "carrier-1"),
    ]);

    const result = await carrierDiscoveryService.contact(
      OWNER,
      "listing-1",
      "route-far"
    );

    expect(result.conversationId).toBe("conv-1");
  });

  it("refuses to invent a conversation id it was not given", async () => {
    givenCandidates([match]);
    vi.mocked(messagesService.sendMessage).mockResolvedValue({
      conversationId: undefined,
    } as never);

    const error = await refusal(() =>
      carrierDiscoveryService.contact(OWNER, "listing-1", "route-1")
    );

    expect(error.code).toBe("CONTACT_FAILED");
    expect(error.status).toBe(500);
  });

  it("writes nothing but that message", async () => {
    givenCandidates([match]);

    await carrierDiscoveryService.contact(OWNER, "listing-1", "route-1");

    expect(messagesService.sendMessage).toHaveBeenCalledTimes(1);
    expectNoWrites();
  });
});
