/**
 * ============================================================================
 * Demo data: one fictional cast with four months of believable history
 * ============================================================================
 *
 *   createdb -h localhost -U postgres expeditop_demo
 *   POSTGRES_URL=postgresql://postgres@localhost:5432/expeditop_demo pnpm -s db:migrate
 *   POSTGRES_URL=postgresql://postgres@localhost:5432/expeditop_demo MOCK_PAYMENTS=true pnpm -s db:seed:demo
 *
 * What it is for: screenshots of every role that can be published. So every
 * name, address, phone, email, company and message below is invented, every
 * account lives on the reserved domain `@demo.expeditop.test`, and the script
 * is meant for a database that holds nothing else.
 *
 * How it writes: like `seed-beta-data.ts`, through the app's own services and
 * DALs, so document numbers, events, notifications, payouts and receipts are
 * the ones the product writes. Each story is played forward today — the
 * services refuse a past pickup, a past slot, a review before delivery — and
 * then moved back in time by SQL, phase by phase (`Clock.flush`), so it reads
 * as history. What is written without a service, and why:
 *
 *   - accounts and credentials (as `seed-dev-users.ts`: Better Auth's own
 *     `hashPassword`, no sign-up mail)
 *   - listing photos: `createListingSchema` wants absolute URLs, and these are
 *     files already in `public/`, stored as site-relative paths so they render
 *     with no R2 bucket
 *   - a person's phone numbers, through the DAL: the service's phone check
 *     does not load under tsx
 *   - the photo gate's placeholder row, retired after the move (beta seed)
 *   - Expedion quotes up to « accepted » (as the beta and Expedion demo seeds
 *     do); payment, publication, assignment and status come from the services
 *   - `carriers.completed_jobs`, which no service maintains
 *   - every timestamp moved back, and read flags on what is old
 *
 * Nothing leaves the machine: mail is dropped (`EMAIL_DEV_RECIPIENT` emptied),
 * and the Ably, Twilio and OpenAI keys are removed from this process.
 *
 * Idempotent per record: accounts by email, carriers by account, stories by
 * (requester, title), quotes by id. A story found is a story skipped whole, so
 * a run that died half-way is repaired by recreating the database, not by
 * running again.
 *
 * Environment:
 *   POSTGRES_URL    a local or allow-listed development database, never production
 *   MOCK_PAYMENTS   must be "true": the awards charge nobody
 *   DEMO_PASSWORD   the password of every demo account (default below)
 */

import "@/lib/load-env";
import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull, like, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { assertDevelopmentDatabase, normaliseConnectionString } from "@/lib/db-target";
import { carriers } from "@/db/schema/carriers";
import { expedionQuotes, type InsertExpedionQuote } from "@/db/schema/expedion";
import { listings } from "@/db/schema/listings";
import { offers } from "@/db/schema/offers";
import { shipmentPhotos, shipments } from "@/db/schema/shipments";
import { account, user, userRoleEnum } from "@/db/schema/users";
import {
  createCarrierRouteSchema,
  type CreateCarrierRouteInput,
} from "@/server/dto/carrier-routes.dto";
import {
  carrierBankingSchema,
  createVehicleSchema,
  uploadDocumentSchema,
  upsertCarrierSchema,
} from "@/server/dto/carrier.dto";
import { createListingSchema, type CreateListingInput } from "@/server/dto/listings.dto";
import { createOfferSchema } from "@/server/dto/offers.dto";
import { createThreadOfferSchema } from "@/server/dto/thread-offers.dto";

// The story is set in France: slot days, « tomorrow » and every wall-clock
// hour below are Paris ones, whatever the laptop's own zone is.
process.env.TZ = "Europe/Paris";

const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-expeditop-2026";
const DOMAIN = "demo.expeditop.test";
const SYSTEM_USER_ID = process.env.EXPEDION_SYSTEM_USER_ID ?? "expedion_system_shipper";

/** Derived from the enum, never restated — CLAUDE.md gotcha 8. */
type Role = (typeof userRoleEnum.enumValues)[number];
type UserRow = typeof user.$inferSelect;
type ListingRow = typeof listings.$inferSelect;
type ShipmentRow = typeof shipments.$inferSelect;
type TimeSlot = "morning" | "afternoon" | "evening";

// ========================================
// Time
// ========================================

const NOW = new Date();
const MINUTE = 60_000;
const DAY = 86_400_000;

/** Paris wall-clock, `days` from today (negative is the past). */
function at(days: number, hour: number, minute = 0): Date {
  return new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days, hour, minute);
}

const plus = (date: Date, minutes: number) => new Date(date.getTime() + minutes * MINUTE);

function dayString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A UTC wall-clock literal: what a `timestamp` column holds. Never a `Date` in raw SQL (gotcha 23). */
const stamp = (date: Date) => date.toISOString().replace("T", " ").replace("Z", "");

/** When a run booked on a slot is actually collected. */
const PICKUP_CLOCK: Record<TimeSlot, [number, number]> = {
  morning: [9, 20],
  afternoon: [14, 10],
  evening: [18, 40],
};

/** Paris in winter. Slots are resolved with it; `shiftSchedule` moves them by Paris days. */
const TZ_OFFSET = -60;

/** Every story is created with its pickup this many days ahead, then moved. */
const CREATE_LEAD_DAYS = 3;

// ========================================
// Target
// ========================================

function resolveConnection(): string {
  const raw = process.env.POSTGRES_URL;
  if (!raw) throw new Error("POSTGRES_URL environment variable is required");
  const cleaned = normaliseConnectionString(raw);
  assertDevelopmentDatabase(cleaned, "seed demo data");

  if (process.env.MOCK_PAYMENTS !== "true") {
    throw new Error("MOCK_PAYMENTS=true is required: the seeded awards must charge nobody.");
  }
  process.env.POSTGRES_URL = cleaned;
  process.env.EXPEDION_SYSTEM_USER_ID = SYSTEM_USER_ID;
  return cleaned;
}

/** Nothing this script does may reach a person or a third party. */
function silenceTheOutsideWorld(): void {
  process.env.EMAIL_DEV_RECIPIENT = "";
  for (const key of [
    "ABLY_API_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
  ]) {
    delete process.env[key];
  }

  // With no Ably key every publish logs a stack trace, and every mail logs
  // that it was dropped: several hundred lines saying what is meant to happen.
  const quiet = /^\[(Ably|email)\]/;
  for (const level of ["log", "error", "warn"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      if (typeof args[0] === "string" && quiet.test(args[0])) return;
      original(...args);
    };
  }
}

/**
 * `timestamp` columns hold UTC, but `defaultNow()` writes the session's local
 * time: on a laptop east of Greenwich every service-written row lands hours
 * ahead of the rows this script dates itself. The demo database is pinned to
 * UTC — as production's is — before the app opens its own pool.
 */
async function pinDatabaseToUtc(url: string): Promise<void> {
  const { default: postgres } = await import("postgres");
  const client = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    const [row] = await client<{ tz: string; name: string }[]>`
      select current_setting('TimeZone') as tz, current_database() as name
    `;
    if (row && row.tz !== "UTC") {
      await client.unsafe(`alter database "${row.name}" set timezone to 'UTC'`);
      console.log(`  database ${row.name}: timezone ${row.tz} → UTC`);
    }
  } finally {
    await client.end();
  }
}

/** Imported after the target is settled, so `@/db`'s import-time guard sees the cleaned URL. */
async function loadApp() {
  const { db } = await import("@/db");
  const usersDal = await import("@/server/dal/users.dal");
  const { carriersDal } = await import("@/server/dal/carriers.dal");
  const { carrierRoutesDal } = await import("@/server/dal/carrier-routes.dal");
  const { expedionDal } = await import("@/server/dal/expedion.dal");
  const { listingsDal } = await import("@/server/dal/listings.dal");
  const { messagesDAL: messagesDal } = await import("@/server/dal/messages.dal");
  const { shipmentPhotosDal } = await import("@/server/dal/shipment-photos.dal");
  const { addressesService } = await import("@/server/services/addresses.service");
  const { carrierService } = await import("@/server/services/carrier.service");
  const { carrierRoutesService } = await import("@/server/services/carrier-routes.service");
  const { expedionService } = await import("@/server/services/expedion.service");
  const { expedionEscalationService } = await import(
    "@/server/services/expedion-escalation.service"
  );
  const { feedbackService } = await import("@/server/services/feedback.service");
  const { listingsService } = await import("@/server/services/listings.service");
  const { messagesService } = await import("@/server/services/messages.service");
  const { offersService } = await import("@/server/services/offers.service");
  const { reviewsService } = await import("@/server/services/reviews.service");
  const { shipmentService } = await import("@/server/services/shipment.service");
  const { shipmentCancellationService } = await import(
    "@/server/services/shipment-cancellation.service"
  );
  const { shipmentConfirmationsService } = await import(
    "@/server/services/shipment-confirmations.service"
  );
  const { shipmentIncidentsService } = await import(
    "@/server/services/shipment-incidents.service"
  );
  const { threadOffersService } = await import("@/server/services/thread-offers.service");
  const { userContactDal } = await import("@/server/dal/user-contact.dal");
  const { withdrawalsService } = await import("@/server/services/withdrawals.service");
  return {
    db,
    usersDal,
    carriersDal,
    carrierRoutesDal,
    expedionDal,
    listingsDal,
    messagesDal,
    shipmentPhotosDal,
    addressesService,
    carrierService,
    carrierRoutesService,
    expedionService,
    expedionEscalationService,
    feedbackService,
    listingsService,
    messagesService,
    offersService,
    reviewsService,
    shipmentService,
    shipmentCancellationService,
    shipmentConfirmationsService,
    shipmentIncidentsService,
    threadOffersService,
    userContactDal,
    withdrawalsService,
  };
}

type App = Awaited<ReturnType<typeof loadApp>>;

// ========================================
// Moving a story back in time
// ========================================

/**
 * Tables a service writes with `created_at = now`, and the columns stamped in
 * the same breath. `also` columns move only where they hold a value.
 */
const STAMPED: ReadonlyArray<{ table: string; column?: string; also?: readonly string[] }> = [
  { table: "listings", also: ["published_at", "updated_at"] },
  { table: "photos" },
  { table: "offers", also: ["updated_at"] },
  { table: "conversations", also: ["updated_at"] },
  { table: "conversation_participants", column: "joined_at" },
  { table: "messages" },
  { table: "thread_offers", also: ["updated_at"] },
  { table: "shipments", also: ["updated_at"] },
  { table: "shipment_events" },
  { table: "shipment_confirmations" },
  { table: "shipment_incidents", also: ["updated_at"] },
  { table: "shipment_photos", also: ["recorded_at"] },
  { table: "payments", also: ["authorised_at", "captured_at", "updated_at"] },
  { table: "invoices", also: ["issued_at", "paid_at", "updated_at"] },
  { table: "payouts", also: ["updated_at"] },
  { table: "reviews" },
  { table: "notifications" },
  { table: "withdrawals", also: ["updated_at"] },
  { table: "feedback_tickets", also: ["updated_at"] },
  { table: "expedion_quote_events" },
];

/** Lets the services' fire-and-forget writes land before they are dated. */
const breathe = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Dates everything written since the last call. A story is played as a series
 * of phases — posted, each bid, the award, each status — and every row a phase
 * produced, whichever service wrote it, takes that phase's moment.
 */
class Clock {
  private cursor = "";

  constructor(private readonly app: App) {}

  /** Starts a phase without dating the one before: for what happens « now ». */
  async mark(): Promise<void> {
    await breathe();
    const rows = (await this.app.db.execute(sql`
      select to_char(date_trunc('milliseconds', localtimestamp), 'YYYY-MM-DD HH24:MI:SS.MS') as t
    `)) as unknown as Array<{ t: string }>;
    this.cursor = rows[0]?.t ?? this.cursor;
  }

  async flush(moment: Date): Promise<void> {
    if (moment.getTime() >= NOW.getTime()) return this.mark();
    await breathe();
    for (const { table, column = "created_at", also = [] } of STAMPED) {
      const extra = also
        .map((c) => `, "${c}" = case when "${c}" is null then null else '${stamp(moment)}'::timestamp end`)
        .join("");
      await this.app.db.execute(
        sql.raw(
          `update "${table}" set "${column}" = '${stamp(moment)}'::timestamp${extra} ` +
            `where "${column}" >= '${this.cursor}'::timestamp`
        )
      );
    }
    await this.mark();
  }
}

/** One timestamp, moved by whole days on the Paris calendar (so a 09:00 stays a 09:00 across a clock change). */
const moved = (column: string, days: number) =>
  `"${column}" = ((("${column}" at time zone 'UTC') at time zone 'Europe/Paris') ` +
  `+ make_interval(days => ${days})) at time zone 'Europe/Paris' at time zone 'UTC'`;

const movedDay = (column: string, days: number) =>
  `"${column}" = to_char("${column}"::date + ${days}, 'YYYY-MM-DD')`;

/** Moves a job's whole schedule — windows, proposed slots, the booked run — by `days`. */
async function shiftSchedule(app: App, listingId: string, days: number): Promise<void> {
  if (days === 0) return;
  const id = `'${listingId}'`;
  const offersOf = `(select id from offers where listing_id = ${id})`;
  const statements = [
    `update listings set ${["pickup_from", "pickup_until", "dropoff_from", "dropoff_until", "expires_at"]
      .map((c) => moved(c, days))
      .join(", ")} where id = ${id}`,
    `update offers set ${moved("estimated_pickup", days)}, ${moved("estimated_delivery", days)} where listing_id = ${id}`,
    `update offer_slots set ${movedDay("day", days)}, ${["starts_at", "ends_at", "delivery_at"]
      .map((c) => moved(c, days))
      .join(", ")} where offer_id in ${offersOf}`,
    `update thread_offers set ${movedDay("pickup_day", days)}, ${moved("pickup_at", days)}, ${moved("delivery_at", days)} ` +
      `where conversation_id in (select id from conversations where listing_id = ${id})`,
    `update shipments set ${moved("scheduled_pickup", days)}, ${moved("scheduled_delivery", days)} ` +
      `where listing_id = ${id} and scheduled_pickup is not null`,
  ];
  for (const statement of statements) await app.db.execute(sql.raw(statement));
}

/** The last thing that happened to a job is when its rows were last touched. */
async function seal(app: App, listingId: string, moment: Date): Promise<void> {
  if (moment.getTime() >= NOW.getTime()) return;
  const id = `'${listingId}'`;
  const when = `'${stamp(moment)}'::timestamp`;
  const shipmentsOf = `(select id from shipments where listing_id = ${id})`;
  const statements = [
    `update listings set updated_at = ${when} where id = ${id}`,
    `update offers set updated_at = ${when} where listing_id = ${id}`,
    `update shipments set updated_at = ${when} where listing_id = ${id}`,
    `update payments set updated_at = ${when} where listing_id = ${id}`,
    `update payouts set updated_at = ${when} where shipment_id in ${shipmentsOf}`,
  ];
  for (const statement of statements) await app.db.execute(sql.raw(statement));
}

// ========================================
// The cast
// ========================================

interface PersonSpec {
  key: string;
  id?: string;
  first: string;
  last: string;
  alias?: string;
  roles: readonly Role[];
  phone?: string;
  relative?: { name: string; phone: string };
  joinedDaysAgo: number;
  signIn: boolean;
}

/** 06 39 98 xx xx is one of the ranges ARCEP keeps for fiction. */
const PEOPLE = {
  camille: {
    key: "camille",
    first: "Camille",
    last: "Laurent",
    alias: "Camille L.",
    roles: [],
    phone: "+33639980112",
    relative: { name: "Maxime Laurent", phone: "+33639980113" },
    joinedDaysAgo: 140,
    signIn: true,
  },
  helene: {
    key: "helene",
    first: "Hélène",
    last: "Garnier",
    alias: "Hélène G.",
    roles: [],
    phone: "+33639980121",
    joinedDaysAgo: 62,
    signIn: true,
  },
  antoine: {
    key: "antoine",
    first: "Antoine",
    last: "Mercier",
    alias: "Antoine M.",
    roles: [],
    phone: "+33639980122",
    joinedDaysAgo: 35,
    signIn: true,
  },
  julien: {
    key: "julien",
    first: "Julien",
    last: "Moreau",
    alias: "Moreau Transports",
    roles: [],
    phone: "+33639980131",
    relative: { name: "Sarah Moreau", phone: "+33639980132" },
    joinedDaysAgo: 150,
    signIn: true,
  },
  nadia: {
    key: "nadia",
    first: "Nadia",
    last: "Benali",
    alias: "Benali Express",
    roles: [],
    phone: "+33639980141",
    joinedDaysAgo: 132,
    signIn: true,
  },
  thomas: {
    key: "thomas",
    first: "Thomas",
    last: "Girard",
    alias: "Girard Déménagements",
    roles: [],
    phone: "+33639980151",
    joinedDaysAgo: 118,
    signIn: true,
  },
  lea: {
    key: "lea",
    first: "Léa",
    last: "Fontaine",
    alias: "Fontaine Coursier",
    roles: [],
    phone: "+33639980161",
    joinedDaysAgo: 96,
    signIn: true,
  },
  karim: {
    key: "karim",
    first: "Karim",
    last: "Haddad",
    alias: "Karim H.",
    roles: [],
    phone: "+33639980171",
    joinedDaysAgo: 75,
    signIn: true,
  },
  bruno: {
    key: "bruno",
    first: "Bruno",
    last: "Lefèvre",
    alias: "Lefèvre Fret",
    roles: [],
    phone: "+33639980181",
    joinedDaysAgo: 110,
    signIn: true,
  },
  ines: {
    key: "ines",
    first: "Inès",
    last: "Roussel",
    alias: "Roussel Livraisons",
    roles: [],
    phone: "+33639980191",
    joinedDaysAgo: 3,
    signIn: true,
  },
  mathieu: {
    key: "mathieu",
    first: "Mathieu",
    last: "Perrin",
    alias: "Mathieu P.",
    roles: [],
    phone: "+33639980192",
    joinedDaysAgo: 1,
    signIn: true,
  },
  admin: {
    key: "admin",
    first: "Équipe",
    last: "Expeditop",
    roles: ["admin"],
    joinedDaysAgo: 200,
    signIn: true,
  },
  operator: {
    key: "operator",
    first: "Claire",
    last: "Dubois",
    alias: "Claire · Expeditop",
    roles: ["operator"],
    joinedDaysAgo: 180,
    signIn: true,
  },
  system: {
    key: "expedion-system",
    id: SYSTEM_USER_ID,
    first: "Expedion",
    last: "Enchères",
    roles: [],
    joinedDaysAgo: 200,
    signIn: false,
  },
} as const satisfies Record<string, PersonSpec>;

type PersonKey = keyof typeof PEOPLE;
type Cast = Record<PersonKey, UserRow>;

const emailOf = (key: string) => `${key}@${DOMAIN}`;

/**
 * Better Auth looks up email/password credentials by providerId "credential"
 * with accountId set to the user id (seed-dev-users.ts).
 */
async function setCredential(app: App, userId: string, passwordHash: string): Promise<void> {
  const existing = await app.db.query.account.findFirst({ where: eq(account.userId, userId) });
  if (existing) {
    await app.db.update(account).set({ password: passwordHash }).where(eq(account.id, existing.id));
    return;
  }
  await app.db.insert(account).values({
    id: nanoid(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });
}

async function ensurePerson(app: App, spec: PersonSpec, passwordHash: string): Promise<UserRow> {
  const email = emailOf(spec.key);
  const found = await app.db.query.user.findFirst({ where: eq(user.email, email) });
  const joined = at(-spec.joinedDaysAgo, 10, 15);

  if (!found) {
    await app.db.insert(user).values({
      id: spec.id ?? `demo_${spec.key}`,
      name: `${spec.first} ${spec.last}`,
      firstName: spec.first,
      lastName: spec.last,
      alias: spec.alias ?? null,
      email,
      emailVerified: true,
      createdAt: joined,
      lastLoginAt: spec.signIn ? at(-1, 18, 5) : null,
    });
  }
  const row = await app.db.query.user.findFirst({ where: eq(user.email, email) });
  if (!row) throw new Error(`account ${email} did not persist`);

  if (spec.signIn) await setCredential(app, row.id, passwordHash);
  // Every sign-up is granted `shipper` (`assignDefaultRole`); staff roles on top.
  for (const role of ["shipper", ...spec.roles] as Role[]) {
    await app.usersDal.assignRoleIfMissing(row.id, role, null);
  }
  // Through the DAL: `userContactService` validates with `libphonenumber-js/min`,
  // whose metadata does not load under tsx (it does in the Next bundle).
  if (spec.phone && !found) {
    await app.userContactDal.upsertDetails(row.id, {
      phone: spec.phone,
      ...(spec.relative
        ? { relativeName: spec.relative.name, relativePhone: spec.relative.phone }
        : {}),
    });
  }
  return row;
}

async function ensureCast(app: App): Promise<Cast> {
  const passwordHash = await hashPassword(PASSWORD);
  const entries: Array<[PersonKey, UserRow]> = [];
  for (const key of Object.keys(PEOPLE) as PersonKey[]) {
    entries.push([key, await ensurePerson(app, PEOPLE[key], passwordHash)]);
  }
  await app.db.execute(sql`
    update user_roles set assigned_at = u.created_at
    from "user" u
    where u.id = user_roles.user_id and u.email like ${"%@" + DOMAIN} and user_roles.role = 'shipper'
  `);
  console.log(`  accounts ${entries.length}`);
  return Object.fromEntries(entries) as Cast;
}

// ========================================
// Places
// ========================================

interface Place {
  address: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
  locationType: "house" | "apartment" | "shop" | "office" | "storage_unit" | "warehouse";
  floor?: number;
  hasLift?: boolean;
  note?: string;
}

/** Invented street names in real towns; the pins are town-level, not a door. */
const PLACES = {
  lyonHome: {
    address: "14 rue des Tisserands",
    city: "Lyon",
    postalCode: "69004",
    lat: 45.7752,
    lng: 4.8281,
    locationType: "apartment",
    floor: 2,
    hasLift: true,
    note: "Interphone « Laurent », stationnement possible devant le porche.",
  },
  lyonCellar: {
    address: "3 allée du Parc aux Tilleuls",
    city: "Villeurbanne",
    postalCode: "69100",
    lat: 45.7698,
    lng: 4.8812,
    locationType: "storage_unit",
    floor: 0,
    note: "Box n° 27, badge à l'accueil.",
  },
  lyonShop: {
    address: "22 quai des Brocanteurs",
    city: "Lyon",
    postalCode: "69002",
    lat: 45.7541,
    lng: 4.8263,
    locationType: "shop",
  },
  paris: {
    address: "27 rue des Lilas Blancs",
    city: "Paris",
    postalCode: "75019",
    lat: 48.8791,
    lng: 2.3934,
    locationType: "apartment",
    floor: 3,
    hasLift: true,
  },
  parisEast: {
    address: "9 passage des Ébénistes",
    city: "Paris",
    postalCode: "75011",
    lat: 48.8553,
    lng: 2.3791,
    locationType: "apartment",
    floor: 1,
    hasLift: false,
  },
  grenoble: {
    address: "8 chemin des Alpages",
    city: "Grenoble",
    postalCode: "38000",
    lat: 45.1885,
    lng: 5.7245,
    locationType: "house",
  },
  marseille: {
    address: "52 boulevard des Calanques",
    city: "Marseille",
    postalCode: "13008",
    lat: 43.2641,
    lng: 5.3902,
    locationType: "house",
  },
  annecy: {
    address: "5 impasse du Lac Bleu",
    city: "Annecy",
    postalCode: "74000",
    lat: 45.8992,
    lng: 6.1294,
    locationType: "house",
  },
  bordeaux: {
    address: "19 rue des Vignerons",
    city: "Bordeaux",
    postalCode: "33000",
    lat: 44.8412,
    lng: -0.5732,
    locationType: "house",
  },
  clermont: {
    address: "11 rue des Volcans",
    city: "Clermont-Ferrand",
    postalCode: "63000",
    lat: 45.7772,
    lng: 3.087,
    locationType: "house",
  },
  dijon: {
    address: "6 rue des Moutardiers",
    city: "Dijon",
    postalCode: "21000",
    lat: 47.322,
    lng: 5.0415,
    locationType: "house",
  },
  nice: {
    address: "30 avenue des Mimosas",
    city: "Nice",
    postalCode: "06000",
    lat: 43.7102,
    lng: 7.262,
    locationType: "apartment",
    floor: 4,
    hasLift: true,
  },
  saintEtienne: {
    address: "9 rue des Passementiers",
    city: "Saint-Étienne",
    postalCode: "42000",
    lat: 45.4397,
    lng: 4.3872,
    locationType: "house",
  },
  lille: {
    address: "21 rue des Brasseurs",
    city: "Lille",
    postalCode: "59000",
    lat: 50.6292,
    lng: 3.0573,
    locationType: "house",
  },
  toulouse: {
    address: "4 rue des Violettes",
    city: "Toulouse",
    postalCode: "31000",
    lat: 43.6045,
    lng: 1.444,
    locationType: "house",
  },
  nantes: {
    address: "12 rue des Chantiers",
    city: "Nantes",
    postalCode: "44000",
    lat: 47.2184,
    lng: -1.5536,
    locationType: "house",
  },
  strasbourg: {
    address: "7 rue des Cigognes",
    city: "Strasbourg",
    postalCode: "67000",
    lat: 48.5734,
    lng: 7.7521,
    locationType: "house",
  },
  montpellier: {
    address: "15 rue des Garrigues",
    city: "Montpellier",
    postalCode: "34000",
    lat: 43.6108,
    lng: 3.8767,
    locationType: "apartment",
    floor: 1,
    hasLift: false,
  },
  valence: {
    address: "2 rue des Vergers",
    city: "Valence",
    postalCode: "26000",
    lat: 44.9334,
    lng: 4.8924,
    locationType: "office",
  },
  chambery: {
    address: "18 rue des Éléphants Blancs",
    city: "Chambéry",
    postalCode: "73000",
    lat: 45.5646,
    lng: 5.9178,
    locationType: "house",
  },
  avignon: {
    address: "10 chemin des Cigales",
    city: "Avignon",
    postalCode: "84000",
    lat: 43.9493,
    lng: 4.8055,
    locationType: "warehouse",
  },
  grenobleFlat: {
    address: "33 rue des Écrins",
    city: "Grenoble",
    postalCode: "38100",
    lat: 45.1721,
    lng: 5.7318,
    locationType: "house",
  },
  lyonEast: {
    address: "41 avenue des Frères Charpentier",
    city: "Lyon",
    postalCode: "69008",
    lat: 45.7352,
    lng: 4.8701,
    locationType: "house",
  },
  lyonWarehouse: {
    address: "6 rue de l'Entrepôt des Soieries",
    city: "Vénissieux",
    postalCode: "69200",
    lat: 45.7042,
    lng: 4.8853,
    locationType: "warehouse",
  },
} as const satisfies Record<string, Place>;

function endpoint(place: Place) {
  return {
    address: place.address,
    city: place.city,
    postalCode: place.postalCode,
    lat: place.lat,
    lng: place.lng,
    locationType: place.locationType,
    ...(place.floor !== undefined ? { floor: place.floor } : {}),
    ...(place.hasLift !== undefined ? { hasLift: place.hasLift } : {}),
    ...(place.note ? { note: place.note } : {}),
  };
}

// ========================================
// Carriers
// ========================================

/** A SIRET that passes Luhn and belongs to nobody: thirteen invented digits and their check digit. */
function demoSiret(base13: string): string {
  const luhn = (digits: string) =>
    [...digits].reduce((total, char, index) => {
      const digit = Number(char);
      if (index % 2 !== 0) return total + digit;
      const doubled = digit * 2;
      return total + (doubled > 9 ? doubled - 9 : doubled);
    }, 0);
  for (let check = 0; check < 10; check += 1) {
    if (luhn(`${base13}${check}`) % 10 === 0) return `${base13}${check}`;
  }
  throw new Error(`no check digit for ${base13}`);
}

/** A French IBAN with a valid mod-97 key over an invented account (bank code 99999 is not allotted). */
function demoIban(account11: string): string {
  const bban = `9999900001${account11}00`;
  const numeric = `${bban}152700`;
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return `FR${String(98 - remainder).padStart(2, "0")}${bban}`;
}

interface VehicleSpec {
  type: "van" | "truck_20m3" | "truck" | "hayon_tailgate" | "little_car" | "break";
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  maxWeightKg: number;
  dims?: [number, number, number];
}

interface CarrierSpec {
  person: PersonKey;
  kind: "professional" | "private";
  companyName?: string;
  siretBase?: string;
  legalForm?: string;
  addressLine: string;
  city: string;
  postalCode: string;
  bio: string;
  vehicles: readonly VehicleSpec[];
  account?: string;
  documents: readonly ("cni_recto" | "cni_verso" | "driving_licence" | "insurance_certificate" | "rib" | "kbis")[];
  approve: boolean;
  appliedDaysAgo: number;
}

const ALL_DOCUMENTS = ["cni_recto", "cni_verso", "driving_licence", "insurance_certificate", "rib"] as const;

const CARRIERS: readonly CarrierSpec[] = [
  {
    person: "julien",
    kind: "professional",
    companyName: "Moreau Transports",
    siretBase: "9001047310001",
    legalForm: "EURL",
    addressLine: "8 rue des Mariniers",
    city: "Lyon",
    postalCode: "69007",
    bio: "Transport de meubles et d'objets fragiles entre Lyon, Paris et le Sud-Est. Deux véhicules, sangles, couvertures et diable à bord.",
    vehicles: [
      { type: "van", make: "Renault", model: "Master L2H2", year: 2022, plateNumber: "GT-482-LM", maxWeightKg: 1200, dims: [340, 180, 190] },
      { type: "truck_20m3", make: "Iveco", model: "Daily 35C16", year: 2020, plateNumber: "FH-137-RB", maxWeightKg: 2600, dims: [430, 210, 220] },
    ],
    account: "00012345678",
    documents: [...ALL_DOCUMENTS, "kbis"],
    approve: true,
    appliedDaysAgo: 148,
  },
  {
    person: "nadia",
    kind: "professional",
    companyName: "Benali Express",
    siretBase: "9001047320002",
    legalForm: "SASU",
    addressLine: "17 rue des Canuts Verts",
    city: "Villeurbanne",
    postalCode: "69100",
    bio: "Livraisons régionales et longue distance, camion 20 m³ avec hayon.",
    vehicles: [
      { type: "truck_20m3", make: "Mercedes-Benz", model: "Sprinter 20 m³", year: 2021, plateNumber: "GB-905-TK", maxWeightKg: 2500, dims: [420, 205, 215] },
    ],
    account: "00023456789",
    documents: ALL_DOCUMENTS,
    approve: true,
    appliedDaysAgo: 130,
  },
  {
    person: "thomas",
    kind: "professional",
    companyName: "Girard Déménagements",
    siretBase: "9001047330003",
    legalForm: "SARL",
    addressLine: "5 rue des Menuisiers",
    city: "Paris",
    postalCode: "75012",
    bio: "Déménagements et transport de mobilier volumineux, équipe de deux porteurs sur demande.",
    vehicles: [
      { type: "hayon_tailgate", make: "Renault Trucks", model: "Master 22 m³ hayon", year: 2019, plateNumber: "FC-618-ZD", maxWeightKg: 3500, dims: [470, 215, 230] },
    ],
    account: "00034567890",
    documents: ALL_DOCUMENTS,
    approve: true,
    appliedDaysAgo: 116,
  },
  {
    person: "lea",
    kind: "professional",
    companyName: "Fontaine Coursier",
    siretBase: "9001047340004",
    legalForm: "Micro-entreprise",
    addressLine: "29 montée des Lavandières",
    city: "Lyon",
    postalCode: "69005",
    bio: "Courses rapides et petits volumes en Auvergne-Rhône-Alpes.",
    vehicles: [
      { type: "van", make: "Peugeot", model: "Boxer L1H1", year: 2023, plateNumber: "GW-254-NA", maxWeightKg: 1100, dims: [270, 170, 160] },
    ],
    account: "00045678901",
    documents: ALL_DOCUMENTS,
    approve: true,
    appliedDaysAgo: 94,
  },
  {
    person: "karim",
    kind: "private",
    addressLine: "12 rue des Maraîchers",
    city: "Lyon",
    postalCode: "69003",
    bio: "Chauffeur Expeditop — retraits en salle des ventes et livraisons à domicile.",
    vehicles: [
      { type: "van", make: "Citroën", model: "Jumpy XL", year: 2022, plateNumber: "GK-771-PV", maxWeightKg: 1000, dims: [280, 160, 140] },
    ],
    account: "00056789012",
    documents: ALL_DOCUMENTS,
    approve: true,
    appliedDaysAgo: 73,
  },
  {
    person: "bruno",
    kind: "professional",
    companyName: "Lefèvre Fret",
    siretBase: "9001047350005",
    legalForm: "SAS",
    addressLine: "3 route des Entrepôts",
    city: "Saint-Priest",
    postalCode: "69800",
    bio: "Palettes et marchandises volumineuses, porteur avec hayon.",
    vehicles: [
      { type: "truck", make: "MAN", model: "TGL 7.180", year: 2018, plateNumber: "EX-340-HC", maxWeightKg: 3200 },
    ],
    account: "00067890123",
    documents: ALL_DOCUMENTS,
    approve: true,
    appliedDaysAgo: 108,
  },
  {
    person: "ines",
    kind: "professional",
    companyName: "Roussel Livraisons",
    siretBase: "9001047360006",
    legalForm: "Micro-entreprise",
    addressLine: "44 rue des Papetiers",
    city: "Bron",
    postalCode: "69500",
    bio: "Je lance mon activité de livraison de meubles d'occasion autour de Lyon.",
    vehicles: [
      { type: "van", make: "Ford", model: "Transit Custom", year: 2021, plateNumber: "GA-663-EF", maxWeightKg: 1000 },
    ],
    account: "00078901234",
    documents: ALL_DOCUMENTS,
    approve: false,
    appliedDaysAgo: 2,
  },
  {
    person: "mathieu",
    kind: "private",
    addressLine: "7 rue des Horlogers",
    city: "Caluire-et-Cuire",
    postalCode: "69300",
    bio: "Disponible les soirs et week-ends avec mon break.",
    vehicles: [
      { type: "break", make: "Skoda", model: "Octavia Combi", year: 2020, plateNumber: "FR-512-JS", maxWeightKg: 450 },
    ],
    documents: ["cni_recto", "driving_licence"],
    approve: false,
    appliedDaysAgo: 0,
  },
];

interface CarrierHandle {
  id: string;
  userId: string;
  /** In the order the spec lists them: the first is the one a bid names by default. */
  vehicleIds: string[];
}

/** When the application was sent: mid-morning that day, or three quarters of an hour ago for today's. */
const appliedAt = (spec: CarrierSpec) =>
  spec.appliedDaysAgo === 0 ? plus(NOW, -45) : at(-spec.appliedDaysAgo, 11, 30);

type Fleet = Record<PersonKey, CarrierHandle | undefined>;

async function applyAsCarrier(app: App, spec: CarrierSpec, userId: string): Promise<void> {
  const person: PersonSpec = PEOPLE[spec.person];
  const contact = {
    contactPhone: person.phone ?? "+33639980100",
    addressLine: spec.addressLine,
    city: spec.city,
    postalCode: spec.postalCode,
    bio: spec.bio,
  };
  const application =
    spec.kind === "private"
      ? { kind: "private", ...contact }
      : {
          kind: "professional",
          companyName: spec.companyName,
          siret: demoSiret(spec.siretBase ?? ""),
          legalForm: spec.legalForm,
          ...contact,
        };
  await app.carrierService.upsertApplication(userId, upsertCarrierSchema.parse(application));

  for (const vehicle of spec.vehicles) {
    const [maxLengthCm, maxWidthCm, maxHeightCm] = vehicle.dims ?? [];
    await app.carrierService.addVehicle(
      userId,
      createVehicleSchema.parse({
        type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        plateNumber: vehicle.plateNumber,
        maxWeightKg: vehicle.maxWeightKg,
        maxLengthCm,
        maxWidthCm,
        maxHeightCm,
      })
    );
  }
  if (spec.account) {
    await app.carrierService.setBanking(
      userId,
      carrierBankingSchema.parse({ iban: demoIban(spec.account), bic: "DEMOFRPPXXX" })
    );
  }
}

/** Rows only: no object sits behind these keys, exactly as for the placeholder photos. */
async function fileDocuments(app: App, spec: CarrierSpec, userId: string): Promise<void> {
  for (const kind of spec.documents) {
    const expires = kind === "driving_licence" || kind === "insurance_certificate";
    await app.carrierService.uploadDocument(
      userId,
      uploadDocumentSchema.parse({
        kind,
        objectKey: `demo/kyc/${spec.person}/${kind}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 184_000 + kind.length * 3_100,
        ...(expires ? { expiresAt: at(kind === "driving_licence" ? 1400 : 210, 12) } : {}),
      })
    );
  }
}

async function ensureCarrier(app: App, spec: CarrierSpec, cast: Cast): Promise<CarrierHandle> {
  const userId = cast[spec.person].id;
  let row = await app.carriersDal.getByUserId(userId);

  if (!row) {
    await applyAsCarrier(app, spec, userId);
    await fileDocuments(app, spec, userId);
    await app.carrierService.submitApplication(userId);
    const submitted = await app.carriersDal.getByUserId(userId);
    if (!submitted) throw new Error(`carrier for ${spec.person} did not persist`);
    if (spec.approve) await app.carrierService.approve(cast.admin.id, submitted.id);
    await backdateCarrier(app, submitted.id, spec);
    row = await app.carriersDal.getByUserId(userId);
  }
  if (!row) throw new Error(`carrier for ${spec.person} did not persist`);
  const vehicles = await app.carriersDal.listVehicles(row.id);
  const vehicleIds = spec.vehicles.map((wanted) => {
    const found = vehicles.find((v) => v.plateNumber === wanted.plateNumber);
    if (!found) throw new Error(`vehicle ${wanted.plateNumber} did not persist`);
    return found.id;
  });
  return { id: row.id, userId, vehicleIds };
}

async function backdateCarrier(app: App, carrierId: string, spec: CarrierSpec): Promise<void> {
  const applied = appliedAt(spec);
  const when = `'${stamp(applied)}'::timestamp`;
  const approved = `'${stamp(plus(applied, 26 * 60))}'::timestamp`;
  const id = `'${carrierId}'`;
  const statements = [
    spec.approve
      ? `update carriers set created_at = ${when}, approved_at = ${approved}, updated_at = ${approved} where id = ${id}`
      : `update carriers set created_at = ${when}, updated_at = ${when} where id = ${id}`,
    `update vehicles set created_at = ${when}, updated_at = ${when} where carrier_id = ${id}`,
    `update carrier_documents set uploaded_at = ${when} where carrier_id = ${id}`,
    `update carrier_drivers set invited_at = ${when}, accepted_at = ${approved} where carrier_id = ${id}`,
    `update user_roles set assigned_at = ${approved} where role in ('carrier', 'driver') ` +
      `and user_id = (select user_id from carriers where id = ${id})`,
    `update "user" set is_verified = ${spec.approve} where id = (select user_id from carriers where id = ${id})`,
  ];
  for (const statement of statements) await app.db.execute(sql.raw(statement));
}

async function ensureFleet(app: App, cast: Cast, clock: Clock): Promise<Fleet> {
  const fleet: Partial<Fleet> = {};
  for (const spec of CARRIERS) {
    await clock.mark();
    fleet[spec.person] = await ensureCarrier(app, spec, cast);
    // The admins' « nouvelle candidature » bells, and the applicant's own.
    await clock.flush(plus(appliedAt(spec), spec.approve ? 26 * 60 : 1));
  }
  await ensureAbsence(app, cast);
  console.log(`  carriers ${CARRIERS.length} (${CARRIERS.filter((c) => c.approve).length} approved)`);
  return fleet as Fleet;
}

async function ensureAbsence(app: App, cast: Cast): Promise<void> {
  const row = await app.carriersDal.getByUserId(cast.bruno.id);
  if (!row || row.absentSince) return;
  await app.carrierService.setAvailability({ userId: cast.bruno.id }, null, {
    absent: true,
    until: at(13, 8).toISOString(),
    reason: "Congés annuels — retour le lundi.",
  });
  await app.db
    .update(carriers)
    .set({ absentSince: at(-4, 19, 20) })
    .where(eq(carriers.id, row.id));
}

function need(fleet: Fleet, key: PersonKey): CarrierHandle {
  const handle = fleet[key];
  if (!handle) throw new Error(`${key} has no carrier profile`);
  return handle;
}

// ========================================
// Address book and trajets
// ========================================

async function ensureAddresses(app: App, cast: Cast): Promise<void> {
  const existing = await app.addressesService.getByUserId(cast.camille.id);
  if (existing.length > 0) return;
  const home = PLACES.lyonHome;
  const parents = PLACES.paris;
  await app.addressesService.create(cast.camille.id, {
    label: "home",
    street: home.address,
    city: home.city,
    zip: home.postalCode,
    country: "FR",
    details: "2e étage avec ascenseur, interphone « Laurent ».",
    lat: home.lat,
    lng: home.lng,
    isDefault: true,
    usedFor: "pickup",
  });
  await app.addressesService.create(cast.camille.id, {
    label: "Chez mes parents",
    street: parents.address,
    city: parents.city,
    zip: parents.postalCode,
    country: "FR",
    details: "3e étage avec ascenseur, code porte communiqué au chauffeur.",
    lat: parents.lat,
    lng: parents.lng,
    usedFor: "dropoff",
  });
}

function routeInputs(fleet: Fleet): Array<{ owner: PersonKey; input: CreateCarrierRouteInput }> {
  const julien = need(fleet, "julien");
  const nadia = need(fleet, "nadia");
  const stop = (place: Place) => ({
    address: place.address,
    city: place.city,
    postalCode: place.postalCode,
    lat: place.lat,
    lng: place.lng,
  });
  const routes = [
    {
      owner: "julien" as const,
      input: {
        label: "Lyon → Paris, mardi / jeudi / samedi",
        kind: "recurring",
        origin: stop(PLACES.lyonEast),
        destination: stop(PLACES.paris),
        radiusKm: 60,
        daysOfWeek: [2, 4, 6],
        vehicleId: julien.vehicleIds[0],
        capacityKg: 1200,
        isDiscoverable: true,
      },
    },
    {
      owner: "julien" as const,
      input: {
        label: "Paris → Lyon, mercredi / vendredi",
        kind: "recurring",
        origin: stop(PLACES.paris),
        destination: stop(PLACES.lyonEast),
        radiusKm: 60,
        daysOfWeek: [3, 5],
        vehicleId: julien.vehicleIds[0],
        capacityKg: 1200,
        isDiscoverable: true,
      },
    },
    {
      owner: "julien" as const,
      input: {
        label: "Lyon → Marseille, ponctuel",
        kind: "occasional",
        origin: stop(PLACES.lyonEast),
        destination: stop(PLACES.marseille),
        radiusKm: 40,
        dates: [at(9, 8), at(23, 8)],
        vehicleId: julien.vehicleIds[1],
        capacityKg: 2600,
        isDiscoverable: false,
      },
    },
    {
      owner: "nadia" as const,
      input: {
        label: "Lyon → Nantes, un lundi sur deux",
        kind: "occasional",
        origin: stop(PLACES.lyonCellar),
        destination: stop(PLACES.nantes),
        radiusKm: 50,
        dates: [at(6, 8), at(20, 8)],
        vehicleId: nadia.vehicleIds[0],
        capacityKg: 2500,
        isDiscoverable: true,
      },
    },
  ];
  return routes.map(({ owner, input }) => ({ owner, input: createCarrierRouteSchema.parse(input) }));
}

async function ensureRoutes(app: App, cast: Cast, fleet: Fleet): Promise<void> {
  for (const { owner, input } of routeInputs(fleet)) {
    const existing = await app.carrierRoutesDal.listByCarrier(need(fleet, owner).id);
    if (existing.some((route) => route.label === input.label)) continue;
    await app.carrierRoutesService.create(cast[owner].id, input);
  }
  await app.db.execute(sql`
    update carrier_routes set created_at = c.approved_at + interval '2 days', updated_at = c.approved_at + interval '2 days'
    from carriers c
    where c.id = carrier_routes.carrier_id and c.approved_at is not null and carrier_routes.created_at > c.approved_at + interval '3 days'
  `);
}

// ========================================
// Jobs, bids, chat
// ========================================

interface JobSpec {
  title: string;
  description: string;
  weightKg: number;
  dims?: [number, number, number];
  budgetCents: number;
  from: Place;
  to: Place;
  /** Files already in `public/`, stored as site-relative paths. */
  photos?: readonly string[];
  illustration?: "furniture" | "parcel" | "pallet" | "vehicle";
  fragile?: boolean;
  needsHelp?: boolean;
  quantity?: number;
  moving?: { surfaceM2: number };
  /** Pickup window: first day 08:00 to `spanDays` later 18:00, unless `hours` narrows a single day. */
  spanDays?: number;
  hours?: [number, number];
}

interface Bid {
  by: PersonKey;
  priceCents: number;
  /** Day (0 = first day of the window) and time of day; the first is the one a plain accept books. */
  slots: ReadonlyArray<[number, TimeSlot]>;
  leadDays: number;
  message: string;
  vehicle?: number;
}

type Line = [who: "requester" | "carrier", text: string, minutesLater: number];

const PHOTO = {
  sofa: "/images/landing/shipper.webp",
  boxes: "/images/landing/packing.webp",
  parcel: "/images/landing/parcel.webp",
  carton: "/images/landing/hero.webp",
  furniture: "/categories/furniture.png",
  appliances: "/categories/appliances.png",
  music: "/categories/music.png",
  sports: "/categories/sports.png",
  electronics: "/categories/electronics.png",
  misc: "/categories/misc.png",
} as const;

function listingInput(
  job: JobSpec,
  firstDay: number,
  options: { publish: boolean; scheduledPublishAt?: Date }
): CreateListingInput {
  const span = job.spanDays ?? 2;
  const [fromHour, untilHour] = job.hours ?? [8, 18];
  const [lengthCm, widthCm, heightCm] = job.dims ?? [];
  return createListingSchema.parse({
    ...(job.moving ? { jobKind: "moving", movingSurfaceM2: job.moving.surfaceM2 } : {}),
    title: job.title,
    description: job.description,
    weightKg: job.weightKg,
    lengthCm,
    widthCm,
    heightCm,
    quantity: job.quantity ?? 1,
    isFragile: job.fragile ?? false,
    needsHelp: job.needsHelp ?? false,
    pickup: endpoint(job.from),
    dropoff: endpoint(job.to),
    pickupFrom: at(firstDay, fromHour),
    pickupUntil: at(firstDay + span, untilHour),
    dropoffFrom: at(firstDay, fromHour + 3),
    dropoffUntil: at(firstDay + span + 2, 20),
    budgetCents: job.budgetCents,
    ...(job.photos ? {} : { illustration: job.illustration ?? "parcel" }),
    publish: options.publish,
    ...(options.scheduledPublishAt ? { scheduledPublishAt: options.scheduledPublishAt } : {}),
  });
}

async function findListing(app: App, shipperId: string, title: string): Promise<ListingRow | null> {
  const row = await app.db.query.listings.findFirst({
    where: and(eq(listings.shipperId, shipperId), eq(listings.title, title)),
  });
  return row ?? null;
}

async function latestShipment(app: App, listingId: string): Promise<ShipmentRow | null> {
  const row = await app.db.query.shipments.findFirst({
    where: eq(shipments.listingId, listingId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  return row ?? null;
}

async function postJob(
  app: App,
  shipperId: string,
  job: JobSpec,
  firstDay: number,
  options: { publish: boolean; scheduledPublishAt?: Date } = { publish: true }
): Promise<ListingRow> {
  const listing = await app.listingsService.createListing(
    shipperId,
    listingInput(job, firstDay, options)
  );
  if (job.photos?.length) {
    await app.listingsDal.addPhotos(
      job.photos.map((url, order) => ({ id: nanoid(), listingId: listing.id, url, order }))
    );
  }
  return listing;
}

/** What `POST /api/listings/:id/offers` does: the bid, then its card in Messages. */
async function placeBid(app: App, cast: Cast, fleet: Fleet, listing: ListingRow, bid: Bid, firstDay: number) {
  const carrier = need(fleet, bid.by);
  const person = cast[bid.by];
  const input = createOfferSchema.parse({
    vehicleId: carrier.vehicleIds[bid.vehicle ?? 0],
    priceCents: bid.priceCents,
    slots: bid.slots.map(([day, slot]) => ({ day: dayString(at(firstDay + day, 12)), slot })),
    deliveryLeadDays: bid.leadDays,
    tzOffset: TZ_OFFSET,
    message: bid.message,
  });
  const offer = await app.offersService.submitOffer(person.id, listing.id, input);
  await app.threadOffersService.announceBid(
    person.id,
    {
      id: offer.id,
      listingId: listing.id,
      priceCents: offer.priceCents,
      vehicleId: offer.vehicleId ?? null,
      message: offer.message ?? null,
    },
    { slots: input.slots, deliveryLeadDays: input.deliveryLeadDays, tzOffset: input.tzOffset },
    { name: person.name, image: person.image ?? null }
  );
  return offer;
}

/** The thread a bid opened between its carrier and the requester. */
async function threadOf(app: App, carrierId: string, shipperId: string, listingId: string): Promise<string> {
  const found = await app.messagesDal.findConversation(carrierId, shipperId, listingId);
  if (found) return found.id;
  const created = await app.messagesDal.createConversation({ id: nanoid(), listingId }, [
    shipperId,
    carrierId,
  ]);
  return created.id;
}

/** Plays a conversation, each line dated `minutesLater` after the one before. Returns the last moment. */
async function converse(
  app: App,
  clock: Clock,
  conversationId: string,
  speakers: { requester: string; carrier: string },
  lines: readonly Line[],
  from: Date
): Promise<Date> {
  let moment = from;
  for (const [who, text, minutesLater] of lines) {
    moment = plus(moment, minutesLater);
    await app.messagesService.sendMessage(speakers[who], { conversationId, content: text });
    await clock.flush(moment);
  }
  return moment;
}

// ========================================
// Walking a run
// ========================================

async function placeholderPhoto(
  app: App,
  shipment: ShipmentRow,
  stage: "pickup" | "delivery",
  place: Place,
  driverId: string,
  capturedAt: Date
): Promise<void> {
  const id = `demo_photo_${stage}_${shipment.id}`;
  const existing = await app.db.query.shipmentPhotos.findFirst({ where: eq(shipmentPhotos.id, id) });
  if (existing) return;
  await app.shipmentPhotosDal.create({
    id,
    shipmentId: shipment.id,
    stage,
    objectKey: `demo/placeholder-${stage}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1,
    capturedLat: place.lat,
    capturedLng: place.lng,
    capturedAccuracyM: 9,
    capturedAddress: `${place.address}, ${place.postalCode} ${place.city}`,
    capturedAt,
    uploadedByUserId: driverId,
  });
}

/** The gate only counts live rows; retiring the placeholder keeps the UI from rendering a key with nothing behind it. */
async function retirePlaceholders(app: App, shipmentId: string, byUserId: string, moment: Date) {
  await app.db
    .update(shipmentPhotos)
    .set({
      deletedAt: moment,
      deletedByUserId: byUserId,
      deletionReason: "Placeholder from the demo seed — no image object was ever stored.",
    })
    .where(
      and(
        eq(shipmentPhotos.shipmentId, shipmentId),
        like(shipmentPhotos.objectKey, "demo/%"),
        isNull(shipmentPhotos.deletedAt)
      )
    );
}

interface RunTimes {
  assigned: Date;
  pickedUp?: Date;
  inTransit?: Date;
  delivered?: Date;
}

interface Run {
  app: App;
  clock: Clock;
  shipment: ShipmentRow;
  driverId: string;
  requesterId: string | null;
  job: Pick<JobSpec, "from" | "to">;
}

async function setShipmentTime(app: App, shipmentId: string, column: "picked_up_at" | "delivered_at", moment: Date) {
  await app.db.execute(
    sql.raw(`update shipments set ${column} = '${stamp(moment)}'::timestamp where id = '${shipmentId}'`)
  );
}

/** The client's own « oui, c'est fait », on the two moments goods change hands. */
async function attest(run: Run, milestone: "PICKED_UP" | "DELIVERED", moment: Date): Promise<void> {
  if (!run.requesterId) return;
  await run.app.shipmentConfirmationsService.attestInApp(
    run.shipment.id,
    { userId: run.requesterId },
    { milestone }
  );
  await run.clock.flush(moment);
}

async function collect(run: Run, times: RunTimes): Promise<void> {
  const { app, clock, shipment, driverId } = run;
  await app.shipmentService.updateStatus(shipment.id, "ASSIGNED", { userId: driverId });
  await clock.flush(times.assigned);
  if (!times.pickedUp) return;

  await placeholderPhoto(app, shipment, "pickup", run.job.from, driverId, times.pickedUp);
  await app.shipmentService.updateStatus(shipment.id, "PICKED_UP", { userId: driverId });
  await setShipmentTime(app, shipment.id, "picked_up_at", times.pickedUp);
  await clock.flush(times.pickedUp);
  await attest(run, "PICKED_UP", plus(times.pickedUp, 12));
  if (!times.inTransit) return;

  await app.shipmentService.updateStatus(shipment.id, "IN_TRANSIT", { userId: driverId });
  await clock.flush(times.inTransit);
}

async function deliver(run: Run, delivered: Date): Promise<void> {
  const { app, clock, shipment, driverId } = run;
  await placeholderPhoto(app, shipment, "delivery", run.job.to, driverId, delivered);
  await app.shipmentService.updateStatus(shipment.id, "DELIVERED", { userId: driverId });
  await setShipmentTime(app, shipment.id, "delivered_at", delivered);
  await clock.flush(delivered);
  await attest(run, "DELIVERED", plus(delivered, 35));
  await retirePlaceholders(app, shipment.id, driverId, plus(delivered, 36));
}

async function review(
  app: App,
  clock: Clock,
  shipmentId: string,
  authorId: string,
  rating: number,
  comment: string,
  moment: Date
): Promise<void> {
  await app.reviewsService.createReview(authorId, { shipmentId, rating, comment });
  await clock.flush(moment);
}

// ========================================
// A delivered job, start to finish
// ========================================

interface DeliveredSpec {
  job: JobSpec;
  /** How long ago the goods were collected. */
  pickupDaysAgo: number;
  /** Hours on the road. */
  transitHours: number;
  bids: readonly Bid[];
  winner: PersonKey;
  chat?: readonly Line[];
  reviews: { byRequester: [number, string]; byCarrier: [number, string] };
  incident?: {
    category: "damage" | "delay";
    severity: "low" | "medium";
    description: string;
    resolution: string;
  };
}

interface StoryResult {
  listing: ListingRow;
  shipment: ShipmentRow | null;
  fresh: boolean;
}

async function existingStory(app: App, shipperId: string, title: string): Promise<StoryResult | null> {
  const listing = await findListing(app, shipperId, title);
  if (!listing) return null;
  return { listing, shipment: await latestShipment(app, listing.id), fresh: false };
}

interface Timeline {
  firstDay: number;
  posted: Date;
  award: Date;
  pickedUp: Date;
  delivered: Date;
}

function timelineFor(spec: Pick<DeliveredSpec, "pickupDaysAgo" | "transitHours" | "bids" | "winner">): Timeline {
  const winning = spec.bids.find((bid) => bid.by === spec.winner);
  const [, slot] = winning?.slots[0] ?? [0, "morning" as TimeSlot];
  const [hour, minute] = PICKUP_CLOCK[slot];
  const pickedUp = at(-spec.pickupDaysAgo, hour, minute);
  return {
    firstDay: -spec.pickupDaysAgo,
    posted: at(-spec.pickupDaysAgo - 6, 19, 5 + (spec.pickupDaysAgo % 40)),
    award: at(-spec.pickupDaysAgo - 2, 20, 10 + (spec.pickupDaysAgo % 35)),
    pickedUp,
    delivered: plus(pickedUp, spec.transitHours * 60),
  };
}

/** Posts the job and takes its bids, a few hours apart, each with its card in Messages. */
async function openForBids(
  app: App,
  clock: Clock,
  cast: Cast,
  fleet: Fleet,
  requester: UserRow,
  job: JobSpec,
  bids: readonly Bid[],
  posted: Date
) {
  await clock.mark();
  const listing = await postJob(app, requester.id, job, CREATE_LEAD_DAYS);
  await clock.flush(posted);

  const offers = new Map<PersonKey, Awaited<ReturnType<typeof placeBid>>>();
  let moment = posted;
  for (const bid of bids) {
    moment = plus(moment, 95 + bid.priceCents % 140);
    offers.set(bid.by, await placeBid(app, cast, fleet, listing, bid, CREATE_LEAD_DAYS));
    await clock.flush(moment);
  }
  return { listing, offers, lastBidAt: moment };
}

async function award(app: App, clock: Clock, requesterId: string, offerId: string, moment: Date) {
  const result = await app.offersService.acceptOffer(requesterId, offerId);
  if (!result.shipment) throw new Error(`award of ${offerId} produced no shipment`);
  await clock.flush(moment);
  return result.shipment;
}

async function reportAndResolve(
  run: Run,
  cast: Cast,
  incident: NonNullable<DeliveredSpec["incident"]>,
  reportedAt: Date,
  resolvedAt: Date
): Promise<() => Promise<void>> {
  const { app, clock, shipment } = run;
  const filed = await app.shipmentIncidentsService.report(
    shipment.id,
    { category: incident.category, severity: incident.severity, description: incident.description, photoUrls: [] },
    { userId: run.requesterId ?? cast.camille.id }
  );
  await clock.flush(reportedAt);

  return async () => {
    await app.shipmentIncidentsService.updateStatus(
      filed.id,
      { status: "RESOLVED", resolutionNote: incident.resolution },
      { userId: cast.operator.id, isOperator: true }
    );
    const when = `'${stamp(resolvedAt)}'::timestamp`;
    await app.db.execute(
      sql.raw(
        `update shipment_incidents set acknowledged_at = ${when} - interval '19 hours', ` +
          `resolved_at = ${when}, updated_at = ${when} where id = '${filed.id}'`
      )
    );
    if (filed.conversationId) {
      await app.messagesService.sendMessage(cast.admin.id, {
        conversationId: filed.conversationId,
        content: `Bonjour, votre signalement a bien été traité. ${incident.resolution}`,
      });
      await clock.flush(resolvedAt);
    }
  };
}

async function deliveredStory(
  app: App,
  clock: Clock,
  cast: Cast,
  fleet: Fleet,
  spec: DeliveredSpec
): Promise<StoryResult> {
  const requester = cast.camille;
  const skipped = await existingStory(app, requester.id, spec.job.title);
  if (skipped) return skipped;

  const t = timelineFor(spec);
  const { listing, offers, lastBidAt } = await openForBids(
    app, clock, cast, fleet, requester, spec.job, spec.bids, t.posted
  );
  const winner = cast[spec.winner];
  const winning = offers.get(spec.winner);
  if (!winning) throw new Error(`${spec.winner} did not bid on ${spec.job.title}`);

  if (spec.chat) {
    const thread = await threadOf(app, winner.id, requester.id, listing.id);
    await converse(app, clock, thread, { requester: requester.id, carrier: winner.id }, spec.chat, lastBidAt);
  }

  const shipment = await award(app, clock, requester.id, winning.id, t.award);
  const run: Run = { app, clock, shipment, driverId: winner.id, requesterId: requester.id, job: spec.job };
  await collect(run, { assigned: plus(t.award, 40), pickedUp: t.pickedUp, inTransit: plus(t.pickedUp, 25) });

  const resolve = spec.incident
    ? await reportAndResolve(run, cast, spec.incident, plus(t.delivered, -8), plus(t.delivered, 2 * 24 * 60 + 95))
    : null;
  await deliver(run, t.delivered);
  if (resolve) await resolve();

  const [stars, words] = spec.reviews.byRequester;
  const [carrierStars, carrierWords] = spec.reviews.byCarrier;
  await review(app, clock, shipment.id, requester.id, stars, words, plus(t.delivered, 20 * 60));
  await review(app, clock, shipment.id, winner.id, carrierStars, carrierWords, plus(t.delivered, 27 * 60));

  await shiftSchedule(app, listing.id, t.firstDay - CREATE_LEAD_DAYS);
  await seal(app, listing.id, plus(t.delivered, 27 * 60));
  console.log(`  delivered  ${listing.id}  ${spec.job.title}`);
  return { listing, shipment, fresh: true };
}

const SLOT_MSG = {
  careful: "Bonjour, je peux m'en charger avec mon utilitaire capitonné. Couvertures et sangles fournies.",
} as const;

const DELIVERED: readonly DeliveredSpec[] = [
  {
    job: {
      title: "Canapé 2 places en velours — Lyon → Paris",
      description:
        "Canapé 2 places en velours côtelé vert, pieds dévissés et rangés dans un sachet. À descendre du 2e étage par l'ascenseur (il passe debout).",
      weightKg: 48,
      dims: [165, 88, 82],
      budgetCents: 19_000,
      from: PLACES.lyonHome,
      to: PLACES.paris,
      photos: [PHOTO.sofa],
      needsHelp: true,
    },
    pickupDaysAgo: 118,
    transitHours: 7,
    bids: [
      { by: "julien", priceCents: 18_000, slots: [[0, "morning"], [2, "morning"]], leadDays: 0, message: "Je fais Lyon → Paris tous les mardis, jeudis et samedis : je peux le charger le matin et le livrer en fin d'après-midi." },
      { by: "nadia", priceCents: 21_000, slots: [[1, "afternoon"]], leadDays: 1, message: "Disponible le lendemain, livraison le surlendemain matin." },
    ],
    winner: "julien",
    chat: [
      ["requester", "Bonjour Julien, l'ascenseur est petit : le canapé passe debout, je l'ai vérifié à l'arrivée. Ça vous va ?", 35],
      ["carrier", "Parfait, je viens avec un collègue pour le porter. Je vous appelle 30 minutes avant d'arriver.", 22],
    ],
    reviews: {
      byRequester: [5, "Ponctuel, soigneux, canapé livré sans une marque. Je recommande Julien les yeux fermés."],
      byCarrier: [5, "Cliente très organisée, tout était prêt à mon arrivée."],
    },
  },
  {
    job: {
      title: "Vélo électrique emballé — Lyon → Grenoble",
      description:
        "Vélo à assistance électrique, roue avant démontée, batterie retirée et emballée à part. Carton vélo fourni.",
      weightKg: 26,
      budgetCents: 6_000,
      from: PLACES.lyonHome,
      to: PLACES.grenoble,
      photos: [PHOTO.sports, PHOTO.carton],
      fragile: true,
    },
    pickupDaysAgo: 104,
    transitHours: 3,
    bids: [
      { by: "lea", priceCents: 6_500, slots: [[0, "afternoon"]], leadDays: 0, message: "Je passe à Grenoble dans l'après-midi, livraison le soir même." },
      { by: "julien", priceCents: 5_500, slots: [[0, "afternoon"], [1, "morning"]], leadDays: 0, message: "Calé debout dans l'utilitaire, sanglé sur la paroi. Livré dans la soirée." },
    ],
    winner: "julien",
    reviews: {
      byRequester: [5, "Vélo arrivé en parfait état, merci pour les photos au chargement."],
      byCarrier: [5, "Emballage impeccable, rien à redire."],
    },
  },
  {
    job: {
      title: "Bureau d'angle et 8 cartons — Lyon → Marseille",
      description:
        "Bureau d'angle démonté (3 colis plats) et 8 cartons de livres et de dossiers, numérotés. Rien de fragile sauf le carton n° 8 (écran).",
      weightKg: 140,
      budgetCents: 26_000,
      from: PLACES.lyonCellar,
      to: PLACES.marseille,
      photos: [PHOTO.boxes, PHOTO.parcel],
      quantity: 11,
    },
    pickupDaysAgo: 92,
    transitHours: 5,
    bids: [
      { by: "nadia", priceCents: 25_500, slots: [[0, "morning"]], leadDays: 0, message: "Camion 20 m³ avec hayon, chargement en dix minutes." },
      { by: "julien", priceCents: 24_000, slots: [[0, "morning"], [1, "morning"]], leadDays: 0, message: "Je descends à Marseille ce jour-là, tout tient dans le Master." },
      { by: "thomas", priceCents: 29_000, slots: [[2, "afternoon"]], leadDays: 1, message: "Possible en fin de semaine, deux porteurs inclus." },
    ],
    winner: "julien",
    reviews: {
      byRequester: [4, "Livraison le jour prévu, une heure de retard à cause des bouchons mais j'ai été prévenue."],
      byCarrier: [5, "Cartons numérotés, accès facile au box. Merci !"],
    },
  },
  {
    job: {
      title: "Armoire normande démontée — Paris → Lyon",
      description:
        "Armoire normande en chêne, démontée en 7 panneaux protégés par des couvertures. Les deux portes sculptées sont à transporter à plat.",
      weightKg: 120,
      dims: [210, 70, 60],
      budgetCents: 34_000,
      from: PLACES.paris,
      to: PLACES.lyonHome,
      photos: [PHOTO.furniture],
      fragile: true,
      needsHelp: true,
    },
    pickupDaysAgo: 80,
    transitHours: 8,
    bids: [
      { by: "thomas", priceCents: 36_000, slots: [[0, "morning"]], leadDays: 1, message: "Nous sommes basés à Paris, enlèvement le matin et livraison le lendemain." },
      { by: "julien", priceCents: 32_000, slots: [[0, "morning"], [2, "morning"]], leadDays: 0, message: "Je remonte de Paris à vide le mercredi et le vendredi : prix serré et livraison le soir même." },
    ],
    winner: "julien",
    chat: [
      ["requester", "Bonsoir, mes parents seront sur place à Paris. Les portes sculptées sont fragiles, pouvez-vous les caler à plat ?", 50],
      ["carrier", SLOT_MSG.careful + " Les portes voyageront à plat entre deux matelas.", 18],
      ["requester", "Super, merci. Je vous attends à Lyon vers 18 h.", 9],
    ],
    reviews: {
      byRequester: [5, "Armoire remontée chez moi sans une éraflure. Julien a même aidé à la remettre d'aplomb."],
      byCarrier: [5, "Accueil très sympathique des deux côtés du trajet."],
    },
  },
  {
    job: {
      title: "Lave-linge 9 kg — Lyon → Annecy",
      description:
        "Lave-linge frontal 9 kg, vidangé, tambour bridé avec ses vis de transport. À livrer au rez-de-chaussée.",
      weightKg: 72,
      dims: [60, 60, 85],
      budgetCents: 10_000,
      from: PLACES.lyonHome,
      to: PLACES.annecy,
      photos: [PHOTO.appliances],
    },
    pickupDaysAgo: 67,
    transitHours: 3,
    bids: [
      { by: "julien", priceCents: 9_500, slots: [[0, "afternoon"]], leadDays: 0, message: "Diable à bord, je le descends seul. Livraison en fin de journée." },
      { by: "lea", priceCents: 9_900, slots: [[1, "morning"]], leadDays: 0, message: "Possible le lendemain matin." },
    ],
    winner: "julien",
    reviews: {
      byRequester: [5, "Rapide et efficace, la machine tournait le soir même."],
      byCarrier: [4, "Stationnement un peu compliqué devant l'immeuble, mais tout s'est bien passé."],
    },
  },
  {
    job: {
      title: "Piano droit d'étude — Lyon → Bordeaux",
      description:
        "Piano droit d'étude, 1,12 m de haut, sur roulettes. Rez-de-chaussée à l'enlèvement, deux marches à la livraison. Housse fournie.",
      weightKg: 210,
      dims: [148, 58, 112],
      budgetCents: 65_000,
      from: PLACES.lyonShop,
      to: PLACES.bordeaux,
      photos: [PHOTO.music],
      fragile: true,
      needsHelp: true,
    },
    pickupDaysAgo: 52,
    transitHours: 9,
    bids: [
      { by: "thomas", priceCents: 69_000, slots: [[1, "morning"]], leadDays: 1, message: "Habitués des pianos : sangles de portage et plateau roulant." },
      { by: "julien", priceCents: 62_000, slots: [[0, "morning"]], leadDays: 0, message: "Je prends le 20 m³ avec hayon et un porteur. Piano sanglé contre la paroi, housse et couvertures." },
      { by: "nadia", priceCents: 64_500, slots: [[2, "morning"]], leadDays: 1, message: "Hayon 750 kg, disponible en fin de semaine." },
    ],
    winner: "julien",
    incident: {
      category: "damage",
      severity: "low",
      description:
        "À l'arrivée, nous avons constaté avec le chauffeur une éraflure de quelques centimètres sur le pied avant gauche du piano. Le reste de l'instrument est intact.",
      resolution:
        "Constat fait avec le chauffeur à la livraison. Un geste commercial de 30 € a été convenu avec Moreau Transports et accepté par la cliente : dossier clos.",
    },
    reviews: {
      byRequester: [4, "Transport sérieux et piano bien arrivé. Une petite éraflure sur un pied, réglée rapidement avec le service client."],
      byCarrier: [5, "Cliente compréhensive, constat fait ensemble à l'arrivée."],
    },
  },
  {
    job: {
      title: "12 cartons de livres — Lyon → Dijon",
      description: "Douze cartons de livres (format déménagement standard), fermés et étiquetés. Environ 15 kg chacun.",
      weightKg: 180,
      budgetCents: 9_000,
      from: PLACES.lyonCellar,
      to: PLACES.dijon,
      photos: [PHOTO.boxes],
      quantity: 12,
    },
    pickupDaysAgo: 31,
    transitHours: 3,
    bids: [
      { by: "julien", priceCents: 8_500, slots: [[0, "morning"], [0, "afternoon"]], leadDays: 0, message: "Je monte vers Dijon ce jour-là, je peux passer au box le matin ou l'après-midi." },
    ],
    winner: "julien",
    reviews: {
      byRequester: [5, "Parfait, comme à chaque fois."],
      byCarrier: [5, "Toujours un plaisir de travailler avec Camille."],
    },
  },
  {
    job: {
      title: "Commode et miroir ancien — Villeurbanne → Nice",
      description:
        "Commode trois tiroirs en merisier et miroir au mercure dans son cadre doré (90 × 60 cm). Le miroir est emballé bulle et carton, à transporter debout.",
      weightKg: 64,
      dims: [110, 55, 90],
      budgetCents: 41_000,
      from: PLACES.lyonCellar,
      to: PLACES.nice,
      photos: [PHOTO.furniture, PHOTO.parcel],
      fragile: true,
    },
    pickupDaysAgo: 19,
    transitHours: 7,
    bids: [
      { by: "nadia", priceCents: 42_000, slots: [[1, "morning"]], leadDays: 1, message: "Je descends sur la Côte d'Azur en milieu de semaine." },
      { by: "julien", priceCents: 39_000, slots: [[0, "morning"]], leadDays: 0, message: "Miroir debout, calé entre deux matelas. Livraison le soir même, 4e étage avec ascenseur noté." },
      { by: "lea", priceCents: 44_500, slots: [[2, "morning"]], leadDays: 0, message: "Possible en fin de semaine avec mon utilitaire." },
    ],
    winner: "julien",
    reviews: {
      byRequester: [5, "Le miroir de ma grand-mère est arrivé intact. Merci pour le soin apporté."],
      byCarrier: [5, "Emballage soigné, accès conforme à la description."],
    },
  },
  {
    job: {
      title: "Réfrigérateur américain — Lyon → Saint-Étienne",
      description:
        "Réfrigérateur américain (portes démontables), débranché depuis 48 h. À transporter debout. Passage de porte de 80 cm à la livraison.",
      weightKg: 115,
      dims: [91, 74, 178],
      budgetCents: 12_000,
      from: PLACES.lyonHome,
      to: PLACES.saintEtienne,
      photos: [PHOTO.appliances],
      needsHelp: true,
    },
    pickupDaysAgo: 6,
    transitHours: 2,
    bids: [
      { by: "nadia", priceCents: 12_500, slots: [[0, "afternoon"]], leadDays: 0, message: "Disponible l'après-midi avec le hayon, pratique pour un appareil de cette taille." },
      { by: "julien", priceCents: 11_000, slots: [[0, "morning"]], leadDays: 0, message: "Diable et sangles, je démonte les portes sur place si besoin." },
    ],
    winner: "julien",
    reviews: {
      byRequester: [5, "Portes démontées et remontées en dix minutes, bravo."],
      byCarrier: [5, "Tout était prêt, merci pour le café !"],
    },
  },
  {
    job: {
      title: "Trois tableaux encadrés — Lyon → Paris",
      description:
        "Trois huiles sur toile encadrées (la plus grande : 100 × 80 cm), protégées par des coins mousse et du film bulle. À plat ou debout, jamais empilées.",
      weightKg: 22,
      budgetCents: 27_000,
      from: PLACES.lyonHome,
      to: PLACES.parisEast,
      photos: [PHOTO.misc, PHOTO.carton],
      fragile: true,
      quantity: 3,
    },
    pickupDaysAgo: 2,
    transitHours: 6,
    bids: [
      { by: "julien", priceCents: 26_000, slots: [[0, "morning"]], leadDays: 0, message: "Trajet habituel du lundi au samedi : les toiles voyagent debout dans un caisson capitonné." },
      { by: "thomas", priceCents: 28_500, slots: [[1, "afternoon"]], leadDays: 0, message: "Retour sur Paris le lendemain, livraison dans la soirée." },
    ],
    winner: "julien",
    reviews: {
      byRequester: [5, "Toiles livrées à l'étage, déballées avec moi pour vérifier. Sérieux du début à la fin."],
      byCarrier: [5, "Merci Camille, à la prochaine !"],
    },
  },
];

// ========================================
// The job cancelled after award, and the one a carrier came off
// ========================================

const CANCELLED_JOB: JobSpec = {
  title: "Table basse en marbre — Lyon → Toulouse",
  description: "Table basse plateau marbre (détachable du piètement), 35 kg le plateau seul. Protégée par une couverture.",
  weightKg: 52,
  budgetCents: 23_000,
  from: PLACES.lyonHome,
  to: PLACES.toulouse,
  photos: [PHOTO.furniture],
  fragile: true,
};

async function cancelledStory(app: App, clock: Clock, cast: Cast, fleet: Fleet): Promise<StoryResult> {
  const requester = cast.camille;
  const skipped = await existingStory(app, requester.id, CANCELLED_JOB.title);
  if (skipped) return skipped;

  const daysAgo = 45;
  const posted = at(-daysAgo - 7, 21, 15);
  const awarded = at(-daysAgo - 4, 19, 40);
  const cancelled = at(-daysAgo - 2, 8, 50);
  const { listing, offers } = await openForBids(app, clock, cast, fleet, requester, CANCELLED_JOB, [
    { by: "julien", priceCents: 21_500, slots: [[0, "morning"]], leadDays: 1, message: "Plateau transporté à plat sur chant, entre deux couvertures." },
    { by: "nadia", priceCents: 22_000, slots: [[1, "morning"]], leadDays: 1, message: "Disponible le lendemain." },
  ], posted);
  const winning = offers.get("julien");
  if (!winning) throw new Error("Julien did not bid on the cancelled job");

  const shipment = await award(app, clock, requester.id, winning.id, awarded);
  await app.shipmentService.updateStatus(shipment.id, "ASSIGNED", { userId: cast.julien.id });
  await clock.flush(plus(awarded, 55));

  await app.shipmentCancellationService.cancelJob(
    shipment.id,
    { category: "date_changed", reason: "La remise des clés à Toulouse est repoussée d'un mois, je republierai ma demande." },
    { kind: "session", viewer: { userId: requester.id } }
  );
  await clock.flush(cancelled);
  const when = `'${stamp(cancelled)}'::timestamp`;
  await app.db.execute(sql.raw(`update shipments set cancelled_at = ${when} where id = '${shipment.id}'`));
  await app.db.execute(
    sql.raw(`update payments set refunded_at = ${when} where listing_id = '${listing.id}' and refunded_at is not null`)
  );

  await shiftSchedule(app, listing.id, -daysAgo - CREATE_LEAD_DAYS);
  await seal(app, listing.id, cancelled);
  console.log(`  cancelled  ${listing.id}  ${CANCELLED_JOB.title}`);
  return { listing, shipment, fresh: true };
}

const REBOARDED_JOB: JobSpec = {
  title: "Table en chêne et 6 chaises — Lyon → Clermont-Ferrand",
  description:
    "Table de ferme en chêne massif (200 × 90 cm, pieds démontés) et six chaises paillées. Les chaises s'empilent deux par deux.",
  weightKg: 135,
  dims: [200, 90, 12],
  budgetCents: 22_000,
  from: PLACES.lyonCellar,
  to: PLACES.clermont,
  photos: [PHOTO.furniture, PHOTO.boxes],
  needsHelp: true,
  quantity: 7,
};

/** Julien wins, his van breaks down, he comes off the job; it goes back on the board and Nadia delivers it. */
async function reboardedStory(app: App, clock: Clock, cast: Cast, fleet: Fleet): Promise<StoryResult> {
  const requester = cast.camille;
  const skipped = await existingStory(app, requester.id, REBOARDED_JOB.title);
  if (skipped) return skipped;

  const daysAgo = 40;
  const posted = at(-daysAgo - 6, 18, 30);
  const firstAward = at(-daysAgo - 4, 12, 20);
  const withdrawn = at(-daysAgo - 2, 6, 40);
  const secondAward = at(-daysAgo - 2, 13, 5);
  const pickedUp = at(-daysAgo, ...PICKUP_CLOCK.afternoon);
  const delivered = plus(pickedUp, 150);

  const { listing, offers } = await openForBids(app, clock, cast, fleet, requester, REBOARDED_JOB, [
    { by: "julien", priceCents: 19_500, slots: [[0, "morning"]], leadDays: 0, message: "Je passe par Clermont en remontant, tout tient dans le Master." },
    { by: "nadia", priceCents: 21_000, slots: [[0, "afternoon"], [1, "morning"]], leadDays: 0, message: "Camion 20 m³, table à plat et chaises sanglées." },
    { by: "thomas", priceCents: 24_000, slots: [[2, "morning"]], leadDays: 1, message: "Possible en fin de semaine." },
  ], posted);
  const first = offers.get("julien");
  const second = offers.get("nadia");
  if (!first || !second) throw new Error("the re-boarded job is missing a bid");

  const firstRun = await award(app, clock, requester.id, first.id, firstAward);
  await app.shipmentService.updateStatus(firstRun.id, "ASSIGNED", { userId: cast.julien.id });
  await clock.flush(plus(firstAward, 30));
  await app.shipmentCancellationService.withdrawFromJob(
    firstRun.id,
    { category: "vehicle_breakdown", reason: "Embrayage du Master en panne ce matin, immobilisé au garage jusqu'à vendredi. Toutes mes excuses." },
    { userId: cast.julien.id }
  );
  await clock.flush(withdrawn);
  const when = `'${stamp(withdrawn)}'::timestamp`;
  await app.db.execute(sql.raw(`update shipments set cancelled_at = ${when}, updated_at = ${when} where id = '${firstRun.id}'`));
  await app.db.execute(
    sql.raw(`update payments set refunded_at = ${when}, updated_at = ${when} where shipment_id = '${firstRun.id}' and refunded_at is not null`)
  );

  const shipment = await award(app, clock, requester.id, second.id, secondAward);
  const run: Run = { app, clock, shipment, driverId: cast.nadia.id, requesterId: requester.id, job: REBOARDED_JOB };
  await collect(run, { assigned: plus(secondAward, 25), pickedUp, inTransit: plus(pickedUp, 20) });
  await deliver(run, delivered);
  await review(app, clock, shipment.id, requester.id, 5, "Nadia a repris la course au pied levé après la panne du premier transporteur. Livraison parfaite.", plus(delivered, 18 * 60));
  await review(app, clock, shipment.id, cast.nadia.id, 5, "Cliente arrangeante malgré le changement de dernière minute.", plus(delivered, 22 * 60));

  await shiftSchedule(app, listing.id, -daysAgo - CREATE_LEAD_DAYS);
  await app.db.execute(sql.raw(`update listings set reopened_at = ${when} where id = '${listing.id}' and reopened_at is not null`));
  await seal(app, listing.id, plus(delivered, 22 * 60));
  await app.db.execute(sql.raw(`update shipments set updated_at = ${when} where id = '${firstRun.id}'`));
  console.log(`  re-boarded ${listing.id}  ${REBOARDED_JOB.title}`);
  return { listing, shipment, fresh: true };
}

// ========================================
// The two live runs
// ========================================

const TRANSIT_JOB: JobSpec = {
  title: "Scooter 125 cm³ — Lyon → Lille",
  description:
    "Scooter 125 cm³ en état de marche, réservoir presque vide, béquille centrale. Carte grise et clés remises au chauffeur. Rampe de chargement nécessaire.",
  weightKg: 128,
  dims: [195, 72, 115],
  budgetCents: 46_000,
  from: PLACES.lyonHome,
  to: PLACES.lille,
  illustration: "vehicle",
};

const TRANSIT_CHAT_BEFORE: readonly Line[] = [
  ["carrier", "Bonjour Camille, bien sûr ! Je monte à Lille la semaine prochaine avec le 20 m³, j'ai une rampe et des sangles moto. Le scooter démarre ?", 42],
  ["requester", "Oui, il roule très bien. Réservoir quasi vide, je vous laisse les clés et la carte grise. Vous feriez ça à quel prix ?", 16],
  ["carrier", "Pour un Lyon → Lille avec arrimage sur rail, je vous fais une proposition juste en dessous.", 11],
];

const TRANSIT_CHAT_AFTER: readonly Line[] = [
  ["carrier", "Merci pour votre confiance ! Je serai chez vous mardi vers 14 h. Y a-t-il de la place pour manœuvrer le camion dans la rue ?", 28],
  ["requester", "Oui, la rue est en sens unique mais il y a une zone de livraison juste devant le n° 14.", 14],
  ["carrier", "Parfait. Je vous envoie un message en partant du dépôt.", 6],
];

const TRANSIT_CHAT_ROAD: readonly Line[] = [
  ["carrier", "Scooter chargé et sanglé, je viens de vous envoyer la photo depuis l'application. Départ pour Lille !", 0],
  ["requester", "Bien reçu, merci Julien. Mon frère vous attendra sur place, je lui transmets votre numéro.", 9],
  ["carrier", "Gros ralentissement sur l'A1 après un accident, je m'arrête pour la nuit près d'Arras. Livraison demain matin à la première heure, désolé pour le contretemps.", 262],
  ["requester", "Aucun souci, la sécurité d'abord. Bonne nuit et à demain !", 12],
];

/** Camille writes first from « Transporteurs disponibles », Julien answers with a price in the thread, she accepts in the bubble. */
async function inTransitStory(app: App, clock: Clock, cast: Cast, fleet: Fleet): Promise<StoryResult & { threadId: string }> {
  const requester = cast.camille;
  const skipped = await existingStory(app, requester.id, TRANSIT_JOB.title);
  if (skipped) {
    return { ...skipped, threadId: await threadOf(app, cast.julien.id, requester.id, skipped.listing.id) };
  }

  const posted = at(-7, 20, 35);
  const speakers = { requester: requester.id, carrier: cast.julien.id };
  const { listing, lastBidAt } = await openForBids(app, clock, cast, fleet, requester, TRANSIT_JOB, [
    { by: "thomas", priceCents: 49_000, slots: [[1, "morning"]], leadDays: 1, message: "Transport de deux-roues sur rail, départ de Lyon en milieu de semaine." },
  ], posted);

  const opened = await app.messagesService.sendMessage(requester.id, {
    recipientId: cast.julien.id,
    listingId: listing.id,
    content: "Bonjour Julien, vous avez déjà transporté mon canapé et mon armoire : seriez-vous disponible pour emmener mon scooter à Lille ?",
  });
  const threadId = opened.conversationId;
  if (!threadId) throw new Error("the scooter thread did not open");
  await clock.flush(plus(lastBidAt, 75));
  const quoted = await converse(app, clock, threadId, speakers, TRANSIT_CHAT_BEFORE, plus(lastBidAt, 75));

  const { threadOffer } = await app.threadOffersService.submit(
    cast.julien.id,
    threadId,
    createThreadOfferSchema.parse({
      priceCents: 43_000,
      pickupDay: dayString(at(CREATE_LEAD_DAYS, 12)),
      pickupSlot: "afternoon",
      deliveryLeadDays: 1,
      tzOffset: TZ_OFFSET,
      vehicleId: need(fleet, "julien").vehicleIds[1],
      message: "430 € tout compris : chargement sur rampe, arrimage sur rail, livraison à Lille le lendemain.",
    }),
    { name: cast.julien.name, image: null }
  );
  await clock.flush(plus(quoted, 4));

  const accepted = at(-4, 18, 40);
  const result = await app.threadOffersService.accept(requester.id, threadOffer.id);
  if (!result.shipmentId) throw new Error("accepting in the thread produced no shipment");
  await clock.flush(accepted);
  await app.db.execute(
    sql.raw(`update thread_offers set responded_at = '${stamp(accepted)}'::timestamp where id = '${threadOffer.id}'`)
  );
  await converse(app, clock, threadId, speakers, TRANSIT_CHAT_AFTER, accepted);

  const shipment = await latestShipment(app, listing.id);
  if (!shipment) throw new Error("the scooter run did not persist");
  const pickedUp = at(-1, ...PICKUP_CLOCK.afternoon);
  const run: Run = { app, clock, shipment, driverId: cast.julien.id, requesterId: requester.id, job: TRANSIT_JOB };
  await collect(run, { assigned: plus(accepted, 20), pickedUp, inTransit: plus(pickedUp, 22) });
  await converse(app, clock, threadId, speakers, TRANSIT_CHAT_ROAD, plus(pickedUp, 24));

  await app.shipmentIncidentsService.report(
    shipment.id,
    {
      category: "delay",
      severity: "low",
      description: "Accident sur l'A1 à hauteur d'Arras, circulation coupée. Arrêt pour la nuit, livraison reportée à demain matin 8 h. La cliente est prévenue.",
      photoUrls: [],
    },
    { userId: cast.julien.id }
  );
  await clock.flush(plus(pickedUp, 24 + 265));

  await shiftSchedule(app, listing.id, -1 - CREATE_LEAD_DAYS);
  await seal(app, listing.id, plus(pickedUp, 24 + 283));
  console.log(`  in transit ${listing.id}  ${TRANSIT_JOB.title}`);
  return { listing, shipment, fresh: true, threadId };
}

const WAITING_JOB: JobSpec = {
  title: "Deux fauteuils club en cuir — Lyon → Toulouse",
  description: "Paire de fauteuils club en cuir patiné. Pas de démontage, à protéger du frottement (couvertures). Rez-de-chaussée des deux côtés.",
  weightKg: 56,
  dims: [85, 80, 75],
  budgetCents: 30_000,
  from: PLACES.lyonShop,
  to: PLACES.toulouse,
  photos: [PHOTO.sofa, PHOTO.furniture],
  quantity: 2,
};

/** Awarded two days ago, collected tomorrow morning. */
async function waitingStory(app: App, clock: Clock, cast: Cast, fleet: Fleet): Promise<StoryResult> {
  const requester = cast.camille;
  const skipped = await existingStory(app, requester.id, WAITING_JOB.title);
  if (skipped) return skipped;

  const awarded = at(-2, 19, 48);
  const { listing, offers, lastBidAt } = await openForBids(app, clock, cast, fleet, requester, WAITING_JOB, [
    { by: "lea", priceCents: 31_000, slots: [[0, "afternoon"]], leadDays: 1, message: "Je peux les prendre dans l'après-midi." },
    { by: "julien", priceCents: 28_000, slots: [[0, "morning"]], leadDays: 0, message: "Enlèvement le matin, livraison à Toulouse en fin de journée. Fauteuils emballés sous couverture." },
    { by: "nadia", priceCents: 29_500, slots: [[1, "morning"]], leadDays: 0, message: "Disponible le lendemain." },
  ], at(-5, 12, 25));
  const winning = offers.get("julien");
  if (!winning) throw new Error("Julien did not bid on the armchairs");

  const thread = await threadOf(app, cast.julien.id, requester.id, listing.id);
  const speakers = { requester: requester.id, carrier: cast.julien.id };
  await converse(app, clock, thread, speakers, [
    ["requester", "Bonjour Julien, la boutique ouvre à 9 h : est-ce que 9 h 30 vous convient ?", 60],
    ["carrier", "Oui, 9 h 30 c'est très bien. Je préviens le destinataire en quittant Lyon.", 25],
  ], lastBidAt);

  const shipment = await award(app, clock, requester.id, winning.id, awarded);
  const run: Run = { app, clock, shipment, driverId: cast.julien.id, requesterId: requester.id, job: WAITING_JOB };
  await collect(run, { assigned: plus(awarded, 35) });
  await converse(app, clock, thread, speakers, [
    ["carrier", "C'est noté pour demain 9 h 30 devant la boutique. À demain !", 0],
  ], at(-1, 17, 45));

  await shiftSchedule(app, listing.id, 1 - CREATE_LEAD_DAYS);
  await seal(app, listing.id, at(-1, 17, 45));
  console.log(`  awaiting   ${listing.id}  ${WAITING_JOB.title}`);
  return { listing, shipment, fresh: true };
}

// ========================================
// What is on the board today
// ========================================

const OPEN_JOBS = {
  buffet: {
    title: "Buffet scandinave en teck — Lyon → Nantes",
    description:
      "Enfilade scandinave en teck des années 60, quatre portes coulissantes. Étagères retirées et emballées à part. À porter à deux, sans la coucher.",
    weightKg: 68,
    dims: [200, 45, 78],
    budgetCents: 36_000,
    from: PLACES.lyonHome,
    to: PLACES.nantes,
    photos: [PHOTO.furniture, PHOTO.sofa],
    fragile: true,
    needsHelp: true,
  },
  washer: {
    title: "Lave-linge séchant — Lyon → Paris",
    description: "Lave-linge séchant 8 kg, bridé pour le transport. À monter au 3e étage avec ascenseur à l'arrivée.",
    weightKg: 78,
    dims: [60, 58, 85],
    budgetCents: 15_000,
    from: PLACES.lyonHome,
    to: PLACES.paris,
    photos: [PHOTO.appliances],
    spanDays: 4,
  },
  urgent: {
    title: "Colis de pièces détachées — Lyon → Valence",
    description: "Deux cartons de pièces détachées pour une machine en panne, attendus à l'atelier avant la fermeture. 18 kg au total.",
    weightKg: 18,
    budgetCents: 7_000,
    from: PLACES.lyonHome,
    to: PLACES.valence,
    photos: [PHOTO.parcel],
    spanDays: 0,
    hours: [14, 18],
    quantity: 2,
  },
  moving: {
    title: "Déménagement d'un studio de 28 m² — Lyon → Montpellier",
    description:
      "Studio meublé : lit 140, canapé convertible, bureau, une quinzaine de cartons, lave-linge. 2e étage avec ascenseur au départ, 1er sans ascenseur à l'arrivée.",
    weightKg: 2100,
    budgetCents: 90_000,
    from: PLACES.lyonHome,
    to: PLACES.montpellier,
    photos: [PHOTO.boxes, PHOTO.sofa],
    moving: { surfaceM2: 28 },
    needsHelp: true,
    spanDays: 3,
  },
  draft: {
    title: "Bibliothèque en chêne — Lyon → Strasbourg",
    description: "Bibliothèque deux corps en chêne, à démonter. Je complète les dimensions ce week-end.",
    weightKg: 95,
    budgetCents: 28_000,
    from: PLACES.lyonHome,
    to: PLACES.strasbourg,
    illustration: "furniture",
  },
  scheduled: {
    title: "Sapin et cartons de décorations — Lyon → Annecy",
    description: "Un sapin artificiel dans son carton (1,80 m) et quatre cartons de décorations de Noël pour la maison de famille.",
    weightKg: 34,
    budgetCents: 8_000,
    from: PLACES.lyonCellar,
    to: PLACES.annecy,
    photos: [PHOTO.carton],
    quantity: 5,
  },
} as const satisfies Record<string, JobSpec>;

interface BoardBid extends Bid {
  minutesAgo: number;
}

/** A live job: posted and bid on in the past few days, its dates real and ahead. */
async function boardStory(
  app: App,
  clock: Clock,
  cast: Cast,
  fleet: Fleet,
  requester: UserRow,
  job: JobSpec,
  firstDay: number,
  postedMinutesAgo: number,
  bids: readonly BoardBid[]
): Promise<StoryResult & { offers: Map<PersonKey, string> }> {
  const offers = new Map<PersonKey, string>();
  const skipped = await existingStory(app, requester.id, job.title);
  if (skipped) return { ...skipped, offers };

  await clock.mark();
  const listing = await postJob(app, requester.id, job, firstDay);
  await clock.flush(plus(NOW, -postedMinutesAgo));
  for (const bid of bids) {
    const offer = await placeBid(app, cast, fleet, listing, bid, firstDay);
    offers.set(bid.by, offer.id);
    await clock.flush(plus(NOW, -bid.minutesAgo));
  }
  const last = Math.min(postedMinutesAgo, ...bids.map((bid) => bid.minutesAgo));
  await seal(app, listing.id, plus(NOW, -last));
  console.log(`  open       ${listing.id}  ${job.title}`);
  return { listing, shipment: null, fresh: true, offers };
}

const HOUR = 60;

interface BuffetResult extends StoryResult {
  threadId: string;
  otherThreadId: string;
}

/** Four offers: one is Expeditop's pick, and Camille has sent Julien a price he has not answered yet. */
async function buffetStory(app: App, clock: Clock, cast: Cast, fleet: Fleet): Promise<BuffetResult> {
  const story = await boardStory(app, clock, cast, fleet, cast.camille, OPEN_JOBS.buffet, 6, 78 * HOUR, [
    { by: "thomas", priceCents: 36_500, slots: [[1, "morning"]], leadDays: 1, message: "Équipe de deux porteurs, enfilade transportée debout sur chariot.", minutesAgo: 2 * 24 * 60 + 190 },
    { by: "nadia", priceCents: 33_500, slots: [[0, "morning"], [0, "afternoon"]], leadDays: 1, message: "Je fais Lyon → Nantes ce lundi : camion 20 m³, hayon, couvertures. Livraison le lendemain avant midi.", minutesAgo: 2 * 24 * 60 + 40 },
    { by: "lea", priceCents: 34_900, slots: [[2, "morning"]], leadDays: 1, message: "Possible en milieu de semaine, mais il me faudra de l'aide au chargement.", minutesAgo: 28 * 60 },
    { by: "julien", priceCents: 31_000, slots: [[1, "morning"], [2, "morning"]], leadDays: 1, message: "Bonjour Camille, je peux prendre l'enfilade mardi ou mercredi matin avec un porteur. 310 €, livraison à Nantes le lendemain.", minutesAgo: 20 * 60 },
  ]);
  const thread = await threadOf(app, cast.julien.id, cast.camille.id, story.listing.id);
  const benali = await threadOf(app, cast.nadia.id, cast.camille.id, story.listing.id);
  const result = { ...story, threadId: thread, otherThreadId: benali };
  if (!story.fresh) return result;

  const julien = story.offers.get("julien");
  const nadia = story.offers.get("nadia");
  if (!julien || !nadia) throw new Error("the buffet is missing a bid");
  const speakers = { requester: cast.camille.id, carrier: cast.julien.id };
  await converse(app, clock, thread, speakers, [
    ["requester", "Bonjour Julien, merci pour votre offre ! Mardi matin m'irait très bien. Les portes coulissantes sont fragiles, vous les bloquez comment ?", 0],
    ["carrier", "Avec du film étirable autour du meuble, puis des couvertures. Il ne bouge pas d'un centimètre.", 14],
    ["requester", "Parfait. J'ai reçu une offre un peu plus haute avec livraison le lendemain aussi… Vous pourriez faire un geste ?", 21],
  ], plus(NOW, -19 * 60));

  await app.offersService.proposeOffer({ userId: cast.operator.id, isOperator: true }, nadia);
  await clock.flush(plus(NOW, -16 * 60));
  await app.offersService.counterOffer(cast.camille.id, julien, {
    priceCents: 28_000,
    note: "Seriez-vous d'accord pour 280 € si je vous aide au chargement ?",
  });
  await clock.flush(plus(NOW, -5 * 60 - 20));

  await converse(app, clock, benali, { requester: cast.camille.id, carrier: cast.nadia.id }, NADIA_CHAT, plus(NOW, -48 * HOUR - 10));
  await seal(app, story.listing.id, plus(NOW, -5 * 60 - 20));
  return result;
}

const NADIA_CHAT: readonly Line[] = [
  ["requester", "Bonjour Nadia, c'est vous qui aviez livré ma table à Clermont, merci encore ! Pour l'enfilade, vous seriez seule ?", 0],
  ["carrier", "Bonjour Camille, avec plaisir ! Non, je viens avec mon frère pour les meubles longs. On la porte à deux, jamais couchée.", 17],
  ["requester", "Très bien. Et la livraison à Nantes, plutôt le matin ?", 8],
  ["carrier", "Oui, entre 9 h et 11 h le mardi. Je vous appelle une heure avant.", 6],
  ["requester", "Noté. J'attends encore une réponse et je vous confirme d'ici demain.", 31],
  ["carrier", "Pas de souci, mon offre reste valable jusqu'à dimanche soir.", 4],
];

async function boardStories(app: App, clock: Clock, cast: Cast, fleet: Fleet) {
  const buffet = await buffetStory(app, clock, cast, fleet);
  const washer = await boardStory(app, clock, cast, fleet, cast.camille, OPEN_JOBS.washer, 5, 30 * HOUR, [
    { by: "lea", priceCents: 14_500, slots: [[2, "morning"]], leadDays: 1, message: "Je monte à Paris en fin de semaine, livraison à l'étage comprise.", minutesAgo: 9 * 60 },
  ]);
  const urgent = await boardStory(app, clock, cast, fleet, cast.camille, OPEN_JOBS.urgent, 1, 4 * HOUR, [
    { by: "lea", priceCents: 6_500, slots: [[0, "afternoon"]], leadDays: 0, message: "Je peux partir à 14 h, livraison à Valence avant 16 h.", minutesAgo: 150 },
    { by: "thomas", priceCents: 7_500, slots: [[0, "afternoon"]], leadDays: 0, message: "Disponible demain après-midi.", minutesAgo: 70 },
  ]);
  const moving = await boardStory(app, clock, cast, fleet, cast.camille, OPEN_JOBS.moving, 12, 52 * HOUR, [
    { by: "thomas", priceCents: 88_000, slots: [[0, "morning"], [1, "morning"]], leadDays: 1, message: "Déménagement complet à deux porteurs : chargement le matin, livraison à Montpellier le lendemain. Cartons et penderies fournis.", minutesAgo: 26 * 60 },
    { by: "nadia", priceCents: 82_000, slots: [[2, "morning"]], leadDays: 1, message: "20 m³ suffisent pour un studio. Un porteur avec moi, démontage du lit compris.", minutesAgo: 11 * 60 },
  ]);
  return { buffet, washer, urgent, moving };
}

async function unpublishedStories(app: App, clock: Clock, cast: Cast) {
  const requester = cast.camille;
  let draft = await findListing(app, requester.id, OPEN_JOBS.draft.title);
  if (!draft) {
    await clock.mark();
    draft = await postJob(app, requester.id, OPEN_JOBS.draft, 16, { publish: false });
    await clock.flush(at(-1, 22, 10));
  }
  let scheduled = await findListing(app, requester.id, OPEN_JOBS.scheduled.title);
  if (!scheduled) {
    await clock.mark();
    scheduled = await postJob(app, requester.id, OPEN_JOBS.scheduled, 17, {
      publish: true,
      scheduledPublishAt: at(3, 8),
    });
    await clock.flush(at(-2, 13, 30));
  }
  return { draft, scheduled };
}

// ========================================
// Other people's requests: what Julien is waiting on
// ========================================

const OTHERS = {
  sofa: {
    title: "Canapé d'angle convertible — Grenoble → Lyon",
    description: "Canapé d'angle convertible en tissu gris, méridienne détachable. Deux colis une fois démonté.",
    weightKg: 95,
    budgetCents: 17_000,
    from: PLACES.grenobleFlat,
    to: PLACES.lyonEast,
    photos: [PHOTO.sofa],
    needsHelp: true,
  },
  tiles: {
    title: "Palette de carrelage — Vénissieux → Avignon",
    description: "Une palette filmée de carrelage grès cérame (80 × 120 cm, 1,10 m de haut). Chargement au transpalette, hayon nécessaire à la livraison.",
    weightKg: 640,
    budgetCents: 25_000,
    from: PLACES.lyonWarehouse,
    to: PLACES.avignon,
    illustration: "pallet",
  },
  bike: {
    title: "Vélo cargo biporteur — Lyon → Chambéry",
    description: "Vélo cargo biporteur (2,50 m de long), batterie retirée. Ne se démonte pas.",
    weightKg: 45,
    dims: [250, 70, 110],
    budgetCents: 14_000,
    from: PLACES.lyonEast,
    to: PLACES.chambery,
    photos: [PHOTO.sports],
  },
} as const satisfies Record<string, JobSpec>;

async function othersStories(app: App, clock: Clock, cast: Cast, fleet: Fleet) {
  await boardStory(app, clock, cast, fleet, cast.helene, OTHERS.sofa, 4, 60 * HOUR, [
    { by: "nadia", priceCents: 16_500, slots: [[0, "afternoon"]], leadDays: 0, message: "Je repasse par Grenoble samedi après-midi.", minutesAgo: 40 * 60 },
    { by: "julien", priceCents: 15_000, slots: [[0, "morning"], [1, "morning"]], leadDays: 0, message: "Retour de tournée par Grenoble, je peux le charger le matin et le livrer à Lyon avant midi.", minutesAgo: 26 * 60 },
  ]);
  await boardStory(app, clock, cast, fleet, cast.antoine, OTHERS.tiles, 7, 20 * HOUR, [
    { by: "julien", priceCents: 23_000, slots: [[2, "morning"]], leadDays: 0, message: "Je descends à Marseille ce jour-là avec le 20 m³ et son hayon : je dépose la palette à Avignon en passant.", minutesAgo: 7 * 60, vehicle: 1 },
  ]);

  const bike = await boardStory(app, clock, cast, fleet, cast.helene, OTHERS.bike, CREATE_LEAD_DAYS, 122 * HOUR, [
    { by: "julien", priceCents: 13_500, slots: [[0, "morning"]], leadDays: 0, message: "Il tient en longueur dans le Master, sanglé contre la paroi.", minutesAgo: 4 * 24 * 60 + 300 },
    { by: "lea", priceCents: 11_900, slots: [[0, "morning"]], leadDays: 0, message: "Je fais Lyon → Chambéry tous les jeudis, livraison avant midi.", minutesAgo: 4 * 24 * 60 + 120 },
  ]);
  const lea = bike.offers.get("lea");
  if (bike.fresh && lea) {
    const awarded = plus(NOW, -20 * HOUR);
    const shipment = await award(app, clock, cast.helene.id, lea, awarded);
    const run: Run = { app, clock, shipment, driverId: cast.lea.id, requesterId: cast.helene.id, job: OTHERS.bike };
    await collect(run, { assigned: plus(awarded, 40) });
    await shiftSchedule(app, bike.listing.id, 2 - CREATE_LEAD_DAYS);
    await seal(app, bike.listing.id, plus(awarded, 40));
  }
}

// ========================================
// Julien's ledger
// ========================================

async function countWithdrawals(app: App, carrierUserId: string): Promise<number> {
  const rows = await app.withdrawalsService.listForCarrier(carrierUserId);
  return rows.length;
}

/** Asked, approved, transferred by hand and recorded: the whole of a withdrawal's life. */
async function paidWithdrawal(app: App, clock: Clock, cast: Cast): Promise<void> {
  if ((await countWithdrawals(app, cast.julien.id)) >= 1) return;
  const requested = at(-63, 9, 12);
  const approved = at(-62, 10, 40);
  const paid = at(-60, 16, 25);
  await clock.mark();
  const withdrawal = await app.withdrawalsService.request(cast.julien.id);
  await clock.flush(requested);
  await app.withdrawalsService.decide(cast.operator.id, withdrawal.id, { action: "approve" });
  await clock.flush(approved);
  await app.withdrawalsService.decide(cast.operator.id, withdrawal.id, {
    action: "mark_paid",
    reference: "VIR-DEMO-2026-0917",
    note: "Virement SEPA émis depuis le compte de la plateforme.",
  });
  await clock.flush(paid);
  const id = `'${withdrawal.id}'`;
  await app.db.execute(
    sql.raw(
      `update withdrawals set decided_at = '${stamp(paid)}'::timestamp, paid_at = '${stamp(paid)}'::timestamp, ` +
        `updated_at = '${stamp(paid)}'::timestamp where id = ${id}`
    )
  );
  await app.db.execute(
    sql.raw(
      `update payouts set paid_at = '${stamp(paid)}'::timestamp, updated_at = '${stamp(paid)}'::timestamp where withdrawal_id = ${id}`
    )
  );
  console.log(`  withdrawal ${withdrawal.id}  paid (${withdrawal.amountCents / 100} €)`);
}

async function pendingWithdrawal(app: App, clock: Clock, cast: Cast): Promise<void> {
  if ((await countWithdrawals(app, cast.julien.id)) >= 2) return;
  await clock.mark();
  const withdrawal = await app.withdrawalsService.request(cast.julien.id);
  await clock.flush(at(-8, 8, 35));
  await app.db.execute(
    sql.raw(
      `update payouts set updated_at = '${stamp(at(-8, 8, 35))}'::timestamp where withdrawal_id = '${withdrawal.id}'`
    )
  );
  console.log(`  withdrawal ${withdrawal.id}  requested (${withdrawal.amountCents / 100} €)`);
}

// ========================================
// Expedion: the client book and the supervision screens
// ========================================

interface QuoteSpec {
  n: number;
  client: [first: string, last: string, city: string, postalCode: string];
  house: keyof typeof AUCTION_HOUSES;
  lot: string;
  to: Place;
  weightKg: number;
  dims: [number, number, number];
  valueCents: number;
  priceCents: number | null;
  /** Where the quote stands before any service touches it. */
  status: "pending" | "quoted" | "accepted" | "cancelled";
  requestedDaysAgo: number;
}

const AUCTION_HOUSES = {
  brotteaux: { name: "Hôtel des ventes des Brotteaux", address: "18 rue des Commissaires", city: "Lyon", postalCode: "69006", lat: 45.7681, lng: 4.8559 },
  marchand: { name: "Étude Marchand & Associés", address: "4 rue des Antiquaires", city: "Paris", postalCode: "75009", lat: 48.8741, lng: 2.3412 },
  vieuxPort: { name: "Salle des ventes du Vieux-Port", address: "31 rue des Armateurs", city: "Marseille", postalCode: "13001", lat: 43.2972, lng: 5.3771 },
} as const;

const QUOTES: readonly QuoteSpec[] = [
  { n: 1, client: ["Sophie", "Marchetti", "Annecy", "74000"], house: "brotteaux", lot: "Paire de bergères Louis XVI, lot 112", to: PLACES.annecy, weightKg: 34, dims: [70, 65, 95], valueCents: 280_000, priceCents: null, status: "pending", requestedDaysAgo: 0 },
  { n: 2, client: ["Olivier", "Renaud", "Dijon", "21000"], house: "marchand", lot: "Pendule portique Empire, lot 47", to: PLACES.dijon, weightKg: 9, dims: [30, 18, 52], valueCents: 190_000, priceCents: null, status: "pending", requestedDaysAgo: 1 },
  { n: 3, client: ["Margaux", "Tessier", "Nantes", "44000"], house: "marchand", lot: "Bureau cylindre en acajou, lot 203", to: PLACES.nantes, weightKg: 82, dims: [130, 65, 115], valueCents: 460_000, priceCents: 39_000, status: "quoted", requestedDaysAgo: 3 },
  { n: 4, client: ["Étienne", "Caron", "Toulouse", "31000"], house: "vieuxPort", lot: "Lustre à pampilles, lot 18", to: PLACES.toulouse, weightKg: 14, dims: [70, 70, 90], valueCents: 120_000, priceCents: 21_000, status: "quoted", requestedDaysAgo: 4 },
  { n: 5, client: ["Julie", "Lambert", "Lille", "59000"], house: "brotteaux", lot: "Commode tombeau Louis XV, lot 76", to: PLACES.lille, weightKg: 58, dims: [125, 62, 88], valueCents: 650_000, priceCents: 44_000, status: "accepted", requestedDaysAgo: 5 },
  { n: 6, client: ["Bernard", "Collet", "Grenoble", "38000"], house: "brotteaux", lot: "Tapis d'Orient roulé, lot 9", to: PLACES.grenoble, weightKg: 28, dims: [300, 40, 40], valueCents: 90_000, priceCents: 12_000, status: "accepted", requestedDaysAgo: 2 },
  { n: 7, client: ["Aurélie", "Vasseur", "Strasbourg", "67000"], house: "marchand", lot: "Console en bois doré, lot 131", to: PLACES.strasbourg, weightKg: 26, dims: [110, 45, 88], valueCents: 310_000, priceCents: 33_000, status: "accepted", requestedDaysAgo: 3 },
  { n: 8, client: ["Pascal", "Meunier", "Bordeaux", "33000"], house: "marchand", lot: "Table à jeux marquetée, lot 64", to: PLACES.bordeaux, weightKg: 22, dims: [85, 85, 76], valueCents: 240_000, priceCents: 36_000, status: "accepted", requestedDaysAgo: 6 },
  { n: 9, client: ["Chloé", "Barbier", "Nice", "06000"], house: "vieuxPort", lot: "Paire de vases de Sèvres, lot 22", to: PLACES.nice, weightKg: 11, dims: [40, 40, 60], valueCents: 520_000, priceCents: 24_000, status: "accepted", requestedDaysAgo: 5 },
  { n: 10, client: ["Laurent", "Hamel", "Clermont-Ferrand", "63000"], house: "brotteaux", lot: "Secrétaire à abattant, lot 88", to: PLACES.clermont, weightKg: 61, dims: [95, 42, 135], valueCents: 330_000, priceCents: 22_000, status: "accepted", requestedDaysAgo: 4 },
  { n: 11, client: ["Nathalie", "Colin", "Saint-Étienne", "42000"], house: "brotteaux", lot: "Miroir trumeau, lot 35", to: PLACES.saintEtienne, weightKg: 19, dims: [80, 8, 150], valueCents: 140_000, priceCents: 13_500, status: "accepted", requestedDaysAgo: 12 },
  { n: 12, client: ["Vincent", "Maillard", "Montpellier", "34000"], house: "vieuxPort", lot: "Coffre de marine, lot 57", to: PLACES.montpellier, weightKg: 47, dims: [110, 55, 60], valueCents: 80_000, priceCents: 18_000, status: "accepted", requestedDaysAgo: 9 },
  { n: 13, client: ["Sandrine", "Picard", "Nantes", "44000"], house: "marchand", lot: "Fauteuil de bureau Empire, lot 150", to: PLACES.nantes, weightKg: 17, dims: [65, 60, 95], valueCents: 110_000, priceCents: 27_000, status: "cancelled", requestedDaysAgo: 15 },
];

const quoteId = (n: number) => `demo_quote_${String(n).padStart(3, "0")}`;

function quoteRow(spec: QuoteSpec): InsertExpedionQuote {
  const house = AUCTION_HOUSES[spec.house];
  const [first, last, city, postalCode] = spec.client;
  const requested = spec.requestedDaysAgo === 0 ? plus(NOW, -95) : at(-spec.requestedDaysAgo, 10, 5 + spec.n * 4);
  const priced = spec.priceCents !== null;
  return {
    id: quoteId(spec.n),
    firebaseUid: `demo-expedion-client-${String(spec.n).padStart(2, "0")}`,
    quoteNumber: `DEVIS-DEMO-${String(spec.n).padStart(3, "0")}`,
    bordereauNumber: `BORD-2026-${4100 + spec.n * 7}`,
    bordereauPaid: spec.status !== "pending",
    firstName: first,
    lastName: last,
    email: `${first}.${last}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() + `@${DOMAIN}`,
    phone: null,
    clientAddress: spec.to.address,
    clientPostalCode: postalCode,
    clientCity: city,
    clientCountry: "France",
    auctionHouseName: house.name,
    pickupAddress: house.address,
    pickupPostalCode: house.postalCode,
    pickupCity: house.city,
    pickupLat: house.lat,
    pickupLng: house.lng,
    saleDate: plus(requested, -2 * 24 * 60),
    recipientName: `${first} ${last}`,
    deliveryAddress: spec.to.address,
    deliveryPostalCode: spec.to.postalCode,
    deliveryCity: spec.to.city,
    deliveryCountry: "France",
    deliveryLat: spec.to.lat,
    deliveryLng: spec.to.lng,
    description: spec.lot,
    lengthCm: spec.dims[0],
    widthCm: spec.dims[1],
    heightCm: spec.dims[2],
    weightKg: spec.weightKg,
    isProtected: spec.n % 2 === 0,
    declaredValueCents: spec.valueCents,
    quoteStandardCents: spec.priceCents,
    quoteInsuredCents: priced ? Math.round((spec.priceCents ?? 0) + spec.valueCents * 0.012) : null,
    acceptedKind: spec.status === "accepted" || spec.status === "cancelled" ? "standard" : null,
    acceptedPriceCents: spec.status === "accepted" || spec.status === "cancelled" ? spec.priceCents : null,
    quoteAvailable: priced,
    status: spec.status,
    paymentStatus: "unpaid",
    requestedAt: requested,
    createdAt: requested,
    updatedAt: plus(requested, priced ? 190 : 0),
  };
}

const QUOTE_HISTORY: Record<QuoteSpec["status"], ReadonlyArray<[QuoteSpec["status"], string, string, number]>> = {
  pending: [["pending", "client", "Demande de devis reçue", 0]],
  quoted: [
    ["pending", "client", "Demande de devis reçue", 0],
    ["quoted", "admin", "Devis établi par la supervision", 190],
  ],
  accepted: [
    ["pending", "client", "Demande de devis reçue", 0],
    ["quoted", "admin", "Devis établi par la supervision", 190],
    ["accepted", "client", "Devis accepté par le client", 420],
  ],
  cancelled: [
    ["pending", "client", "Demande de devis reçue", 0],
    ["quoted", "admin", "Devis établi par la supervision", 190],
    ["accepted", "client", "Devis accepté par le client", 420],
    ["cancelled", "client", "Demande annulée par le client : le lot sera retiré sur place", 2_900],
  ],
};

/** Returns true when the quote was just created, so its onward story still has to be played. */
async function ensureQuote(app: App, clock: Clock, spec: QuoteSpec): Promise<boolean> {
  const id = quoteId(spec.n);
  if (await app.expedionDal.getById(id)) return false;
  const row = quoteRow(spec);
  await app.db.insert(expedionQuotes).values(row);
  for (const [status, actor, message, minutes] of QUOTE_HISTORY[spec.status]) {
    await clock.mark();
    await app.expedionDal.addEvent({ id: nanoid(), quoteId: id, status, actor, message });
    await clock.flush(plus(row.requestedAt ?? NOW, minutes));
  }
  return true;
}

async function payQuote(app: App, clock: Clock, n: number, paidAt: Date): Promise<void> {
  await clock.mark();
  await app.expedionService.markPaid(quoteId(n), { reference: `pi_demo_${n}`, method: "card", via: "demo-seed" });
  await clock.flush(paidAt);
  // `markPaid` starts the 48 h clock from the moment it runs; the payment is dated `paidAt`.
  await stampQuote(app, n, { escalate_after: plus(paidAt, 48 * 60) });
}

async function stampQuote(app: App, n: number, columns: Record<string, Date>): Promise<void> {
  const sets = Object.entries(columns)
    .map(([column, moment]) => `"${column}" = '${moment.toISOString()}'::timestamptz`)
    .join(", ");
  await app.db.execute(
    sql.raw(`update expedion_quotes set ${sets}, updated_at = now() at time zone 'utc' where id = '${quoteId(n)}'`)
  );
}

/** Published to the board by the supervision, with bids waiting in the award queue. */
async function escalatedQuote(
  app: App,
  clock: Clock,
  cast: Cast,
  fleet: Fleet,
  n: number,
  paidAt: Date,
  bids: ReadonlyArray<[PersonKey, number, string, number]>
): Promise<{ listing: ListingRow; offers: Map<PersonKey, string> }> {
  await payQuote(app, clock, n, paidAt);
  const escalatedAt = plus(paidAt, 48 * 60 + 12);
  const { listing } = await app.expedionEscalationService.escalate(quoteId(n), {
    reason: "Aucun chauffeur attribué dans les 48 h : publication sur la place de marché",
    actor: "system",
  });
  await clock.flush(escalatedAt);
  await stampQuote(app, n, { escalated_at: escalatedAt });

  const offers = new Map<PersonKey, string>();
  for (const [by, priceCents, message, minutesAgo] of bids) {
    const carrier = need(fleet, by);
    const day = dayString(new Date(listing.pickupFrom.getTime() + DAY));
    const offer = await app.offersService.submitOffer(
      cast[by].id,
      listing.id,
      createOfferSchema.parse({
        vehicleId: carrier.vehicleIds[0],
        priceCents,
        slots: [{ day, slot: "morning" }],
        deliveryLeadDays: 1,
        tzOffset: TZ_OFFSET,
        message,
      })
    );
    offers.set(by, offer.id);
    await clock.flush(plus(NOW, -minutesAgo));
  }
  await seal(app, listing.id, plus(NOW, -Math.min(...bids.map((bid) => bid[3]))));
  return { listing, offers };
}

/** Assigned from the pool by an operator: `assignDirect` publishes, bids for the driver and awards in one go. */
async function assignedQuote(
  app: App,
  clock: Clock,
  cast: Cast,
  fleet: Fleet,
  n: number,
  driver: PersonKey,
  paidAt: Date,
  assignedAt: Date
) {
  await payQuote(app, clock, n, paidAt);
  const result = await app.expedionEscalationService.assignDirect(
    quoteId(n),
    need(fleet, driver).id,
    cast.operator.id
  );
  if (!result.shipment) throw new Error(`quote ${n} was assigned without a shipment`);
  await clock.flush(assignedAt);
  await stampQuote(app, n, { escalated_at: assignedAt, assigned_at: assignedAt });
  return { listing: result.listing, shipment: result.shipment };
}

async function expedionStories(app: App, clock: Clock, cast: Cast, fleet: Fleet) {
  const fresh = new Set<number>();
  for (const spec of QUOTES) {
    if (await ensureQuote(app, clock, spec)) fresh.add(spec.n);
  }
  const place = (n: number): Pick<JobSpec, "from" | "to"> => {
    const spec = QUOTES[n - 1];
    const house = AUCTION_HOUSES[spec.house];
    return { from: { ...house, locationType: "shop" }, to: spec.to };
  };

  // Paid and waiting for the supervision to choose a lane.
  if (fresh.has(5)) await payQuote(app, clock, 5, at(-1, 14, 20));
  if (fresh.has(6)) await payQuote(app, clock, 6, plus(NOW, -6 * 60));

  // On the board, with bids for an operator to compare.
  if (fresh.has(7)) {
    await escalatedQuote(app, clock, cast, fleet, 7, at(-3, 16, 30), [
      ["thomas", 29_500, "Nous retirons à l'étude deux fois par semaine, livraison à Strasbourg sous 48 h.", 15 * 60],
      ["julien", 27_000, "Console emballée sous couverture et calée, livraison le lendemain du retrait.", 9 * 60],
      ["nadia", 31_000, "Disponible dès lundi.", 3 * 60],
    ]);
  }
  if (fresh.has(8)) {
    await escalatedQuote(app, clock, cast, fleet, 8, at(-4, 11, 10), [
      ["thomas", 33_000, "Retrait à l'étude jeudi, livraison à Bordeaux vendredi.", 22 * 60],
      ["nadia", 34_500, "Camion capitonné, livraison sous trois jours.", 6 * 60],
    ]);
  }

  // Awarded by an operator from the queue, collected yesterday.
  if (fresh.has(9)) {
    const { listing, offers } = await escalatedQuote(app, clock, cast, fleet, 9, at(-5, 10, 0), [
      ["lea", 21_000, "Caisse bois sur mesure pour les vases, retrait mercredi.", 62 * 60],
      ["thomas", 23_500, "Disponible en fin de semaine.", 58 * 60],
    ]);
    const mine = offers.get("lea");
    if (!mine) throw new Error("Léa's bid on quote 9 was not found");
    const awarded = at(-2, 11, 25);
    const result = await app.offersService.acceptOffer(cast.operator.id, mine);
    if (!result.shipment) throw new Error("quote 9 was awarded without a shipment");
    await clock.flush(awarded);
    const pickedUp = at(-1, 10, 40);
    const run: Run = { app, clock, shipment: result.shipment, driverId: cast.lea.id, requesterId: null, job: place(9) };
    await collect(run, { assigned: plus(awarded, 30), pickedUp });
    await retirePlaceholders(app, result.shipment.id, cast.lea.id, plus(pickedUp, 5));
    await shiftSchedule(app, listing.id, -4);
    await seal(app, listing.id, plus(pickedUp, 12));
    await stampQuote(app, 9, { assigned_at: awarded });
  }

  // Assigned from the pool to the in-house driver; collection tomorrow.
  if (fresh.has(10)) {
    const { listing, shipment } = await assignedQuote(app, clock, cast, fleet, 10, "karim", at(-2, 9, 45), at(-1, 10, 30));
    const run: Run = { app, clock, shipment, driverId: cast.karim.id, requesterId: null, job: place(10) };
    await collect(run, { assigned: at(-1, 11, 5) });
    await shiftSchedule(app, listing.id, -1);
  }

  // Assigned from the pool and delivered: one by Julien, one by the in-house driver.
  for (const [n, driver, pickupDaysAgo] of [[11, "julien", 9], [12, "karim", 5]] as const) {
    if (!fresh.has(n)) continue;
    const pickedUp = at(-pickupDaysAgo, 10, 15);
    const assignedAt = at(-pickupDaysAgo - 1, 15, 20);
    const { listing, shipment } = await assignedQuote(app, clock, cast, fleet, n, driver, at(-pickupDaysAgo - 2, 12, 0), assignedAt);
    const run: Run = { app, clock, shipment, driverId: cast[driver].id, requesterId: null, job: place(n) };
    await collect(run, { assigned: plus(assignedAt, 45), pickedUp, inTransit: plus(pickedUp, 20) });
    await deliver(run, plus(pickedUp, 4 * 60));
    await shiftSchedule(app, listing.id, -pickupDaysAgo - 2);
    await seal(app, listing.id, plus(pickedUp, 4 * 60));
  }
  await datePaidQuotes(app);
  console.log(`  expedion   ${QUOTES.length} quotes (${fresh.size} new)`);
}

/** A quote was last touched when its newest event was written. */
async function datePaidQuotes(app: App): Promise<void> {
  await app.db.execute(sql`
    update expedion_quotes q set updated_at = e.last
    from (select quote_id, max(created_at) as last from expedion_quote_events group by quote_id) e
    where e.quote_id = q.id and q.id like 'demo_quote_%'
  `);
}

// ========================================
// Support, feedback
// ========================================

async function feedbackStories(app: App, clock: Clock, cast: Cast): Promise<void> {
  const mine = await app.feedbackService.listMine({ userId: cast.camille.id });
  if (mine.length > 0) return;

  await clock.mark();
  const idea = await app.feedbackService.submit(
    {
      type: "idea",
      surface: "myRequests",
      pathname: "/listings/me",
      description:
        "Ce serait pratique de pouvoir dupliquer une ancienne demande en un clic : j'envoie souvent des cartons de Lyon à Paris avec les mêmes adresses.",
      screenshotUrls: [],
      locale: "fr",
    },
    { userId: cast.camille.id }
  );
  await clock.flush(at(-21, 22, 14));
  await app.feedbackService.triage(
    idea.id,
    { status: "RESOLVED", priority: "medium", devNote: "Livré en 2.75.0 : « Publier à nouveau » crée une copie en brouillon." },
    { userId: cast.admin.id, isAdmin: true }
  );
  const resolved = `'${stamp(at(-14, 11, 0))}'::timestamp`;
  await app.db.execute(
    sql.raw(`update feedback_tickets set resolved_at = ${resolved}, updated_at = ${resolved} where id = '${idea.id}'`)
  );

  await clock.mark();
  const bug = await app.feedbackService.submit(
    {
      type: "bug",
      surface: "earnings",
      pathname: "/carrier/withdrawals",
      description:
        "Sur mon téléphone, le montant de ma demande de retrait passe à la ligne et le bouton « Demander » se retrouve sous le pli de l'écran.",
      screenshotUrls: [],
      locale: "fr",
    },
    { userId: cast.julien.id }
  );
  await clock.flush(at(-2, 7, 55));
  await app.feedbackService.triage(
    bug.id,
    { status: "IN_PROGRESS", priority: "high", devNote: "Reproduit sur un écran de 360 px de large. Correctif en cours." },
    { userId: cast.admin.id, isAdmin: true }
  );

  await clock.mark();
  await app.feedbackService.submit(
    {
      type: "general",
      surface: "board",
      pathname: "/expedion",
      description: "Bravo pour la carte des courses : je repère en un coup d'œil ce qui se trouve sur ma tournée du jeudi.",
      screenshotUrls: [],
      locale: "fr",
    },
    { userId: cast.nadia.id }
  );
  await clock.flush(plus(NOW, -3 * 60));
}

// ========================================
// Last touches
// ========================================

/** What is old has been read; what happened in the last days is still waiting. */
async function settleReadState(app: App): Promise<void> {
  const statements = [
    `update conversations c set last_message_at = m.last, updated_at = m.last
       from (select conversation_id, max(created_at) as last from messages group by conversation_id) m
      where m.conversation_id = c.id`,
    `update notifications set is_read = true where created_at < localtimestamp - interval '30 hours'`,
    `update messages set is_read = true where created_at < localtimestamp - interval '30 hours'`,
    `update conversation_participants p set last_read_at = c.last_message_at
       from conversations c
      where c.id = p.conversation_id and c.last_message_at < localtimestamp - interval '30 hours'`,
    // Whoever wrote last has read their own thread.
    `update conversation_participants p set last_read_at = c.last_message_at
       from conversations c
      where c.id = p.conversation_id and p.user_id = (
        select sender_id from messages where conversation_id = c.id order by created_at desc limit 1)`,
    `update carriers c set completed_jobs = (
        select count(*) from shipments s where s.carrier_id = c.user_id and s.status = 'DELIVERED')`,
    `update "user" set updated_at = greatest(created_at, coalesce(last_login_at, created_at)) where email like '%@${DOMAIN}'`,
  ];
  for (const statement of statements) await app.db.execute(sql.raw(statement));
}

interface Showcase {
  buffet: StoryResult & { threadId?: string; otherThreadId?: string };
  transit: StoryResult & { threadId?: string };
  waiting: StoryResult;
  cancelled: StoryResult;
  reboarded: StoryResult;
  urgent: StoryResult;
  moving: StoryResult;
  lastDelivered: StoryResult;
  incident: StoryResult;
}

function printSummary(show: Showcase): void {
  const line = (label: string, path: string) => console.log(`  ${label.padEnd(34)} ${path}`);
  console.log("\nWhere to look");
  line("open request, 4 offers", `/listing/${show.buffet.listing.id}`);
  line("  its thread with Julien", `/messages/${show.buffet.threadId ?? "(run on a fresh database)"}`);
  line("  its thread with Nadia", `/messages/${show.buffet.otherThreadId ?? "(run on a fresh database)"}`);
  line("urgent request", `/listing/${show.urgent.listing.id}`);
  line("moving request", `/listing/${show.moving.listing.id}`);
  line("run in transit (client)", `/deliveries/${show.transit.shipment?.id}`);
  line("run in transit (driver)", `/driver/shipments/${show.transit.shipment?.id}`);
  line("  its thread, accepted offer", `/messages/${show.transit.threadId ?? "(run on a fresh database)"}`);
  line("run collected tomorrow", `/deliveries/${show.waiting.shipment?.id}`);
  line("latest delivery, both reviews", `/deliveries/${show.lastDelivered.shipment?.id}`);
  line("delivery with a resolved incident", `/deliveries/${show.incident.shipment?.id}`);
  line("cancelled, refunded, credit note", `/listing/${show.cancelled.listing.id}`);
  line("carrier came off, re-boarded", `/listing/${show.reboarded.listing.id}`);

  console.log(`\nSign in — password « ${PASSWORD} »`);
  for (const key of Object.keys(PEOPLE) as PersonKey[]) {
    const person: PersonSpec = PEOPLE[key];
    if (!person.signIn) continue;
    console.log(`  ${emailOf(person.key).padEnd(36)} ${person.first} ${person.last}`);
  }
}

// ========================================
// Main
// ========================================

async function ensureAuctionCategory(app: App): Promise<void> {
  // `resolveCategoryId` falls back to the `encheres` slug (seed-expedion-demo.ts).
  await app.db.execute(sql`
    insert into categories (id, name, slug, description)
    values ('encheres', 'Enchères (retrait)', 'encheres', 'Retraits en salle des ventes escaladés depuis Expedion Enchères.')
    on conflict do nothing
  `);
}

async function main() {
  console.log("EXPEDITOP — demo data seed");
  const url = resolveConnection();
  silenceTheOutsideWorld();
  await pinDatabaseToUtc(url);
  const app = await loadApp();
  const clock = new Clock(app);
  await clock.mark();

  const cast = await ensureCast(app);
  await ensureAuctionCategory(app);
  const fleet = await ensureFleet(app, cast, clock);
  await ensureAddresses(app, cast);
  await ensureRoutes(app, cast, fleet);

  // In the order the money moved, so receipt numbers climb with their dates.
  const delivered: StoryResult[] = [];
  for (const spec of DELIVERED.slice(0, 5)) delivered.push(await deliveredStory(app, clock, cast, fleet, spec));
  await paidWithdrawal(app, clock, cast);
  delivered.push(await deliveredStory(app, clock, cast, fleet, DELIVERED[5]));
  const cancelled = await cancelledStory(app, clock, cast, fleet);
  const reboarded = await reboardedStory(app, clock, cast, fleet);
  for (const spec of DELIVERED.slice(6, 8)) delivered.push(await deliveredStory(app, clock, cast, fleet, spec));
  await pendingWithdrawal(app, clock, cast);
  delivered.push(await deliveredStory(app, clock, cast, fleet, DELIVERED[8]));
  const transit = await inTransitStory(app, clock, cast, fleet);
  delivered.push(await deliveredStory(app, clock, cast, fleet, DELIVERED[9]));
  const waiting = await waitingStory(app, clock, cast, fleet);

  await othersStories(app, clock, cast, fleet);
  const board = await boardStories(app, clock, cast, fleet);
  await unpublishedStories(app, clock, cast);
  await expedionStories(app, clock, cast, fleet);
  await feedbackStories(app, clock, cast);
  await settleReadState(app);

  printSummary({
    buffet: board.buffet,
    transit,
    waiting,
    cancelled,
    reboarded,
    urgent: board.urgent,
    moving: board.moving,
    lastDelivered: delivered[delivered.length - 1],
    incident: delivered[5],
  });
  await breathe(1500);
  process.exit(0);
}

main().catch((error) => {
  console.error("\nSeed failed:", error);
  process.exit(1);
});
