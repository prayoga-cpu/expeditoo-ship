/**
 * Does the bucket THIS process writes to hold the files the database points at?
 *
 *   pnpm tsx src/scripts/verify-expedion-files.ts
 *
 * Read-only. Prints a fingerprint (sha256 prefix) of the R2 account id and the
 * bucket name — never the values — so a CI run can be compared with the
 * deployment, and HEADs a sample of three kinds of object:
 *   - files the Airtable import stored,
 *   - files a person uploaded through the app (known to work in production),
 *   - the first slip of the first few quotes.
 * If the app's own uploads are found and the import's are not, CI wrote to a
 * different bucket than the deployment reads.
 */

import "dotenv/config";
import { createHash } from "node:crypto";
import { like, notLike, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { expedionFiles } from "@/db/schema/expedion";
import { expedionStorageService } from "@/server/services/expedion-storage.service";

const fingerprint = (value: string | undefined) =>
  value ? createHash("sha256").update(value).digest("hex").slice(0, 12) : "(unset)";

async function sample(label: string, where: ReturnType<typeof and>, limit: number) {
  const rows = await db
    .select({ id: expedionFiles.id, key: expedionFiles.objectKey })
    .from(expedionFiles)
    .where(where)
    .orderBy(desc(expedionFiles.createdAt))
    .limit(limit);
  let found = 0;
  for (const row of rows) if (await expedionStorageService.exists(row.key)) found += 1;
  console.log(`${label}: ${found} of ${rows.length} found`);
}

async function main() {
  console.log("R2 account  sha256:", fingerprint(process.env.R2_ACCOUNT_ID));
  console.log(
    "R2 bucket   sha256:",
    fingerprint(process.env.R2_EXPEDION_BUCKET_NAME ?? process.env.R2_KYC_BUCKET_NAME),
    process.env.R2_EXPEDION_BUCKET_NAME ? "(R2_EXPEDION_BUCKET_NAME)" : "(fell back to R2_KYC_BUCKET_NAME)"
  );
  await sample("airtable import", and(like(expedionFiles.objectKey, "expedion/airtable/%"))!, 10);
  await sample("uploaded by the app", and(notLike(expedionFiles.objectKey, "expedion/airtable/%"))!, 10);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
