/**
 * Repairs the document links the Airtable import wrote.
 *
 * `import-airtable-documents.ts` ran in CI with no `NEXT_PUBLIC_APP_URL`, so
 * every `bordereau_doc_url` it set reads `http://localhost:3000/api/expedion/
 * files/<id>` — a link that opens the reader's own machine. And a quote whose
 * only slip sat in Airtable's « BORDEREAU 2 » column got no link at all.
 *
 *   pnpm tsx src/scripts/repair-expedion-file-urls.ts            # counts only
 *   pnpm tsx src/scripts/repair-expedion-file-urls.ts --commit   # write
 *
 * Needs `NEXT_PUBLIC_APP_URL` (the real https origin). Idempotent: it touches
 * only rows still on a localhost host, and only quotes with no link yet.
 */

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/db";

const COMMIT = process.argv.includes("--commit");
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

async function main() {
  if (!/^https:\/\/[^/]+$/i.test(APP_URL) || /localhost|127\.0\.0\.1/.test(APP_URL)) {
    throw new Error(`NEXT_PUBLIC_APP_URL must be the real https origin, got "${APP_URL}"`);
  }
  console.log(COMMIT ? `WRITING (origin ${APP_URL})` : "DRY RUN (add --commit)");

  const host = sql`bordereau_doc_url ~ '^https?://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?/api/expedion/files/'`;
  const unlinked = sql`bordereau_doc_url is null and exists (
    select 1 from expedion_files f where f.quote_id = expedion_quotes.id and f.kind = 'bordereau')`;

  const count = async (where: ReturnType<typeof sql>) =>
    Number(
      [...(await db.execute<{ n: number }>(sql`select count(*)::int as n from expedion_quotes where ${where}`))][0].n
    );
  console.log(`links on a localhost host: ${await count(host)}`);
  console.log(`quotes with a bordereau file and no link: ${await count(unlinked)}`);
  if (!COMMIT) return;

  const moved = await db.execute(sql`
    update expedion_quotes
    set bordereau_doc_url = ${APP_URL} || substring(bordereau_doc_url from '/api/expedion/files/.*')
    where ${host}
    returning id`);
  const linked = await db.execute(sql`
    update expedion_quotes q
    set bordereau_doc_url = ${APP_URL} || '/api/expedion/files/' || (
      select f.id from expedion_files f
      where f.quote_id = q.id and f.kind = 'bordereau'
      order by f.created_at, f.id limit 1)
    where q.bordereau_doc_url is null and exists (
      select 1 from expedion_files f where f.quote_id = q.id and f.kind = 'bordereau')
    returning q.id`);
  console.log(`re-hosted: ${[...moved].length}, newly linked: ${[...linked].length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
