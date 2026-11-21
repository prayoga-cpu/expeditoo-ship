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
  /** The sentence(s) between the header and the first bullet; "" when none. */
  summary: string;
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
  // True while the last line read belongs to the current bullet, so that an
  // indented line is its continuation. A blank line ends the bullet.
  let inBullet = false;

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
            summary: "",
            entries: [],
          }
        : null;
      inBullet = false;
      continue;
    }

    if (!current) continue;

    if (line.startsWith("- ")) {
      current.entries.push(line.slice(2).trim());
      inBullet = true;
    } else if (inBullet && /^\s+\S/.test(line)) {
      // A bullet is wrapped at ~80 columns with its continuation indented. The
      // parser used to read the first line only, so the public page cut every
      // bullet off mid-sentence.
      current.entries[current.entries.length - 1] += ` ${line.trim()}`;
    } else if (line.trim() === "") {
      inBullet = false;
    } else if (current.entries.length === 0 && !inBullet) {
      current.summary = `${current.summary} ${line.trim()}`.trim();
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

/**
 * ============================================================================
 * CHANGELOG.fr.md — the French twin
 * ============================================================================
 *
 * `CHANGELOG.md` is written in English and stays the source of truth.
 * `CHANGELOG.fr.md` carries the same releases in French, and `/changelog` shows
 * it to a French reader. They are held in lockstep the way `messages/fr.json`
 * is held to `en.json`: a release in one and not the other is a gate failure,
 * not a page that quietly shows English to a French visitor.
 */

// Words that mark a sentence as still English. Deliberately common ones — a
// French bullet that is mostly these has not been translated.
const ENGLISH_MARKERS = /\b(the|and|your|you|is|are|was|were|with|for|that|this|from|now|instead|when|where|which|its)\b/gi;
const FRENCH_MARKERS = /\b(le|la|les|un|une|des|du|de|et|à|au|aux|pour|vous|votre|vos|est|sont|sur|dans|avec|qui|que|ne|pas|plus|ce|cette|en)\b/gi;

function looksEnglish(text: string): boolean {
  // « quoted UI copy » and `code` are the same in both languages.
  const prose = text.replace(/«[^»]*»/g, " ").replace(/`[^`]*`/g, " ");
  const english = prose.match(ENGLISH_MARKERS)?.length ?? 0;
  const french = prose.match(FRENCH_MARKERS)?.length ?? 0;
  return english >= 3 && english > french;
}

/**
 * Everything wrong with the French file measured against the English one.
 *
 * Structure is what a script can prove: same releases, same dates and tags,
 * same bullet count, no bullet left word-for-word English. It cannot judge the
 * quality of a translation — that is what the person writing the release does
 * — but it makes "forgot the French" impossible to ship.
 */
export function lintTranslation(english: string, french: string): ChangelogProblem[] {
  const problems: ChangelogProblem[] = [];
  const en = parseChangelog(english);
  const fr = parseChangelog(french);
  const frByVersion = new Map(fr.map((release) => [release.version, release]));
  const enVersions = new Set(en.map((release) => release.version));

  const headerLine = new Map<string, number>();
  french.split("\n").forEach((raw, index) => {
    const version = CHANGELOG_HEADER.exec(raw.trimEnd())?.[1];
    if (version) headerLine.set(version.trim(), index + 1);
  });

  for (const source of en) {
    const target = frByVersion.get(source.version);
    const line = headerLine.get(source.version) ?? 1;

    if (!target) {
      problems.push({
        line: 1,
        message: `${source.version} has no French entry — add it to CHANGELOG.fr.md (same header, French bullets)`,
      });
      continue;
    }

    if (target.releasedAt.getTime() !== source.releasedAt.getTime() || target.tag !== source.tag) {
      problems.push({
        line,
        message: `${source.version} must keep the English header's date and tag`,
      });
    }

    if (target.entries.length !== source.entries.length) {
      problems.push({
        line,
        message: `${source.version} has ${target.entries.length} bullet(s) in French and ${source.entries.length} in English — translate every bullet, none merged or dropped`,
      });
      continue;
    }

    if (Boolean(target.summary) !== Boolean(source.summary)) {
      problems.push({
        line,
        message: `${source.version} ${source.summary ? "lost" : "gained"} its intro sentence in French`,
      });
    }

    const texts: [string, string][] = [[source.summary, target.summary]];
    source.entries.forEach((entry, index) => texts.push([entry, target.entries[index]]));

    texts.forEach(([original, translated], index) => {
      const what = index === 0 ? "intro" : `bullet ${index}`;
      if (!translated) return;
      if (translated === original || looksEnglish(translated)) {
        problems.push({
          line,
          message: `${source.version} ${what} is not translated: ${JSON.stringify(translated.slice(0, 70))}`,
        });
      }
    });
  }

  for (const version of frByVersion.keys()) {
    if (!enVersions.has(version)) {
      problems.push({
        line: headerLine.get(version) ?? 1,
        message: `${version} is in CHANGELOG.fr.md but not in CHANGELOG.md`,
      });
    }
  }

  return problems;
}

/** The release a reader lands on, and the one `APP_VERSION` must equal. */
export function latestRelease(markdown: string): ParsedRelease | null {
  return sortReleasesDesc(parseChangelog(markdown))[0] ?? null;
}
