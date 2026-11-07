/**
 * ============================================================================
 * Airtable → private storage: the documents on every Expedion quote
 * ============================================================================
 *
 * `import-airtable-quotes.ts` copied the rows and left the files behind: on
 * 2026-11-07 production held 4,658 quotes, 4,656 of them from Airtable, and not
 * one `bordereau_doc_url`. This stores each attachment in the private Expedion
 * bucket, records it in `expedion_files` against its quote, and points
 * `bordereau_doc_url` at the first bordereau so the admin preview works.
 *
 *   pnpm tsx src/scripts/import-airtable-documents.ts                 # dry run
 *   pnpm tsx src/scripts/import-airtable-documents.ts --commit        # write
 *
 * Flags:
 *   --limit N            stop after N Airtable records (a trial)
 *   --max-minutes N      stop cleanly after N minutes; a re-run resumes
 *   --concurrency N      parallel downloads (default 4)
 *   --include-identity   also store « Piece d'Identité » (left out by default:
 *                        personal data nothing here needs)
 *
 * Environment: AIRTABLE_PAT, AIRTABLE_BASE_ID, AIRTABLE_TABLE, POSTGRES_URL,
 * and for --commit the R2 variables `expedionStorageService` reads.
 *
 * Idempotent: an attachment's object key is fixed by its Airtable ids, and one
 * already recorded in `expedion_files` is skipped. Insert-only: it never
 * overwrites a `bordereau_doc_url` that is already set, and never deletes.
 * A record with no quote in Postgres is reported, not created — run the quote
 * import first.
 */

import "dotenv/config";
import { nanoid } from "nanoid";
import { and, eq, isNull, like, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { expedionFiles, expedionQuotes } from "@/db/schema/expedion";
import { expedionStorageService } from "@/server/services/expedion-storage.service";
import { expedionFileUrl } from "@/lib/expedion-files";
import {
  ATTACHMENT_FIELDS,
  IDENTITY_FIELD,
  mimeFor,
  planDocuments,
  type PlannedDocument,
} from "@/lib/airtable-documents";

const PAT = process.env.AIRTABLE_PAT ?? "";
const BASE_ID = process.env.AIRTABLE_BASE_ID ?? "appu3jamyzCJRuOjr";
const TABLE = process.env.AIRTABLE_TABLE ?? "CONTACTS";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : Number(args[at + 1]);
};
const COMMIT = flag("commit");
const INCLUDE_IDENTITY = flag("include-identity");
const LIMIT = value("limit");
const DEADLINE = value("max-minutes")
  ? Date.now() + (value("max-minutes") as number) * 60_000
  : Infinity;
const CONCURRENCY = value("concurrency") ?? 4;

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function airtablePage(offset?: string) {
  const fields = [...Object.keys(ATTACHMENT_FIELDS), IDENTITY_FIELD];
  const query = [
    "pageSize=100",
    ...fields.map((name) => `fields%5B%5D=${encodeURIComponent(name)}`),
    ...(offset ? [`offset=${offset}`] : []),
  ].join("&");
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}?${query}`,
      { headers: { Authorization: `Bearer ${PAT}` } }
    );
    // 429: Airtable asks for 30 s of quiet.
    if (response.status === 429 && attempt < 5) {
      await sleep(30_000);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Airtable ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as { records: AirtableRecord[]; offset?: string };
  }
}

async function download(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= 3) throw error;
      await sleep(2_000 * attempt);
    }
  }
}

interface Task {
  recordId: string;
  quote: { id: string; firebaseUid: string; hasPrimary: boolean };
  doc: PlannedDocument;
}

const stats = {
  records: 0,
  withAttachments: 0,
  noQuote: 0,
  planned: 0,
  alreadyStored: 0,
  stored: 0,
  failed: 0,
  bytes: 0,
  byKind: {} as Record<string, number>,
  primarySet: 0,
};
const failures: string[] = [];

async function runPool(tasks: Task[], work: (task: Task) => Promise<void>) {
  const queue = [...tasks];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let task = queue.shift(); task; task = queue.shift()) {
        if (Date.now() > DEADLINE) return;
        await work(task);
      }
    })
  );
}

async function store(task: Task) {
  const { doc, quote } = task;
  const mime = mimeFor(doc.attachment);
  try {
    const bytes = await download(doc.attachment.url);
    await expedionStorageService.uploadAt(doc.objectKey, bytes, mime);
    const id = nanoid();
    await db.insert(expedionFiles).values({
      id,
      ownerUserId: quote.firebaseUid,
      quoteId: quote.id,
      kind: doc.kind,
      objectKey: doc.objectKey,
      mimeType: mime,
      sizeBytes: bytes.length,
    });
    if (doc.primary && doc.kind === "bordereau") {
      const updated = await db
        .update(expedionQuotes)
        .set({ bordereauDocUrl: expedionFileUrl(id) })
        .where(and(eq(expedionQuotes.id, quote.id), isNull(expedionQuotes.bordereauDocUrl)))
        .returning({ id: expedionQuotes.id });
      stats.primarySet += updated.length;
    }
    stats.stored += 1;
    stats.bytes += bytes.length;
  } catch (error) {
    stats.failed += 1;
    // Airtable record and attachment ids only: nothing a person typed.
    failures.push(`${task.recordId}/${doc.attachment.id}: ${(error as Error).message}`);
  }
}

async function main() {
  if (!PAT) throw new Error("AIRTABLE_PAT is not set");
  console.log(COMMIT ? "WRITING" : "DRY RUN (nothing is written; add --commit)");

  const quotes = new Map(
    (
      await db
        .select({
          id: expedionQuotes.id,
          airtableRecordId: expedionQuotes.airtableRecordId,
          firebaseUid: expedionQuotes.firebaseUid,
          bordereauDocUrl: expedionQuotes.bordereauDocUrl,
        })
        .from(expedionQuotes)
        .where(isNotNull(expedionQuotes.airtableRecordId))
    ).map((q) => [q.airtableRecordId as string, q])
  );
  const stored = new Set(
    (
      await db
        .select({ key: expedionFiles.objectKey })
        .from(expedionFiles)
        .where(like(expedionFiles.objectKey, "expedion/airtable/%"))
    ).map((row) => row.key)
  );
  console.log(`${quotes.size} quotes from Airtable in Postgres, ${stored.size} files already stored`);

  let offset: string | undefined;
  do {
    if (Date.now() > DEADLINE || (LIMIT && stats.records >= LIMIT)) break;
    const page = await airtablePage(offset);
    offset = page.offset;

    const tasks: Task[] = [];
    for (const record of page.records) {
      stats.records += 1;
      const plan = planDocuments(record.id, record.fields, { includeIdentity: INCLUDE_IDENTITY });
      if (plan.length === 0) continue;
      stats.withAttachments += 1;
      const quote = quotes.get(record.id);
      if (!quote) {
        stats.noQuote += 1;
        continue;
      }
      for (const doc of plan) {
        stats.planned += 1;
        stats.byKind[doc.kind] = (stats.byKind[doc.kind] ?? 0) + 1;
        if (stored.has(doc.objectKey)) {
          stats.alreadyStored += 1;
          continue;
        }
        if (!COMMIT) {
          stats.bytes += doc.attachment.size ?? 0;
          continue;
        }
        tasks.push({
          recordId: record.id,
          quote: { id: quote.id, firebaseUid: quote.firebaseUid, hasPrimary: Boolean(quote.bordereauDocUrl) },
          doc,
        });
      }
    }
    await runPool(tasks, store);
    console.log(
      `… ${stats.records} records, ${stats.stored} stored, ${stats.failed} failed`
    );
    await sleep(250); // Airtable allows 5 requests a second.
  } while (offset);

  console.log(JSON.stringify(stats, null, 2));
  if (failures.length) console.log("Failures (first 20):\n" + failures.slice(0, 20).join("\n"));
  if (Date.now() > DEADLINE) console.log("Stopped at --max-minutes; run again to resume.");
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
