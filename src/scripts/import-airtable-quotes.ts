/**
 * ============================================================================
 * One-time Airtable → Postgres import for Expedion quotes
 * ============================================================================
 *
 * Phase A of expedion_encheres/ROADMAP.md. Exit criterion: "every existing
 * quote is readable from Postgres and Airtable is read-only."
 *
 *   pnpm tsx src/scripts/import-airtable-quotes.ts            # dry run
 *   pnpm tsx src/scripts/import-airtable-quotes.ts --commit   # write
 *
 * Environment:
 *   AIRTABLE_PAT       Personal access token with read on the base
 *   AIRTABLE_BASE_ID   defaults to the production base
 *   AIRTABLE_TABLE     defaults to CONTACTS
 *   DATABASE_URL       standard Drizzle connection string
 *
 * Design notes:
 *
 *   - Dry run is the default. You have to ask for `--commit` to write, because
 *     the failure mode of accidentally half-importing a production base is
 *     much worse than the failure mode of running it twice.
 *   - Idempotent: `airtable_record_id` is unique and every row is upserted on
 *     it, so a re-run after a partial failure resumes instead of duplicating.
 *   - Non-lossy: every Airtable column that does not map onto a typed column
 *     is preserved verbatim in `airtable_fields`.
 *   - Verifies counts at the end and exits non-zero on a mismatch, so it can
 *     be trusted in a deploy script.
 */

import "dotenv/config";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { expedionQuotes, type InsertExpedionQuote } from "@/db/schema/expedion";
import { sql } from "drizzle-orm";

// ========================================
// Config
// ========================================

const AIRTABLE_PAT = process.env.AIRTABLE_PAT ?? "";
const BASE_ID = process.env.AIRTABLE_BASE_ID ?? "appu3jamyzCJRuOjr";
const TABLE = process.env.AIRTABLE_TABLE ?? "CONTACTS";
const COMMIT = process.argv.includes("--commit");
const PAGE_SIZE = 100;

// ========================================
// Field mapping
// ========================================
//
// Left: the French Airtable column. Right: our typed column. Anything absent
// here survives in `airtable_fields`.

const TEXT_FIELDS: Record<string, keyof InsertExpedionQuote> = {
  "Numéro Devis": "quoteNumber",
  "N°Bordereau": "bordereauNumber",
  Prénom: "firstName",
  Nom: "lastName",
  "E-mail": "email",
  Téléphone: "phone",
  "Adresse L1 client": "clientAddress",
  "Code postal client": "clientPostalCode",
  "Ville client": "clientCity",
  "Pays client": "clientCountry",
  "Nom de la maison de ventes": "auctionHouseName",
  "Adresse de retrait": "pickupAddress",
  "Code postal de retrait": "pickupPostalCode",
  "Ville de retrait": "pickupCity",
  "Téléphone de retrait": "pickupPhone",
  "Nom du destinataire": "recipientName",
  "Adresse de livraison": "deliveryAddress",
  "Code postal de livraison": "deliveryPostalCode",
  "Ville de livraison": "deliveryCity",
  "Pays de livraison": "deliveryCountry",
  "Téléphone de livraison": "deliveryPhone",
  "DESCRIPTION de l'objet": "description",
  "Tranche Montant de la marchandise": "valueBracket",
  Commentaire: "comment",
};

const NUMERIC_FIELDS: Record<string, keyof InsertExpedionQuote> = {
  Longueur: "lengthCm",
  Largeur: "widthCm",
  Hauteur: "heightCm",
  Poids: "weightKg",
};

/** Airtable stores these as euros; Postgres holds cents. */
const MONEY_FIELDS: Record<string, keyof InsertExpedionQuote> = {
  "Montant de la marchandise": "declaredValueCents",
  "Devis standard + (TVA ou pas)": "quoteStandardCents",
  "Devis+ass ADv (devis stnd+ass AD valorem)": "quoteInsuredCents",
  "Tarif Devis correspondant": "acceptedPriceCents",
};

const DATE_FIELDS: Record<string, keyof InsertExpedionQuote> = {
  "Date de vente": "saleDate",
  "Date demande devis": "requestedAt",
};

/** Columns consumed by the status derivation rather than copied across. */
const STATUS_FIELDS = new Set([
  "VALIDER DEVIS",
  "STATUT DU PAIEMENT",
  "PAIEMENT RECU",
  "Retrait fait",
  "livraison fait",
  "Devis disponible",
  "Type de Devis validé",
  "Statut du devis",
  "Bordereau acquitté ou pas",
  "Objet protégé ou emballé ?",
  "Record ID",
  "UID",
]);

// ========================================
// Coercion
// ========================================

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(Array.isArray(value) ? value[0] : value).trim();
  return s === "" || s === "null" ? null : s;
}

function num(value: unknown): number | null {
  const s = text(value);
  if (s === null) return null;
  // Airtable free-text often carries units and comma decimals: "120,5 cm".
  const cleaned = s.replace(",", ".").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function cents(value: unknown): number | null {
  const n = num(value);
  return n === null ? null : Math.round(n * 100);
}

function date(value: unknown): Date | null {
  const s = text(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function bool(value: unknown): boolean {
  const s = text(value);
  if (!s) return false;
  const l = s.toLowerCase();
  return l !== "false" && l !== "0" && l !== "non";
}

/**
 * Collapses Airtable's five independent status columns into the one ordered
 * enum. Order matters: the furthest-along signal wins, because a delivered job
 * necessarily was also paid and validated even if an earlier column went stale.
 */
function deriveStatus(f: Record<string, unknown>): {
  status: InsertExpedionQuote["status"];
  paymentStatus: InsertExpedionQuote["paymentStatus"];
} {
  const paid =
    bool(f["PAIEMENT RECU"]) ||
    (text(f["STATUT DU PAIEMENT"]) ?? "").toLowerCase().includes("reçu");

  let status: InsertExpedionQuote["status"] = "pending";
  if (bool(f["livraison fait"])) status = "delivered";
  else if (bool(f["Retrait fait"])) status = "picked_up";
  else if (paid) status = "paid";
  else if (text(f["Type de Devis validé"]) || bool(f["VALIDER DEVIS"]))
    status = "accepted";
  else if (bool(f["Devis disponible"])) status = "quoted";

  return { status, paymentStatus: paid ? "paid" : "unpaid" };
}

function mapRecord(record: {
  id: string;
  fields: Record<string, unknown>;
}): InsertExpedionQuote {
  const f = record.fields;
  const row: Record<string, unknown> = {
    id: nanoid(),
    airtableRecordId: record.id,
    // Airtable's `UID` is the Firebase UID the Flutter app already filters on.
    firebaseUid: text(f["UID"]) ?? `airtable:${record.id}`,
  };

  for (const [src, dest] of Object.entries(TEXT_FIELDS)) row[dest] = text(f[src]);
  for (const [src, dest] of Object.entries(NUMERIC_FIELDS)) row[dest] = num(f[src]);
  for (const [src, dest] of Object.entries(MONEY_FIELDS)) row[dest] = cents(f[src]);
  for (const [src, dest] of Object.entries(DATE_FIELDS)) {
    const d = date(f[src]);
    if (d) row[dest] = d;
  }

  row.bordereauPaid = bool(f["Bordereau acquitté ou pas"]);
  row.isProtected = bool(f["Objet protégé ou emballé ?"]);
  row.quoteAvailable = bool(f["Devis disponible"]);

  const kind = text(f["Type de Devis validé"]);
  if (kind) {
    row.acceptedKind = /ad ?valorem|assurance|ass/i.test(kind)
      ? "with_ad_valorem_insurance"
      : "standard";
  }

  Object.assign(row, deriveStatus(f));

  // Anything not mapped above is kept so the migration is reversible.
  const leftovers: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(f)) {
    const mapped =
      key in TEXT_FIELDS ||
      key in NUMERIC_FIELDS ||
      key in MONEY_FIELDS ||
      key in DATE_FIELDS ||
      STATUS_FIELDS.has(key);
    if (!mapped) leftovers[key] = value;
  }
  if (Object.keys(leftovers).length > 0) row.airtableFields = leftovers;

  return row as InsertExpedionQuote;
}

// ========================================
// Airtable fetch
// ========================================

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function fetchAllRecords(): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
    if (offset) params.set("offset", offset);

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(
      TABLE
    )}?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    });

    if (!res.ok) {
      throw new Error(
        `Airtable ${res.status} ${res.statusText}: ${await res.text()}`
      );
    }

    const page = (await res.json()) as {
      records: AirtableRecord[];
      offset?: string;
    };
    all.push(...page.records);
    offset = page.offset;
    process.stdout.write(`\r  fetched ${all.length} records…`);

    // Airtable allows 5 requests/second per base.
    if (offset) await new Promise((r) => setTimeout(r, 250));
  } while (offset);

  process.stdout.write("\n");
  return all;
}

// ========================================
// Main
// ========================================

async function main() {
  console.log("Expedion — Airtable → Postgres import");
  console.log(`  base   ${BASE_ID}`);
  console.log(`  table  ${TABLE}`);
  console.log(`  mode   ${COMMIT ? "COMMIT" : "DRY RUN (pass --commit to write)"}`);
  console.log("");

  if (!AIRTABLE_PAT) {
    console.error("AIRTABLE_PAT is not set — aborting.");
    process.exit(1);
  }

  const before = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(expedionQuotes)
    .then(([r]) => r.n);
  console.log(`Rows already in expedion_quotes: ${before}`);

  console.log("Fetching from Airtable…");
  const records = await fetchAllRecords();
  console.log(`Fetched ${records.length} Airtable records.`);

  const mapped: InsertExpedionQuote[] = [];
  const failures: { id: string; error: string }[] = [];

  for (const record of records) {
    try {
      mapped.push(mapRecord(record));
    } catch (error) {
      failures.push({
        id: record.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(`Mapped ${mapped.length}, failed to map ${failures.length}.`);
  for (const f of failures) console.error(`  ! ${f.id}: ${f.error}`);

  const withoutUid = mapped.filter((m) =>
    m.firebaseUid.startsWith("airtable:")
  ).length;
  if (withoutUid > 0) {
    console.warn(
      `  ${withoutUid} record(s) have no UID column; they are keyed by ` +
        `airtable:<recordId> and will not be visible to any signed-in client ` +
        `until reassigned.`
    );
  }

  if (!COMMIT) {
    console.log("\nDry run — nothing written. Sample of the first record:");
    console.dir(mapped[0], { depth: 3 });
    console.log(
      `\nWould upsert ${mapped.length} rows. Re-run with --commit to apply.`
    );
    process.exit(0);
  }

  console.log("\nWriting…");
  let written = 0;
  // Chunked so one oversized statement cannot blow the parameter limit.
  const CHUNK = 200;
  for (let i = 0; i < mapped.length; i += CHUNK) {
    const chunk = mapped.slice(i, i + CHUNK);
    await db
      .insert(expedionQuotes)
      .values(chunk)
      .onConflictDoUpdate({
        target: expedionQuotes.airtableRecordId,
        // `id` and `createdAt` are deliberately not overwritten: a re-run must
        // not renumber rows that other tables already reference.
        set: {
          firebaseUid: sql`excluded.firebase_uid`,
          quoteNumber: sql`excluded.quote_number`,
          bordereauNumber: sql`excluded.bordereau_number`,
          status: sql`excluded.status`,
          paymentStatus: sql`excluded.payment_status`,
          quoteStandardCents: sql`excluded.quote_standard_cents`,
          quoteInsuredCents: sql`excluded.quote_insured_cents`,
          acceptedPriceCents: sql`excluded.accepted_price_cents`,
          airtableFields: sql`excluded.airtable_fields`,
          updatedAt: new Date(),
        },
      });
    written += chunk.length;
    process.stdout.write(`\r  upserted ${written}/${mapped.length}…`);
  }
  process.stdout.write("\n");

  // ---- Verification ----
  const after = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(expedionQuotes)
    .then(([r]) => r.n);
  const imported = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(expedionQuotes)
    .where(sql`${expedionQuotes.airtableRecordId} is not null`)
    .then(([r]) => r.n);

  console.log("\nVerification");
  console.log(`  Airtable records fetched : ${records.length}`);
  console.log(`  Mapped successfully      : ${mapped.length}`);
  console.log(`  Rows with an airtable id : ${imported}`);
  console.log(`  Total rows before/after  : ${before} → ${after}`);

  if (imported !== records.length || failures.length > 0) {
    console.error(
      "\nFAIL — counts do not reconcile. Airtable must stay writable until " +
        "this is resolved."
    );
    process.exit(1);
  }

  console.log(
    "\nOK — every Airtable quote is readable from Postgres. " +
      "Airtable can now be set read-only."
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("\nImport failed:", error);
  process.exit(1);
});
