/**
 * ============================================================================
 * Expedion → Expeditoo escalation demo seed
 * ============================================================================
 *
 * The escalation bridge is mechanically sound but starved: nothing calls
 * `expedionService.markPaid` (the only writer of `escalateAfter`), so the cron
 * sweep never finds a due quote. This seed manufactures the exact state the
 * sweep looks for — one paid, unassigned quote whose escalation clock has
 * already expired — so the very next run of
 * `GET /api/cron/expedion-escalate` turns it into a live marketplace listing.
 *
 *   npx tsx src/scripts/seed-expedion-demo.ts
 *
 * Idempotent: fixed ids throughout. Re-running resets the demo quote back to
 * "paid, due now", ready to escalate again. If a previous run already
 * escalated it, the old listing is left in place and its id is printed.
 *
 * Environment (read from .env.local, falling back to .env):
 *   POSTGRES_URL              standard Drizzle connection string
 *   EXPEDION_SYSTEM_USER_ID   must equal SYSTEM_USER_ID below
 *   EXPEDION_CATEGORY_ID      must equal the printed category id
 *
 * `@/db` reads POSTGRES_URL at module scope and only loads `.env` on its own,
 * so this script configures dotenv first and imports the database lazily.
 */

import { config } from "dotenv";
import { nanoid } from "nanoid";
import { and, eq, sql } from "drizzle-orm";
import { user, userRoles } from "@/db/schema/users";
import { categories } from "@/db/schema/listings";
import { expedionQuotes, type InsertExpedionQuote } from "@/db/schema/expedion";

config({ path: [".env.local", ".env"] });

type Db = (typeof import("@/db"))["db"];
type ExpedionDal =
  (typeof import("@/server/dal/expedion.dal"))["expedionDal"];

// ========================================
// Fixed identities
// ========================================
//
// Everything is keyed on stable ids so re-runs update instead of duplicating.

// TODO(EXPEDITOO-TESTING): fake platform shipper account (no credentials, no
// Better Auth account row) owns every escalated listing — in production create
// a real platform-owned account and point EXPEDION_SYSTEM_USER_ID at it.
const SYSTEM_USER_ID = "expedion_system_shipper";
const SYSTEM_USER_EMAIL = "expedion-system@expeditoo.test";
const SYSTEM_USER_NAME = "Expedion Enchères (système)";

const CATEGORY_ID = "encheres";
const CATEGORY_SLUG = "encheres";

const QUOTE_ID = "expedion_demo_quote_001";
const DEMO_FIREBASE_UID = "expedion-demo-client";

// ========================================
// The demo quote
// ========================================
//
// Route and lot data are realistic (Drouot → Lyon Presqu'île, five-digit
// postal codes, coordinates present) so `escalationBlockers` finds nothing
// and the listing contract is satisfiable.

// TODO(EXPEDITOO-TESTING): fabricated demo quote — real quotes arrive from the
// Expedion Flutter app via POST /api/expedion/quotes and reach status "paid"
// through a payment webhook calling expedionService.markPaid (that wiring does
// not exist yet). Delete this row before production.
function demoQuote(now: Date): InsertExpedionQuote {
  return {
    id: QUOTE_ID,
    firebaseUid: DEMO_FIREBASE_UID,
    quoteNumber: "DEMO-DEVIS-001",
    bordereauNumber: "DEMO-BORD-2026-001",
    firstName: "Démo",
    lastName: "Expedion",
    email: "demo-client@expeditoo.test",
    phone: null, // no phone: the escalation SMS is skipped, not sent to anyone
    description:
      "DEMO — Commode Louis-Philippe en noyer, lot 42. " +
      "Donnée factice pour la démonstration de l'escalade Expedion → Expeditoo.",
    auctionHouseName: "Hôtel Drouot (DEMO)",
    pickupAddress: "9 Rue Drouot",
    pickupPostalCode: "75009",
    pickupCity: "Paris",
    pickupLat: 48.8734,
    pickupLng: 2.3405,
    recipientName: "Client Démo",
    deliveryAddress: "24 Rue de la République",
    deliveryPostalCode: "69002",
    deliveryCity: "Lyon",
    deliveryCountry: "France",
    deliveryLat: 45.764,
    deliveryLng: 4.8357,
    lengthCm: 120,
    widthCm: 55,
    heightCm: 90,
    weightKg: 45,
    isProtected: false,
    declaredValueCents: 180000,
    quoteStandardCents: 24900,
    quoteInsuredCents: 27400,
    acceptedKind: "standard",
    acceptedPriceCents: 24900,
    quoteAvailable: true,
    status: "paid",
    paymentStatus: "paid",
    // TODO(EXPEDITOO-TESTING): escalateAfter is forced to NOW so the next cron
    // sweep escalates immediately — in the real flow markPaid stamps
    // now + EXPEDION_ESCALATE_AFTER_HOURS when the payment webhook fires.
    escalateAfter: now,
  };
}

// ========================================
// Seed steps
// ========================================

/**
 * The escalation demo needs the transport schema (`expedion_quotes`, the
 * seven-role `user_role` enum). A database still on the v1 goods-marketplace
 * schema fails here with instructions instead of a cryptic enum error later.
 */
async function assertTransportSchema(db: Db): Promise<void> {
  const rows = (await db.execute(sql`
    select
      (to_regclass('public.expedion_quotes') is not null) as ok_quotes,
      exists (
        select 1 from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        where t.typname = 'user_role' and e.enumlabel = 'shipper'
      ) as ok_roles
  `)) as unknown as Array<{ ok_quotes: boolean; ok_roles: boolean }>;

  const row = rows[0];
  if (row?.ok_quotes && row?.ok_roles) return;

  console.error(
    "\nThis database does not carry the transport schema:" +
      `\n  expedion_quotes table present : ${row?.ok_quotes ? "yes" : "NO"}` +
      `\n  user_role enum has 'shipper'  : ${row?.ok_roles ? "yes" : "NO"}` +
      "\n\nPOSTGRES_URL points at a pre-pivot v1 database. The repo's clean " +
      "initial migration (src/db/migrations/0000_*.sql) only applies to a " +
      "fresh database — it conflicts with the old user_role enum and the old " +
      "listings shape.\nPoint POSTGRES_URL at a fresh database, run " +
      "`pnpm db:migrate`, then re-run this seed."
  );
  process.exit(1);
}

async function ensureSystemShipper(db: Db): Promise<string> {
  await db
    .insert(user)
    .values({
      id: SYSTEM_USER_ID,
      name: SYSTEM_USER_NAME,
      email: SYSTEM_USER_EMAIL,
      emailVerified: true,
      isVerified: true,
    })
    .onConflictDoNothing();

  const row = await db.query.user.findFirst({
    where: eq(user.email, SYSTEM_USER_EMAIL),
  });
  if (!row) throw new Error("system shipper upsert failed");

  const hasRole = await db.query.userRoles.findFirst({
    where: and(eq(userRoles.userId, row.id), eq(userRoles.role, "shipper")),
  });
  if (!hasRole) {
    await db
      .insert(userRoles)
      .values({ id: nanoid(), userId: row.id, role: "shipper" });
  }
  return row.id;
}

/**
 * `resolveCategoryId` in the escalation service falls back to the `encheres`
 * slug when EXPEDION_CATEGORY_ID is unset, so that is the slug seeded here.
 */
async function ensureCategory(db: Db): Promise<string> {
  await db
    .insert(categories)
    .values({
      id: CATEGORY_ID,
      name: "Enchères (retrait)",
      slug: CATEGORY_SLUG,
      description:
        "Retraits en salle des ventes escaladés depuis Expedion Enchères.",
    })
    .onConflictDoNothing();

  const row = await db.query.categories.findFirst({
    where: eq(categories.slug, CATEGORY_SLUG),
  });
  if (!row) throw new Error("category upsert failed");
  return row.id;
}

/** Creates the demo quote, or resets it back to "paid, due for escalation". */
async function resetDemoQuote(
  db: Db,
  expedionDal: ExpedionDal
): Promise<{ previousListingId: string | null }> {
  const now = new Date();
  const existing = await db.query.expedionQuotes.findFirst({
    where: eq(expedionQuotes.id, QUOTE_ID),
  });
  const previousListingId = existing?.listingId ?? null;

  const values = demoQuote(now);
  await db
    .insert(expedionQuotes)
    .values(values)
    .onConflictDoUpdate({
      target: expedionQuotes.id,
      set: {
        ...values,
        // Clear every escalation artefact so the sweep sees a fresh claim.
        escalatedAt: null,
        listingId: null,
        assignedCarrierId: null,
        assignedAt: null,
        updatedAt: now,
      },
    });

  await expedionDal.addEvent({
    id: nanoid(),
    quoteId: QUOTE_ID,
    status: "paid",
    actor: "system",
    message: "Paiement reçu (démo — seed-expedion-demo)",
    metadata: { demo: true, escalateAfter: now.toISOString() },
  });

  return { previousListingId };
}

// ========================================
// Crib sheet
// ========================================

function printCrib(): void {
  const base = "http://localhost:3000";
  const cron = process.env.CRON_SECRET ?? "<CRON_SECRET>";
  const admin = process.env.EXPEDION_ADMIN_API_KEY ?? "<EXPEDION_ADMIN_API_KEY>";
  const client = process.env.EXPEDION_API_KEY ?? "<EXPEDION_API_KEY>";

  console.log("\nCopy-paste crib (dev server must be running: pnpm dev)");
  console.log("\n# 1. Trigger the escalation sweep (what Vercel runs every 10 min):");
  console.log(
    `curl -s "${base}/api/cron/expedion-escalate" -H "Authorization: Bearer ${cron}"`
  );
  console.log("\n# 2. Force-escalate the demo quote now (admin key, skips the timer):");
  console.log(
    `curl -s -X POST "${base}/api/expedion/quotes/${QUOTE_ID}/escalate" \\\n` +
      `  -H "Authorization: Bearer ${admin}" -H "x-expedion-uid: demo-admin"`
  );
  console.log("\n# 3. Watch the quote's status feed (what the Expedion client sees):");
  console.log(
    `curl -s "${base}/api/expedion/quotes/${QUOTE_ID}/events" \\\n` +
      `  -H "Authorization: Bearer ${client}" -H "x-expedion-uid: ${DEMO_FIREBASE_UID}"`
  );
  console.log(
    "\nAfter the sweep, the quote is status=escalated and a listing with " +
      "origin=expedion, externalRef=" + QUOTE_ID + " is live on the job board." +
      "\nRe-run this seed to reset the quote and demo it again."
  );
}

// ========================================
// Main
// ========================================

async function main() {
  console.log("Expedion — escalation demo seed");

  // Imported lazily so dotenv above runs before `@/db` reads POSTGRES_URL.
  const { db } = await import("@/db");
  const { expedionDal } = await import("@/server/dal/expedion.dal");

  await assertTransportSchema(db);

  const userId = await ensureSystemShipper(db);
  console.log(`  system shipper  ${userId}  (${SYSTEM_USER_EMAIL})`);
  if (process.env.EXPEDION_SYSTEM_USER_ID !== userId) {
    console.warn(
      `  ! EXPEDION_SYSTEM_USER_ID is "${process.env.EXPEDION_SYSTEM_USER_ID}" ` +
        `— set it to "${userId}" or escalation will 503/misattribute.`
    );
  }

  const categoryId = await ensureCategory(db);
  console.log(`  category        ${categoryId}  (slug: ${CATEGORY_SLUG})`);
  if (
    process.env.EXPEDION_CATEGORY_ID &&
    process.env.EXPEDION_CATEGORY_ID !== categoryId
  ) {
    console.warn(
      `  ! EXPEDION_CATEGORY_ID is "${process.env.EXPEDION_CATEGORY_ID}" ` +
        `— set it to "${categoryId}" to match the seeded category.`
    );
  }

  const { previousListingId } = await resetDemoQuote(db, expedionDal);
  console.log(
    `  demo quote      ${QUOTE_ID}  (status=paid, escalateAfter=now, ` +
      `uid=${DEMO_FIREBASE_UID})`
  );
  if (previousListingId) {
    console.log(
      `  note: a previous run already escalated this quote into listing ` +
        `${previousListingId}; that listing was left untouched.`
    );
  }

  printCrib();
  process.exit(0);
}

main().catch((error) => {
  console.error("\nSeed failed:", error);
  process.exit(1);
});
