import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  latestRelease,
  parseChangelog,
  sortReleasesDesc,
  type ReleaseTag,
} from "@/lib/changelog";

/**
 * ============================================================================
 * The public release history
 * ============================================================================
 *
 * `CHANGELOG.md` in the repo root is the source of truth (AGENTS.md §8). This
 * service reads it and nothing else.
 *
 * **There is deliberately no DAL and no table here.** The sibling Epidom repo
 * syncs its changelog into a `releases` table on every build, because it feeds
 * an in-app "what's new" bell with per-user read state. This product has no
 * such surface, and copying the table would have cost a migration, a sync
 * script in the build, and a new way for the page to disagree with the repo —
 * to serve a file that is already in the deployment. It would also have been
 * dead weight of exactly the kind this codebase has been burned by before
 * (`invoicesService.createFromPayment` shipped called from nowhere and no
 * invoice was ever created). When a "what's new" surface is actually built,
 * this is the one function it reads through, and the table can arrive then.
 *
 * The two callers — `/changelog` and `GET /api/public/changelog` — are both
 * statically rendered, so the file read happens at **build** time and never on
 * a request. That is also what keeps it correct on a serverless host, where
 * `CHANGELOG.md` is not otherwise guaranteed to be traced into the bundle.
 *
 * There is no permission check because there is nothing to protect: this is
 * published product news, and the route is the reason `(marketing)` exists.
 */

export interface ReleaseDTO {
  version: string;
  /** ISO string — the DTO crosses to a client component, where a `Date` cannot. */
  releasedAt: string;
  tag: ReleaseTag;
  entries: string[];
}

/**
 * Read once per process. The file cannot change under a running build, and the
 * page is prerendered, so re-reading it per call buys nothing.
 */
let cache: ReleaseDTO[] | null = null;

function read(): string {
  return readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");
}

export const changelogService = {
  /**
   * Every release, newest first.
   *
   * Ordering is the service's job rather than the file's: the headers are
   * newest-first by convention, but a rebase can interleave two sessions'
   * entries, and a date-only header leaves same-day releases with nothing to
   * separate them. `sortReleasesDesc` breaks that tie on the version number,
   * which is the real release sequence.
   */
  getReleases(): ReleaseDTO[] {
    if (cache) return cache;

    cache = sortReleasesDesc(parseChangelog(read())).map((release) => ({
      version: release.version,
      releasedAt: release.releasedAt.toISOString(),
      tag: release.tag,
      entries: release.entries,
    }));

    return cache;
  },

  /** The version a visitor is looking at. Null only if the file has no releases. */
  getCurrentVersion(): string | null {
    return latestRelease(read())?.version ?? null;
  },
};
