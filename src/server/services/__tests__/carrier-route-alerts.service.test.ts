import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { carrierRouteAlertsService } from "../carrier-route-alerts.service";
import { carrierRoutesDal } from "@/server/dal/carrier-routes.dal";
import type { NotifyCandidateRow } from "@/server/dal/carrier-routes.dal";
import { notificationsService } from "@/server/services/notifications.service";
import { MAX_MATCH_CANDIDATES } from "@/lib/route-match";
import { defaultPreferences } from "@/db/schema/users";

// Covers docs/specs/carrier_route_alerts_spec.md §9.
//
// Borrows the fixtures and the dbStub pattern from
// carrier-discovery.service.test.ts: same corridor, same predicate
// (`matchRoute`), read from the alerting side instead of the discovery side.

// ========================================
// Mocks
// ========================================

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
    getSQL: () => sql`1`,
  };

  return { conditions, db: { select: () => builder } };
});

vi.mock("@/db", () => ({ db: dbStub.db }));

vi.mock("@/server/dal/carrier-routes.dal", () => ({
  carrierRoutesDal: { findNotifyCandidates: vi.fn() },
}));

vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn() },
}));

// ========================================
// Fixtures
// ========================================

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

const listing = (over: Record<string, unknown> = {}) => ({
  id: "listing-1",
  shipperId: OWNER,
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
  over: Partial<NotifyCandidateRow> & { routeId: string; carrierId: string }
): NotifyCandidateRow => ({
  userId: `${over.carrierId}-user`,
  userName: "Faissal B.",
  userImage: null,
  averageRating: 4,
  totalRatings: 3,
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
  userPreferences: defaultPreferences,
  ...over,
});

const givenCandidates = (rows: NotifyCandidateRow[]) =>
  vi.mocked(carrierRoutesDal.findNotifyCandidates).mockResolvedValue(rows);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  givenCandidates([]);
  vi.mocked(notificationsService.createNotification).mockResolvedValue(
    {} as never
  );
});

afterEach(() => {
  vi.useRealTimers();
});

// ========================================
// The fan-out — §6
// ========================================

describe("notifyMatchingCarriers", () => {
  it("asks the prefilter for the job's own window, capped at MAX_MATCH_CANDIDATES", async () => {
    await carrierRouteAlertsService.notifyMatchingCarriers(listing() as never);

    expect(carrierRoutesDal.findNotifyCandidates).toHaveBeenCalledWith(
      {
        pickup: { lat: ANGOULEME.lat, lng: ANGOULEME.lng },
        dropoff: { lat: ORLEANS.lat, lng: ORLEANS.lng },
        weightKg: 200,
        windowStart: new Date(2026, 8, 7),
        windowEnd: PICKUP_UNTIL,
      },
      MAX_MATCH_CANDIDATES
    );
  });

  it("sends nothing and never asks the prefilter for a listing with no map pin", async () => {
    givenCandidates([candidate({ routeId: "route-1", carrierId: "carrier-1" })]);

    await carrierRouteAlertsService.notifyMatchingCarriers(
      listing({ pickupLat: null, pickupLng: null }) as never
    );

    expect(carrierRoutesDal.findNotifyCandidates).not.toHaveBeenCalled();
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it("sends nothing when no trajet matches", async () => {
    givenCandidates([
      // Off the corridor entirely: a metre of tolerance admits nothing.
      candidate({
        routeId: "route-narrow",
        carrierId: "carrier-1",
        originLng: BORDEAUX.lng + 5,
        destinationLng: PARIS.lng + 5,
        radiusKm: 1,
      }),
    ]);

    await carrierRouteAlertsService.notifyMatchingCarriers(listing() as never);

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it("sends one notification per matching carrier", async () => {
    givenCandidates([
      candidate({ routeId: "route-1", carrierId: "carrier-1" }),
      candidate({ routeId: "route-2", carrierId: "carrier-2" }),
    ]);

    await carrierRouteAlertsService.notifyMatchingCarriers(listing() as never);

    expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
    const recipients = vi
      .mocked(notificationsService.createNotification)
      .mock.calls.map(([input]) => input.userId);
    expect(recipients).toEqual(["carrier-1-user", "carrier-2-user"]);
  });

  it("sends exactly one notification when a carrier holds two matching trajets", async () => {
    givenCandidates([
      candidate({ routeId: "route-a", carrierId: "carrier-1" }),
      candidate({ routeId: "route-b", carrierId: "carrier-1" }),
    ]);

    await carrierRouteAlertsService.notifyMatchingCarriers(listing() as never);

    expect(notificationsService.createNotification).toHaveBeenCalledTimes(1);
  });

  it("excludes the listing's own shipper", async () => {
    givenCandidates([
      candidate({
        routeId: "route-own",
        carrierId: "carrier-own",
        userId: OWNER,
      }),
    ]);

    await carrierRouteAlertsService.notifyMatchingCarriers(listing() as never);

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it("keeps everyone else while dropping only the shipper", async () => {
    givenCandidates([
      candidate({ routeId: "route-own", carrierId: "carrier-own", userId: OWNER }),
      candidate({ routeId: "route-1", carrierId: "carrier-1" }),
    ]);

    await carrierRouteAlertsService.notifyMatchingCarriers(listing() as never);

    expect(notificationsService.createNotification).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(notificationsService.createNotification).mock.calls[0][0]
        .userId
    ).toBe("carrier-1-user");
  });

  it("shapes the notification with a link back to the listing and the matched route", async () => {
    givenCandidates([candidate({ routeId: "route-1", carrierId: "carrier-1" })]);

    await carrierRouteAlertsService.notifyMatchingCarriers(listing() as never);

    expect(notificationsService.createNotification).toHaveBeenCalledWith({
      userId: "carrier-1-user",
      type: "carrier_route_match",
      title: expect.any(String),
      message: expect.stringContaining("Angoulême"),
      linkUrl: "/listing/listing-1",
      data: { listingId: "listing-1", routeId: "route-1" },
    });
  });

  // ========================================
  // The account-level channel preference — notification_channel_settings_spec.md §5
  // ========================================

  it("sends nothing to a matched carrier whose push preference is off", async () => {
    givenCandidates([
      candidate({
        routeId: "route-1",
        carrierId: "carrier-1",
        userPreferences: {
          ...defaultPreferences,
          notifications: {
            ...defaultPreferences.notifications,
            inApp: {
              ...defaultPreferences.notifications.inApp,
              carrierRouteMatch: false,
            },
          },
        },
      }),
    ]);

    await carrierRouteAlertsService.notifyMatchingCarriers(listing() as never);

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it("still sends to a matched carrier with no stored preferences (default on)", async () => {
    givenCandidates([
      candidate({
        routeId: "route-1",
        carrierId: "carrier-1",
        userPreferences: null as never,
      }),
    ]);

    await carrierRouteAlertsService.notifyMatchingCarriers(listing() as never);

    expect(notificationsService.createNotification).toHaveBeenCalledTimes(1);
  });

  it("counts a carrier with two matching trajets and the checkbox off as zero, not deduped-then-skipped-twice", async () => {
    const optedOut = {
      ...defaultPreferences,
      notifications: {
        ...defaultPreferences.notifications,
        inApp: {
          ...defaultPreferences.notifications.inApp,
          carrierRouteMatch: false,
        },
      },
    };
    givenCandidates([
      candidate({ routeId: "route-a", carrierId: "carrier-1", userPreferences: optedOut }),
      candidate({ routeId: "route-b", carrierId: "carrier-1", userPreferences: optedOut }),
    ]);

    await carrierRouteAlertsService.notifyMatchingCarriers(listing() as never);

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it("does not let one carrier's failed notification stop the next", async () => {
    givenCandidates([
      candidate({ routeId: "route-1", carrierId: "carrier-1" }),
      candidate({ routeId: "route-2", carrierId: "carrier-2" }),
    ]);
    vi.mocked(notificationsService.createNotification)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({} as never);

    await expect(
      carrierRouteAlertsService.notifyMatchingCarriers(listing() as never)
    ).resolves.toBeUndefined();

    expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
  });
});

// ========================================
// Eligibility lives in the prefilter — mirrors
// carrier-discovery.service.test.ts's own DAL where-clause assertions, swapped
// onto the notify consent path (spec §5).
// ========================================

describe("findNotifyCandidates — who is eligible at all", () => {
  const buildWhere = async () => {
    const { carrierRoutesDal: real } = await vi.importActual<
      typeof import("@/server/dal/carrier-routes.dal")
    >("@/server/dal/carrier-routes.dal");

    dbStub.conditions.length = 0;
    await real.findNotifyCandidates(
      {
        pickup: ANGOULEME,
        dropoff: ORLEANS,
        weightKg: 200,
        windowStart: PICKUP_FROM,
        windowEnd: PICKUP_UNTIL,
      },
      MAX_MATCH_CANDIDATES
    );

    const outer = dbStub.conditions.at(-1) as SQL;
    return new PgDialect().sqlToQuery(outer);
  };

  const boundTo = (query: { sql: string; params: unknown[] }, column: string) => {
    const match = new RegExp(`${column} = \\$(\\d+)`).exec(query.sql);
    return match ? query.params[Number(match[1]) - 1] : undefined;
  };

  it("gates on notify_on_match and is_active, not is_discoverable", async () => {
    const query = await buildWhere();

    expect(boundTo(query, '"carrier_routes"\\."is_active"')).toBe(true);
    expect(boundTo(query, '"carrier_routes"\\."notify_on_match"')).toBe(true);
    expect(query.sql).not.toContain('"carrier_routes"."is_discoverable"');
    expect(boundTo(query, '"carriers"\\."status"')).toBe("approved");
    expect(boundTo(query, '"user"\\."banned"')).toBe(false);
  });
});
