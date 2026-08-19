/**
 * ============================================================================
 * Development sign-in accounts
 * ============================================================================
 *
 *   pnpm db:seed:dev-users
 *
 * The mirror wipes every password hash it copies (they belong to real people
 * and scrypt hashes are crackable), so a freshly mirrored database has no way
 * in. This puts back one known account per role.
 *
 * Hashing goes through Better Auth's own `hashPassword`, so the credentials
 * are indistinguishable from ones created by the signup form — no fabricated
 * hash that works today and breaks the next time the hasher changes.
 *
 * Idempotent: keyed on email, so re-running resets the password rather than
 * minting duplicates.
 *
 * Also unlocks any account listed in `MIRROR_KEEP_EMAILS` — the accounts
 * `scripts/db-mirror.sh` deliberately left with their real name, email and
 * role intact (see `scripts/sql/anonymize.sql`). Those still lose their
 * password like everyone else, so `pnpm db:mirror` runs this script as its
 * last step. Unlike `DEV_USERS`, a kept account's name and roles are never
 * touched here — they came from production and are left alone.
 *
 * Environment:
 *   POSTGRES_URL        must be a development database — this refuses otherwise
 *   DEV_USER_PASSWORD   overrides the default password below
 *   MIRROR_KEEP_EMAILS  comma-separated emails to unlock without renaming
 */

import "@/lib/load-env";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { assertDevelopmentDatabase } from "@/lib/db-target";
import { account, user, userRoleEnum, userRoles } from "@/db/schema/users";

/** Derived from the enum, never restated — see CLAUDE.md gotcha 8. */
type Role = (typeof userRoleEnum.enumValues)[number];

const DEFAULT_PASSWORD = process.env.DEV_USER_PASSWORD ?? "devpassword123";

/**
 * One account per role a developer actually needs to be. `shipper` is absent
 * on purpose: it belongs to the Expedion system account, which the seed for
 * the escalation demo owns.
 */
const DEV_USERS: ReadonlyArray<{
  email: string;
  name: string;
  roles: Role[];
}> = [
  { email: "admin@dev.local", name: "Dev Admin", roles: ["admin"] },
  { email: "operator@dev.local", name: "Dev Operator", roles: ["operator"] },
  { email: "carrier@dev.local", name: "Dev Carrier", roles: ["carrier"] },
  { email: "driver@dev.local", name: "Dev Driver", roles: ["driver"] },
  { email: "support@dev.local", name: "Dev Support", roles: ["support"] },
  { email: "finance@dev.local", name: "Dev Finance", roles: ["finance"] },
];

type Db = (typeof import("@/db"))["db"];

/**
 * Better Auth looks up email/password credentials by providerId "credential"
 * with accountId set to the user id. Anything else here and sign-in silently
 * falls through to "invalid credentials".
 */
async function setCredentialPassword(
  db: Db,
  userId: string,
  passwordHash: string
): Promise<void> {
  const credential = await db.query.account.findFirst({
    where: eq(account.userId, userId),
  });

  if (credential) {
    await db
      .update(account)
      .set({ password: passwordHash })
      .where(eq(account.id, credential.id));
  } else {
    await db.insert(account).values({
      id: nanoid(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
  }
}

function keepEmailsFromEnv(): string[] {
  return (process.env.MIRROR_KEEP_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL environment variable is required");
  }

  const target = assertDevelopmentDatabase(
    connectionString,
    "seed development sign-in accounts"
  );

  const { db } = await import("@/db");
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  for (const spec of DEV_USERS) {
    const existing = await db.query.user.findFirst({
      where: eq(user.email, spec.email),
    });

    const userId = existing?.id ?? nanoid();

    if (existing) {
      await db
        .update(user)
        .set({ name: spec.name, emailVerified: true, banned: false })
        .where(eq(user.id, userId));
    } else {
      await db.insert(user).values({
        id: userId,
        name: spec.name,
        email: spec.email,
        emailVerified: true,
      });
    }

    await setCredentialPassword(db, userId, passwordHash);

    for (const role of spec.roles) {
      await db
        .insert(userRoles)
        .values({ id: nanoid(), userId, role })
        .onConflictDoNothing();
    }

    console.log(`  ${spec.email.padEnd(28)} ${spec.roles.join(", ")}`);
  }

  console.log(`\n✅ Seeded ${DEV_USERS.length} accounts in ${target.label}`);
  console.log(`   Password: ${DEFAULT_PASSWORD}`);

  const keepEmails = keepEmailsFromEnv();
  if (keepEmails.length > 0) {
    console.log(`\nUnlocking ${keepEmails.length} mirrored account(s)…`);

    for (const email of keepEmails) {
      const existing = await db.query.user.findFirst({
        where: eq(user.email, email),
      });

      if (!existing) {
        console.log(`  ${email.padEnd(28)} not found — nothing to unlock`);
        continue;
      }

      await setCredentialPassword(db, existing.id, passwordHash);
      console.log(`  ${email.padEnd(28)} unlocked (name/role kept from the mirror)`);
    }

    console.log(`   Password: ${DEFAULT_PASSWORD}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
