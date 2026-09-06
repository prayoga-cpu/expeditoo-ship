import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  RELEASE_TAGS,
  compareVersionsDesc,
  latestRelease,
  lintChangelog,
  parseChangelog,
  sortReleasesDesc,
} from "@/lib/changelog";

/**
 * Two kinds of test live here, deliberately.
 *
 * The first kind is the parser against strings — the ordinary unit tests.
 *
 * The second reads the repo's own `CHANGELOG.md`, `STATUS.md`, `package.json`
 * and `src/lib/version.ts` and asserts they agree, so the session discipline in
 * AGENTS.md §8 fails `pnpm test` rather than being noticed months later on a
 * page that quietly shows the wrong history. `pnpm changelog:check` is the same
 * gate with a better error message; this is the one CI already runs.
 */
const ROOT = join(__dirname, "..", "..", "..");

const read = (...segments: string[]) => readFileSync(join(ROOT, ...segments), "utf8");

const SAMPLE = `# Changelog

Some prose that is not a release.

## [2.3.0] - 2026-08-26 · feat

- **A driver can name the trajet they drive.** And the board answers with the jobs on it.
- **The map shows one price pin per job.**

## [2.2.1] - 2026-08-20 · fix

- **"My earnings" is no longer a blank page.**

## [2.2.0] - 2026-08-20 · ux

- **Euro amounts read the French way.**
`;

describe("parseChangelog", () => {
  it("reads every release, its date, its tag and its bullets", () => {
    const releases = parseChangelog(SAMPLE);

    expect(releases.map((r) => r.version)).toEqual(["2.3.0", "2.2.1", "2.2.0"]);
    expect(releases[0].tag).toBe("feat");
    expect(releases[0].releasedAt.toISOString()).toBe("2026-08-26T00:00:00.000Z");
    expect(releases[0].entries).toHaveLength(2);
    expect(releases[0].entries[0]).toMatch(/^\*\*A driver can name/);
  });

  it("ignores prose that is not a bullet under a release", () => {
    expect(parseChangelog(SAMPLE)[2].entries).toEqual([
      "**Euro amounts read the French way.**",
    ]);
  });

  it("drops a release whose tag is not one of the four", () => {
    const releases = parseChangelog(`## [9.9.9] - 2026-01-01 · chore\n\n- something\n`);

    expect(releases).toEqual([]);
  });

  it("returns nothing for a file with no releases", () => {
    expect(parseChangelog("# Changelog\n\nNothing yet.\n")).toEqual([]);
  });
});

describe("compareVersionsDesc", () => {
  it("compares numerically, so 2.13.0 outranks 2.9.0", () => {
    expect(compareVersionsDesc("2.13.0", "2.9.0")).toBeLessThan(0);
    expect(["2.9.0", "2.13.0", "2.10.1"].sort(compareVersionsDesc)).toEqual([
      "2.13.0",
      "2.10.1",
      "2.9.0",
    ]);
  });

  it("breaks a same-day tie by version rather than leaving it to the database", () => {
    const sameDay = new Date("2026-08-26T00:00:00Z");
    const sorted = sortReleasesDesc([
      { version: "2.9.0", releasedAt: sameDay },
      { version: "2.13.0", releasedAt: sameDay },
    ]);

    expect(sorted.map((r) => r.version)).toEqual(["2.13.0", "2.9.0"]);
  });
});

describe("lintChangelog", () => {
  it("passes a well-formed file", () => {
    expect(lintChangelog(SAMPLE)).toEqual([]);
  });

  it("reports a malformed header rather than silently dropping the release", () => {
    // A hyphen where the middle dot belongs — the exact typo that makes a
    // release vanish from the page with no error anywhere.
    const problems = lintChangelog("## [2.3.0] - 2026-08-26 - feat\n\n- a bullet\n");

    expect(problems.map((p) => p.message)).toEqual([
      expect.stringMatching(/malformed header/),
      // And the file is then empty of releases, which is the consequence worth
      // saying out loud: an unparsed header does not degrade the page, it
      // removes the release from it entirely.
      expect.stringMatching(/no releases found/),
    ]);
  });

  it("reports a duplicated version, which would overwrite a real release", () => {
    const problems = lintChangelog(
      `## [2.3.0] - 2026-08-26 · feat\n\n- one\n\n## [2.3.0] - 2026-08-27 · fix\n\n- two\n`
    );

    expect(problems.some((p) => /already appears on line/.test(p.message))).toBe(true);
  });

  it("reports a release with no bullets", () => {
    const problems = lintChangelog(`## [2.3.0] - 2026-08-26 · feat\n\n## [2.2.0] - 2026-08-20 · fix\n\n- one\n`);

    expect(problems.some((p) => /no `- ` bullets/.test(p.message))).toBe(true);
  });

  it("reports a version that is not x.y.z", () => {
    const problems = lintChangelog("## [2.3] - 2026-08-26 · feat\n\n- one\n");

    expect(problems.some((p) => /is not x\.y\.z/.test(p.message))).toBe(true);
  });

  it("reports an empty file", () => {
    expect(lintChangelog("# Changelog\n")[0].message).toMatch(/no releases found/);
  });
});

describe("the repo's own release records (AGENTS.md §8)", () => {
  const changelog = read("CHANGELOG.md");
  const status = read("STATUS.md");
  const latest = latestRelease(changelog);

  it("CHANGELOG.md is well-formed", () => {
    expect(lintChangelog(changelog)).toEqual([]);
  });

  it("every release carries one of the four tags", () => {
    const tags = new Set(parseChangelog(changelog).map((r) => r.tag));

    for (const tag of tags) expect(RELEASE_TAGS).toContain(tag);
  });

  it("APP_VERSION equals the newest release", () => {
    const appVersion = /APP_VERSION\s*=\s*"([^"]+)"/.exec(read("src", "lib", "version.ts"))?.[1];

    expect(appVersion).toBe(latest?.version);
  });

  it("package.json version equals the newest release", () => {
    const pkg = JSON.parse(read("package.json")) as { version: string };

    expect(pkg.version).toBe(latest?.version);
  });

  it("every release has a STATUS.md entry, and every STATUS.md entry a release", () => {
    const released = new Set(parseChangelog(changelog).map((r) => r.version));
    const recorded = new Set(
      status
        .split("\n")
        .map((line) => /^##\s+✅\s+\d{4}-\d{2}-\d{2}\s+—\s+.+\((\d+\.\d+\.\d+)\)\s*$/.exec(line.trimEnd())?.[1])
        .filter((version): version is string => Boolean(version))
    );

    expect([...released].filter((v) => !recorded.has(v))).toEqual([]);
    expect([...recorded].filter((v) => !released.has(v))).toEqual([]);
  });
});
