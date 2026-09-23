/**
 * ============================================================================
 * Beta data: one transaction on every role's side, for the owner account
 * ============================================================================
 *
 *   pnpm db:seed:beta                       # development database only
 *   Actions → "Seed beta data"              # production, via seed-beta.yml
 *
 * What a tester signed in as the owner account finds afterwards:
 *
 *   as a driver    a delivered run (earnings, payout, both reviews), and a
 *                  freshly awarded run they can walk through themselves
 *   as a shipper   a job they awarded, a job with a bid waiting for their
 *                  choice, a draft, and a thread with their driver
 *   as an operator an escalated Expedion job with two bids in /admin/awards
 *   as an admin    two approved carrier applications with their name on them
 *
 * Every write goes through the app's own services and DALs, so the rows are
 * what the product would have produced: real document numbers, real event
 * logs, real notifications. The three things the services cannot do from a
 * job with no external credentials are handled here and nowhere else — the
 * award is charged through `MOCK_PAYMENTS` (docs/TESTING_MOCKS.md §1), the
 * photo gate is satisfied with a placeholder row that is retired right after
 * the transition, and the delivered run is backdated so it reads as history.
 *
 * Refuses production unless `SEED_TARGET=production` **and** `APP_ENV=production`
 * are both set — the first is this script's opt-in (as `MIGRATE_TARGET` is for
 * migrate.ts), the second is what `src/db/index.ts` demands before it opens the
 * connection. Idempotent: fixed ids where this script mints them, and a title
 * lookup where a service does.
 *
 * Environment:
 *   POSTGRES_URL          the target database
 *   SEED_TARGET           "production" to allow the production target
 *   MOCK_PAYMENTS         must be "true": the award charges nobody
 *   BETA_OWNER_EMAIL      the account every side is seeded around
 *   BETA_SHIPPER_EMAIL    the counterparty that posts the jobs the owner drives
 *   BETA_CARRIER_EMAIL    the counterparty that drives the jobs the owner posts
 *   BETA_SYSTEM_EMAIL     the Expedion system account (award queue; optional)
 */

import "@/lib/load-env";
import { and, asc, eq, isNull, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  assertDevelopmentDatabase,
  describeDatabase,
  normaliseConnectionString,
} from "@/lib/db-target";
import { vehicles } from "@/db/schema/carriers";
import { expedionQuotes } from "@/db/schema/expedion";
import { invoices } from "@/db/schema/invoices";
import { listings } from "@/db/schema/listings";
import { messages } from "@/db/schema/messages";
import { offerSlots, offers } from "@/db/schema/offers";
import { payments, payouts } from "@/db/schema/payments";
import { shipmentEvents, shipmentPhotos, shipments } from "@/db/schema/shipments";
import { user } from "@/db/schema/users";

const OWNER_EMAIL = process.env.BETA_OWNER_EMAIL ?? "prayogadevelopment@gmail.com";
const SHIPPER_EMAIL =
  process.env.BETA_SHIPPER_EMAIL ?? "prayogadevelopment+expeditootest@gmail.com";
const CARRIER_EMAIL =
  process.env.BETA_CARRIER_EMAIL ?? "prayogadevelopment+expeditoocarrier2@gmail.com";
const SYSTEM_EMAIL = process.env.BETA_SYSTEM_EMAIL ?? "system+expedion@expeditoo.com";

type UserRow = typeof user.$inferSelect;
type ListingRow = typeof listings.$inferSelect;
type OfferRow = typeof offers.$inferSelect;
type ShipmentRow = typeof shipments.$inferSelect;

// ========================================
// Target
// ========================================

/**
 * Same shape as migrate.ts's `resolveTarget`: production is an explicit
 * opt-in that only CI is expected to make, everything else must be a
 * recognised development database. `@/db` reads `POSTGRES_URL` raw, so the
 * cleaned string is written back before it is imported.
 */
function resolveConnection(): void {
  const raw = process.env.POSTGRES_URL;
  if (!raw) throw new Error("POSTGRES_URL environment variable is required");
  const cleaned = normaliseConnectionString(raw);

  if (process.env.SEED_TARGET === "production") {
    const target = describeDatabase(cleaned);
    if (!target.isProduction) {
      throw new Error(
        `SEED_TARGET=production but POSTGRES_URL is ${target.label}, which is not production.`
      );
    }
    if (process.env.APP_ENV !== "production") {
      throw new Error(
        "APP_ENV=production is required alongside SEED_TARGET=production — " +
          "src/db/index.ts refuses the production database from any other process."
      );
    }
    console.warn(`⚠️  SEED_TARGET=production — seeding ${target.label}`);
  } else {
    assertDevelopmentDatabase(cleaned, "seed beta data");
  }

  if (process.env.MOCK_PAYMENTS !== "true") {
    throw new Error("MOCK_PAYMENTS=true is required: the seeded awards must charge nobody.");
  }

  process.env.POSTGRES_URL = cleaned;
}

/** Imported after the target is settled, so `@/db`'s import-time guard sees the cleaned URL. */
async function loadApp() {
  const { db } = await import("@/db");
  const fixtures = await import("./beta-fixtures");
  const { carriersDal } = await import("@/server/dal/carriers.dal");
  const { carrierService } = await import("@/server/services/carrier.service");
  const { carrierRoutesDal } = await import("@/server/dal/carrier-routes.dal");
  const { carrierRoutesService } = await import("@/server/services/carrier-routes.service");
  const { listingsDal } = await import("@/server/dal/listings.dal");
  const { listingsService } = await import("@/server/services/listings.service");
  const { offersService } = await import("@/server/services/offers.service");
  const { shipmentService } = await import("@/server/services/shipment.service");
  const { shipmentPhotosDal } = await import("@/server/dal/shipment-photos.dal");
  const { reviewsService } = await import("@/server/services/reviews.service");
  const { messagesDAL: messagesDal } = await import("@/server/dal/messages.dal");
  return {
    db,
    fixtures,
    carriersDal,
    carrierService,
    carrierRoutesDal,
    carrierRoutesService,
    listingsDal,
    listingsService,
    offersService,
    shipmentService,
    shipmentPhotosDal,
    reviewsService,
    messagesDal,
  };
}

type App = Awaited<ReturnType<typeof loadApp>>;
type Viewer = Parameters<App["shipmentService"]["updateStatus"]>[2];

// ========================================
// People
// ========================================

interface People {
  owner: UserRow;
  shipper: UserRow;
  carrier: UserRow;
  system: UserRow | null;
}

async function findUser(app: App, email: string): Promise<UserRow | null> {
  const row = await app.db.query.user.findFirst({ where: eq(user.email, email) });
  return row ?? null;
}

async function requireUser(app: App, email: string, why: string): Promise<UserRow> {
  const row = await findUser(app, email);
  if (!row) {
    throw new Error(
      `No account for ${email} (${why}). This seed never creates people — ` +
        `sign the account up first, then re-run.`
    );
  }
  return row;
}

async function resolvePeople(app: App): Promise<People> {
  const owner = await requireUser(app, OWNER_EMAIL, "the owner every side is seeded around");
  const shipper = await requireUser(app, SHIPPER_EMAIL, "the counterparty shipper");
  const carrier = await requireUser(app, CARRIER_EMAIL, "the counterparty carrier");
  const system = await findUser(app, SYSTEM_EMAIL);
  if (!system) {
    console.warn(
      `  ! no account for ${SYSTEM_EMAIL} — the Expedion award-queue item will be skipped`
    );
  }
  console.log(`  owner    ${owner.email}  (${owner.id})`);
  console.log(`  shipper  ${shipper.email}  (${shipper.id})`);
  console.log(`  carrier  ${carrier.email}  (${carrier.id})`);
  return { owner, shipper, carrier, system };
}

/**
 * The two counterparties were signed up through the API and never clicked a
 * link; Better Auth refuses them at sign-in until this is true. The owner's
 * row is never touched.
 */
async function verifyCounterparties(app: App, people: People): Promise<void> {
  for (const person of [people.shipper, people.carrier]) {
    if (person.emailVerified) continue;
    await app.db.update(user).set({ emailVerified: true }).where(eq(user.id, person.id));
    console.log(`  verified ${person.email}`);
  }
}

// ========================================
// Fleet: two approved carriers, one vehicle each
// ========================================

interface Fleet {
  ownerCarrierId: string;
  qaCarrierId: string;
  ownerVehicleId: string;
  qaVehicleId: string;
}

/**
 * Created as `submitted` and approved through the real approval, so the row
 * carries `approvedBy`, the carrier + driver roles, and the fleet self-link —
 * everything an application approved from /admin/applications would have.
 */
async function ensureApprovedCarrier(
  app: App,
  kind: "owner" | "qa",
  userId: string,
  adminId: string
): Promise<string> {
  const existing = await app.carriersDal.getByUserId(userId);
  const row = existing ?? (await app.carriersDal.create(app.fixtures.carrierRow(kind, userId)));
  await app.carrierService.approve(adminId, row.id);
  return row.id;
}

async function ensureVehicle(app: App, kind: "owner" | "qa", carrierId: string): Promise<string> {
  const row = app.fixtures.vehicleRow(kind, carrierId);
  await app.db.insert(vehicles).values(row).onConflictDoNothing();
  const stored = await app.db.query.vehicles.findFirst({
    where: and(eq(vehicles.carrierId, carrierId), eq(vehicles.plateNumber, row.plateNumber)),
  });
  if (!stored) throw new Error(`vehicle ${row.plateNumber} did not persist`);
  return stored.id;
}

async function ensureFleet(app: App, people: People): Promise<Fleet> {
  const ownerCarrierId = await ensureApprovedCarrier(app, "owner", people.owner.id, people.owner.id);
  const qaCarrierId = await ensureApprovedCarrier(app, "qa", people.carrier.id, people.owner.id);
  const ownerVehicleId = await ensureVehicle(app, "owner", ownerCarrierId);
  const qaVehicleId = await ensureVehicle(app, "qa", qaCarrierId);
  console.log(`  carriers ${ownerCarrierId} (owner), ${qaCarrierId} (qa) — approved`);
  return { ownerCarrierId, qaCarrierId, ownerVehicleId, qaVehicleId };
}

async function ensureRoutes(app: App, people: People, fleet: Fleet, now: Date): Promise<void> {
  const inputs = app.fixtures.routeInputs(fleet.ownerVehicleId, fleet.qaVehicleId, now);
  const plan = [
    { userId: people.owner.id, carrierId: fleet.ownerCarrierId, input: inputs.owner },
    { userId: people.carrier.id, carrierId: fleet.qaCarrierId, input: inputs.qa },
  ];
  for (const { userId, carrierId, input } of plan) {
    const existing = await app.carrierRoutesDal.listByCarrier(carrierId);
    if (existing.some((route) => route.label === input.label)) continue;
    await app.carrierRoutesService.create(userId, input);
    console.log(`  trajet   ${input.label}`);
  }
}

// ========================================
// Jobs, bids, awards
// ========================================

async function findListingByTitle(app: App, shipperId: string, title: string) {
  const row = await app.db.query.listings.findFirst({
    where: and(eq(listings.shipperId, shipperId), eq(listings.title, title)),
  });
  return row ?? null;
}

/** `notifyRouteMatches: false` — the alert fan-out would page every real carrier whose trajet matches. */
async function ensureListing(
  app: App,
  shipperId: string,
  spec: (typeof app.fixtures.LISTINGS)[keyof typeof app.fixtures.LISTINGS],
  now: Date
): Promise<ListingRow> {
  const input = app.fixtures.listingInput(spec, now);
  const existing = await findListingByTitle(app, shipperId, input.title);
  if (existing) return existing;
  const created = await app.listingsService.createListing(shipperId, input, {
    notifyRouteMatches: false,
  });
  console.log(`  job      ${created.id}  ${input.title}`);
  return created;
}

async function ensureOffer(
  app: App,
  carrierUserId: string,
  listing: ListingRow,
  vehicleId: string,
  priceCents: number,
  message: string
): Promise<OfferRow> {
  const existing = await app.db.query.offers.findFirst({
    where: and(eq(offers.listingId, listing.id), eq(offers.carrierId, carrierUserId)),
  });
  if (existing) return existing;
  const input = app.fixtures.offerInput(listing.pickupFrom, vehicleId, priceCents, message);
  const created = await app.offersService.submitOffer(carrierUserId, listing.id, input);
  console.log(`  bid      ${created.id}  ${priceCents / 100} € on ${listing.id}`);
  return created;
}

async function latestShipment(app: App, listingId: string): Promise<ShipmentRow | null> {
  const row = await app.db.query.shipments.findFirst({
    where: eq(shipments.listingId, listingId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  return row ?? null;
}

async function ensureAward(
  app: App,
  shipperId: string,
  listing: ListingRow,
  offerId: string
): Promise<ShipmentRow> {
  const fresh = await app.listingsDal.getById(listing.id);
  if (fresh?.acceptedOfferId) {
    const existing = await latestShipment(app, listing.id);
    if (existing) return existing;
  }
  const result = await app.offersService.acceptOffer(shipperId, offerId);
  const shipment = result.shipment ?? (await latestShipment(app, listing.id));
  if (!shipment) throw new Error(`award of ${offerId} produced no shipment on ${listing.id}`);
  console.log(`  award    ${shipment.id}  offer ${offerId} on ${listing.id}`);
  return shipment;
}

// ========================================
// Walking a run to delivered
// ========================================

const RANK: Record<ShipmentRow["status"], number> = {
  PENDING: 0,
  ASSIGNED: 1,
  PICKED_UP: 2,
  IN_TRANSIT: 3,
  DELIVERED: 4,
  CANCELLED: 5,
};

async function ensurePlaceholderPhoto(
  app: App,
  shipment: ShipmentRow,
  stage: "pickup" | "delivery",
  driverId: string,
  now: Date
): Promise<void> {
  const place = stage === "pickup" ? app.fixtures.PLACES.drouot : app.fixtures.PLACES.lyon;
  const row = app.fixtures.placeholderPhoto(shipment.id, stage, place, driverId, now);
  const existing = await app.db.query.shipmentPhotos.findFirst({
    where: eq(shipmentPhotos.id, row.id),
  });
  if (existing) return;
  await app.shipmentPhotosDal.create(row);
}

/** The gate only counts live rows; retiring the placeholder keeps the UI from rendering a key with nothing behind it. */
async function retirePlaceholders(app: App, shipmentId: string, adminId: string): Promise<void> {
  await app.db
    .update(shipmentPhotos)
    .set({
      deletedAt: new Date(),
      deletedByUserId: adminId,
      deletionReason: app.fixtures.PLACEHOLDER_REMOVAL_REASON,
    })
    .where(
      and(
        eq(shipmentPhotos.shipmentId, shipmentId),
        like(shipmentPhotos.objectKey, "beta/%"),
        isNull(shipmentPhotos.deletedAt)
      )
    );
}

/** Drives PENDING → DELIVERED through `updateStatus`, so events, settlement and payout are the product's own. */
async function walkToDelivered(app: App, shipment: ShipmentRow, driver: UserRow, now: Date) {
  const steps = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"] as const;
  const viewer: Viewer = { userId: driver.id };
  let status = shipment.status;

  for (const next of steps) {
    if (RANK[status] >= RANK[next]) continue;
    if (next === "PICKED_UP") await ensurePlaceholderPhoto(app, shipment, "pickup", driver.id, now);
    if (next === "DELIVERED") await ensurePlaceholderPhoto(app, shipment, "delivery", driver.id, now);
    await app.shipmentService.updateStatus(shipment.id, next, viewer);
    status = next;
  }

  await retirePlaceholders(app, shipment.id, driver.id);
}

// ========================================
// Backdating the delivered run
// ========================================

interface RunIds {
  listingId: string;
  shipmentId: string;
  offerId: string;
}

/** Pickup six days ago, delivered five: the run reads as history rather than as something that happened in one second. */
async function backdateSchedule(app: App, ids: RunIds, now: Date): Promise<void> {
  const { daysAgo } = app.fixtures;
  const pickedUp = daysAgo(now, 6, 8);
  const delivered = daysAgo(now, 5, 14);
  const posted = daysAgo(now, 9, 10);

  await app.db
    .update(listings)
    .set({
      pickupFrom: daysAgo(now, 6, 7),
      pickupUntil: daysAgo(now, 6, 10),
      dropoffFrom: daysAgo(now, 5, 8),
      dropoffUntil: daysAgo(now, 3, 18),
      createdAt: posted,
    })
    .where(eq(listings.id, ids.listingId));

  await app.db
    .update(offers)
    .set({ estimatedPickup: pickedUp, estimatedDelivery: delivered, createdAt: daysAgo(now, 8, 9) })
    .where(eq(offers.id, ids.offerId));

  await app.db
    .update(offerSlots)
    .set({ startsAt: daysAgo(now, 6, 4), endsAt: daysAgo(now, 6, 10), deliveryAt: delivered })
    .where(eq(offerSlots.offerId, ids.offerId));

  await app.db
    .update(shipments)
    .set({
      scheduledPickup: pickedUp,
      scheduledDelivery: delivered,
      pickedUpAt: pickedUp,
      deliveredAt: delivered,
      createdAt: daysAgo(now, 7, 11),
    })
    .where(eq(shipments.id, ids.shipmentId));
}

async function backdateMoneyAndEvents(app: App, ids: RunIds, now: Date): Promise<void> {
  const { daysAgo } = app.fixtures;
  const charged = daysAgo(now, 7, 11);

  const payment = await app.db.query.payments.findFirst({
    where: eq(payments.shipmentId, ids.shipmentId),
  });
  if (payment) {
    await app.db
      .update(payments)
      .set({ createdAt: charged, capturedAt: charged })
      .where(eq(payments.id, payment.id));
    await app.db
      .update(invoices)
      .set({ issuedAt: charged, paidAt: charged, createdAt: charged })
      .where(eq(invoices.paymentId, payment.id));
  }

  await app.db
    .update(payouts)
    .set({ createdAt: daysAgo(now, 5, 14) })
    .where(eq(payouts.shipmentId, ids.shipmentId));

  const eventTimes: Partial<Record<ShipmentRow["status"], Date>> = {
    ASSIGNED: daysAgo(now, 7, 12),
    PICKED_UP: daysAgo(now, 6, 8),
    IN_TRANSIT: daysAgo(now, 6, 9),
    DELIVERED: daysAgo(now, 5, 14),
  };
  const events = await app.db.query.shipmentEvents.findMany({
    where: eq(shipmentEvents.shipmentId, ids.shipmentId),
    orderBy: [asc(shipmentEvents.createdAt)],
  });
  for (const event of events) {
    const at = eventTimes[event.status as ShipmentRow["status"]];
    if (at) {
      await app.db.update(shipmentEvents).set({ createdAt: at }).where(eq(shipmentEvents.id, event.id));
    }
  }
}

// ========================================
// The six stories
// ========================================

/** The owner drove it, it is done: earnings, payout, one review each way. */
async function seedCompletedRun(app: App, people: People, fleet: Fleet, now: Date) {
  const listing = await ensureListing(app, people.shipper.id, app.fixtures.LISTINGS.completed, now);
  const offer = await ensureOffer(
    app,
    people.owner.id,
    listing,
    fleet.ownerVehicleId,
    23_500,
    "Passage prévu vendredi matin, couverture et sangles à bord."
  );
  const shipment = await ensureAward(app, people.shipper.id, listing, offer.id);

  const freshlyAwarded = listing.pickupFrom > now;
  await walkToDelivered(app, shipment, people.owner, now);
  if (freshlyAwarded) {
    const ids = { listingId: listing.id, shipmentId: shipment.id, offerId: offer.id };
    await backdateSchedule(app, ids, now);
    await backdateMoneyAndEvents(app, ids, now);
  }

  const reviews = [
    { author: people.shipper.id, comment: app.fixtures.REVIEWS.byShipper },
    { author: people.owner.id, comment: app.fixtures.REVIEWS.byCarrier },
  ];
  for (const { author, comment } of reviews) {
    await app.reviewsService
      .createReview(author, { shipmentId: shipment.id, rating: 5, comment })
      .catch((error: unknown) => {
        const code = (error as { code?: string }).code;
        if (code !== "ALREADY_REVIEWED") throw error;
      });
  }
  await app.carriersDal.update(fleet.ownerCarrierId, { completedJobs: 1 });
  return { listing, shipment };
}

/** Awarded to the owner, still PENDING: the run a tester walks through themselves, with real photos. */
async function seedDriverRun(app: App, people: People, fleet: Fleet, now: Date) {
  const listing = await ensureListing(app, people.shipper.id, app.fixtures.LISTINGS.driverRun, now);
  const offer = await ensureOffer(
    app,
    people.owner.id,
    listing,
    fleet.ownerVehicleId,
    18_900,
    "Miroir transporté debout, calé entre deux matelas de protection."
  );
  const shipment = await ensureAward(app, people.shipper.id, listing, offer.id);
  return { listing, shipment };
}

/** The owner posted it and awarded the QA carrier; the thread with that driver is on it. */
async function seedShipperRun(app: App, people: People, fleet: Fleet, now: Date) {
  const listing = await ensureListing(app, people.owner.id, app.fixtures.LISTINGS.shipperRun, now);
  const offer = await ensureOffer(
    app,
    people.carrier.id,
    listing,
    fleet.qaVehicleId,
    21_000,
    "Camion 20 m³ avec hayon, deux personnes pour le chargement."
  );
  const shipment = await ensureAward(app, people.owner.id, listing, offer.id);
  await ensureThread(app, listing.id, people.owner, people.carrier);
  return { listing, shipment };
}

async function ensureThread(app: App, listingId: string, shipper: UserRow, carrier: UserRow) {
  const found = await app.messagesDal.findConversation(shipper.id, carrier.id, listingId);
  const conversation =
    found ?? (await app.messagesDal.createConversation({ id: nanoid(), listingId }, [shipper.id, carrier.id]));
  const already = await app.db.query.messages.findFirst({
    where: eq(messages.conversationId, conversation.id),
  });
  if (already) return;
  await app.messagesDal.createMessage({
    id: nanoid(),
    conversationId: conversation.id,
    senderId: carrier.id,
    content: app.fixtures.MESSAGES.fromCarrier,
  });
  await app.messagesDal.createMessage({
    id: nanoid(),
    conversationId: conversation.id,
    senderId: shipper.id,
    content: app.fixtures.MESSAGES.fromShipper,
  });
  console.log(`  thread   ${conversation.id}  on ${listingId}`);
}

/** Open, with one bid: the owner has a decision waiting on /home and /listings/me. */
async function seedAwaitingChoice(app: App, people: People, fleet: Fleet, now: Date) {
  const listing = await ensureListing(app, people.owner.id, app.fixtures.LISTINGS.awaitingChoice, now);
  await ensureOffer(
    app,
    people.carrier.id,
    listing,
    fleet.qaVehicleId,
    9_500,
    "Je monte à Lille jeudi, retour Paris le soir même."
  );
  return listing;
}

async function seedDraft(app: App, people: People, now: Date) {
  return ensureListing(app, people.owner.id, app.fixtures.LISTINGS.draft, now);
}

/**
 * An escalated Expedion job with two bids, owned by the system account, so
 * /admin/awards has something for an operator to decide. The listing is
 * written through the DAL because `createListing` stamps `origin: direct`.
 */
async function seedAwardQueue(app: App, people: People, fleet: Fleet, now: Date) {
  if (!people.system) return null;
  const quote = app.fixtures.expedionQuoteRow(now);
  await app.db.insert(expedionQuotes).values(quote).onConflictDoNothing();

  let listing: ListingRow | null = (await app.listingsDal.getByExternalRef(quote.id)) ?? null;
  if (!listing) {
    const categoryId = await app.listingsDal.ensureDefaultCategory();
    listing = await app.listingsDal.create(
      app.fixtures.expedionListingRow(nanoid(), people.system.id, categoryId, quote, now)
    );
    await app.db
      .update(expedionQuotes)
      .set({ listingId: listing.id, escalatedAt: now, status: "escalated" })
      .where(eq(expedionQuotes.id, quote.id));
    console.log(`  queue    ${listing.id}  ${listing.title}`);
  }

  await ensureOffer(app, people.carrier.id, listing, fleet.qaVehicleId, 29_900, "Disponible dès lundi, camion 20 m³.");
  await ensureOffer(app, people.owner.id, listing, fleet.ownerVehicleId, 31_500, "Utilitaire capitonné, livraison sous 24 h.");
  return listing;
}

// ========================================
// Main
// ========================================

function printSummary(results: {
  completed: { listing: ListingRow; shipment: ShipmentRow };
  driverRun: { listing: ListingRow; shipment: ShipmentRow };
  shipperRun: { listing: ListingRow; shipment: ShipmentRow };
  awaiting: ListingRow;
  draft: ListingRow;
  queue: ListingRow | null;
}): void {
  console.log("\nWhat the owner account now sees");
  console.log(`  /carrier/trips → Effectués   delivered run  ${results.completed.shipment.id}`);
  console.log(`  /driver/shipments            run to walk    ${results.driverRun.shipment.id}`);
  console.log(`  /listings/me                 awarded job    ${results.shipperRun.listing.id}`);
  console.log(`  /listing/${results.awaiting.id}    one bid waiting for a choice`);
  console.log(`  /listings/me (drafts)        draft          ${results.draft.id}`);
  console.log(
    results.queue
      ? `  /admin/awards                escalated job  ${results.queue.id}  (two bids)`
      : "  /admin/awards                skipped — no Expedion system account"
  );
  console.log("\nCounterparties: the shipper and carrier accounts above can sign in with the passwords they were signed up with.");
}

/** Lets the services' fire-and-forget publishes settle before the process ends. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 1500));

async function main() {
  console.log("EXPEDITOO — beta data seed");
  resolveConnection();
  const app = await loadApp();
  const now = new Date();

  const people = await resolvePeople(app);
  await verifyCounterparties(app, people);
  const fleet = await ensureFleet(app, people);
  await ensureRoutes(app, people, fleet, now);

  const completed = await seedCompletedRun(app, people, fleet, now);
  const driverRun = await seedDriverRun(app, people, fleet, now);
  const shipperRun = await seedShipperRun(app, people, fleet, now);
  const awaiting = await seedAwaitingChoice(app, people, fleet, now);
  const draft = await seedDraft(app, people, now);
  const queue = await seedAwardQueue(app, people, fleet, now);

  printSummary({ completed, driverRun, shipperRun, awaiting, draft, queue });
  await settle();
  process.exit(0);
}

main().catch((error) => {
  console.error("\nSeed failed:", error);
  process.exit(1);
});
