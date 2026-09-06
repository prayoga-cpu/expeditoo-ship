/**
 * ============================================================================
 * CHANGELOG.md — the parser
 * ============================================================================
 *
 * `CHANGELOG.md` is the source of truth for releases. This module is the one
 * place that knows its shape, so the three consumers cannot drift apart:
 *
 *   - `scripts/sync-changelog.ts`  → upserts the file into the `releases` table
 *   - `scripts/check-changelog.ts` → the CI gate on AGENTS.md §8
 *   - `changelog.service.ts`       → what the public /changelog page reads
 *
 * Header format: `## [x.y.z] - YYYY-MM-DD · tag`, tag ∈ feat | fix | infra | ux.
 * Bullets are the `- ` lines beneath a header, up to the next header.
 *
 * Pure and filesystem-free on purpose — the parser is unit-tested against
 * strings, and only the callers touch disk.
 */

/** The four kinds of release. Every other module derives from this list rather
 *  than restating it — the same rule `userRoleEnum` lives under. */
export const RELEASE_TAGS = ["feat", "fix", "infra", "ux"] as const;

export type ReleaseTag = (typeof RELEASE_TAGS)[number];

export interface ParsedRelease {
  version: string;
  /** Date-only. The header carries no time, so this is midnight UTC. */
  releasedAt: Date;
  tag: ReleaseTag;
  entries: string[];
}

/**
 * `## [2.13.0] - 2026-08-26 · feat`
 *
 * The separator is a middle dot (U+00B7), not a hyphen, so it cannot be
 * confused with the one between version and date.
 */
export const CHANGELOG_HEADER =
  /^##\s+\[([^\]]+)\]\s+-\s+(\d{4}-\d{2}-\d{2})\s+·\s+(\w+)\s*$/;

const SEMVER = /^\d+\.\d+\.\d+$/;

function isReleaseTag(value: string): value is ReleaseTag {
  return (RELEASE_TAGS as readonly string[]).includes(value);
}

/**
 * Every release in the file, in the order it appears (newest first by
 * convention, though nothing here depends on that — `sortReleasesDesc` is what
 * imposes order).
 *
 * A malformed header is skipped rather than throwing: a half-written entry at
 * the top of the file must not take the build down with it. `check-changelog`
 * is where a malformed entry is reported, because that is the job it exists to
 * do.
 */
export function parseChangelog(markdown: string): ParsedRelease[] {
  const releases: ParsedRelease[] = [];
  let current: ParsedRelease | null = null;

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const header = CHANGELOG_HEADER.exec(line);

    if (header) {
      if (current) releases.push(current);

      const [, version, date, tag] = header;
      current = isReleaseTag(tag)
        ? {
            version: version.trim(),
            releasedAt: new Date(`${date}T00:00:00Z`),
            tag,
            entries: [],
          }
        : null;
      continue;
    }

    if (current && line.startsWith("- ")) {
      current.entries.push(line.slice(2).trim());
    }
  }

  if (current) releases.push(current);
  return releases;
}

/**
 * Newest first, comparing each segment numerically.
 *
 * A plain string sort puts 2.9.0 above 2.13.0, which is exactly the release a
 * reader most wants at the top. Date decides first — it is what a human reads —
 * and the version breaks ties, because several releases can share a day and a
 * date-only column leaves the database with nothing to order them by.
 */
export function compareVersionsDesc(a: string, b: string): number {
  const left = a.split(".");
  const right = b.split(".");

  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff =
      (Number.parseInt(right[i], 10) || 0) - (Number.parseInt(left[i], 10) || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function sortReleasesDesc<T extends { version: string; releasedAt: Date }>(
  releases: T[]
): T[] {
  return [...releases].sort(
    (a, b) =>
      b.releasedAt.getTime() - a.releasedAt.getTime() ||
      compareVersionsDesc(a.version, b.version)
  );
}

export interface ChangelogProblem {
  line: number;
  message: string;
}

/**
 * Everything wrong with the file, rather than the first thing wrong with it —
 * a gate that reports one problem per run costs a round trip per mistake.
 *
 * Checks the shape of the file itself. Agreement with `package.json` and
 * `src/lib/version.ts` is `check-changelog.ts`'s job, because only it knows
 * where those live.
 */
export function lintChangelog(markdown: string): ChangelogProblem[] {
  const problems: ChangelogProblem[] = [];
  const lines = markdown.split("\n");
  const seen = new Map<string, number>();
  let headers = 0;
  let currentHeaderLine = 0;
  let currentBullets = 0;

  const closeSection = () => {
    if (currentHeaderLine && currentBullets === 0) {
      problems.push({
        line: currentHeaderLine,
        message: "release has no `- ` bullets — an empty release tells a reader nothing",
      });
    }
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const lineNumber = index + 1;

    // A `## [` that the header pattern rejects is a typo, not prose. Reporting
    // it is the whole reason this linter exists: an unparsed header is silently
    // dropped by `parseChangelog`, so the release just never reaches the page.
    if (line.startsWith("## [") && !CHANGELOG_HEADER.test(line)) {
      problems.push({
        line: lineNumber,
        message: `malformed header ${JSON.stringify(line)} — expected "## [x.y.z] - YYYY-MM-DD · tag"`,
      });
      return;
    }

    const header = CHANGELOG_HEADER.exec(line);
    if (!header) {
      if (currentHeaderLine && line.startsWith("- ")) currentBullets += 1;
      return;
    }

    closeSection();
    headers += 1;
    currentHeaderLine = lineNumber;
    currentBullets = 0;

    const [, version, , tag] = header;

    if (!SEMVER.test(version)) {
      problems.push({
        line: lineNumber,
        message: `version "${version}" is not x.y.z`,
      });
    }

    if (!isReleaseTag(tag)) {
      problems.push({
        line: lineNumber,
        message: `tag "${tag}" is not one of ${RELEASE_TAGS.join(" | ")}`,
      });
    }

    const previous = seen.get(version);
    if (previous) {
      problems.push({
        line: lineNumber,
        message: `version ${version} already appears on line ${previous} — the sync upserts by version, so the second entry would overwrite the first`,
      });
    } else {
      seen.set(version, lineNumber);
    }
  });

  closeSection();

  if (headers === 0) {
    problems.push({ line: 1, message: "no releases found — is this CHANGELOG.md?" });
  }

  return problems;
}

/** The release a reader lands on, and the one `APP_VERSION` must equal. */
export function latestRelease(markdown: string): ParsedRelease | null {
  return sortReleasesDesc(parseChangelog(markdown))[0] ?? null;
}
