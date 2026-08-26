/**
 * ============================================================================
 * Give the dev carrier an approved profile and a vehicle
 * ============================================================================
 *
 *   pnpm db:seed:approved-carrier
 *
 * Why this exists
 * ---------------
 *
 * `db:seed:dev-users` creates carrier@dev.local and grants it the `carrier`
 * role, and that is where it stops. The role is not what gates the product:
 * every step past browsing the board — submitting an offer, seeing it in
 * /carrier/offers, having it accepted, executing the shipment, uploading proof
 * of delivery — is gated on an **approved `carriers` row**, and nothing in this
 * repository could produce one.
 *
 * The practical effect was that a fresh database could demonstrate the job
 * board and nothing beyond it, while the code for everything beyond it was
 * finished and passing its tests. That is a bad way to find out five minutes
 * into a demo.
 *
 * An offer also names the vehicle that will do the job, so an approved carrier
 * with no vehicle is still a dead end. Both are seeded here.
 *
 * Safe to re-run: every write is an upsert keyed on a fixed id, and an existing
 * row is moved to `approved` rather than duplicated.
 */

import "dotenv/config";
import { db } from "@/db";
import { carriers, vehicles } from "@/db/schema/carriers";
import { user } from "@/db/schema/users";
import { eq } from "drizzle-orm";

/** Fixed ids so re-running updates rather than accumulating. */
const CARRIER_ID = "dev_carrier_profile";
const VEHICLE_ID = "dev_carrier_vehicle";
const CARRIER_EMAIL = "carrier@dev.local";

async function main() {
  const account = await db.query.user.findFirst({
    where: eq(user.email, CARRIER_EMAIL),
  });

  if (!account) {
    console.error(
      `No account for ${CARRIER_EMAIL}. Run \`pnpm db:seed:dev-users\` first — ` +
        `this script approves that carrier, it does not create the user.`
    );
    process.exit(1);
  }

  await db
    .insert(carriers)
    .values({
      id: CARRIER_ID,
      userId: account.id,
      companyName: "Transports Dev",
      // A syntactically valid SIRET. Unique, so it is fixed rather than random.
      siret: "80295478500018",
      legalForm: "auto-entrepreneur",
      contactPhone: "+33600000001",
      addressLine: "12 rue de la Demo",
      city: "Lyon",
      postalCode: "69003",
      status: "approved",
      approvedAt: new Date(),
      // Deliberately not `approvedBy`: no admin actually reviewed this, and
      // pointing it at one would put a fiction in the review trail.
      ibanLast4: "0000",
      bio: "Seeded carrier for local demos.",
    })
    .onConflictDoUpdate({
      target: carriers.userId,
      set: { status: "approved", approvedAt: new Date() },
    });

  const profile = await db.query.carriers.findFirst({
    where: eq(carriers.userId, account.id),
  });
  if (!profile) throw new Error("carrier upsert did not return a row");

  await db
    .insert(vehicles)
    .values({
      id: VEHICLE_ID,
      carrierId: profile.id,
      type: "van",
      make: "Renault",
      model: "Master",
      year: 2022,
      plateNumber: "AA-000-AA",
      maxWeightKg: 1200,
      maxLengthCm: 340,
      maxWidthCm: 180,
      maxHeightCm: 190,
      isActive: true,
    })
    .onConflictDoNothing();

  console.log(`Approved carrier ready: ${CARRIER_EMAIL}`);
  console.log(`  carriers.id   ${profile.id}  status=${profile.status}`);
  console.log(`  vehicle       van · AA-000-AA · 1200 kg`);
  console.log("");
  console.log("That account can now bid, be awarded, and execute a shipment.");
  process.exit(0);
}

main().catch((error) => {
  console.error("\nSeed failed:", error);
  process.exit(1);
});
