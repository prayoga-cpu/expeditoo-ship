/**
 * ============================================================================
 * The session-discipline gate (AGENTS.md §8)
 * ============================================================================
 *
 * A release is recorded in four places that must agree:
 *
 *   CHANGELOG.md      the newest `## [x.y.z] - YYYY-MM-DD · tag` header
 *   STATUS.md         a matching `## ✅ YYYY-MM-DD — Title (x.y.z)` entry
 *   package.json      "version"
 *   src/lib/version.ts  APP_VERSION
 *
 * Nothing enforces that by itself, and each is easy to forget in the last five
 * minutes of a session — which is precisely when it is forgotten. A drifted
 * version is not cosmetic: `sync-changelog.ts` upserts **by version**, so a
 * duplicated or stale number silently overwrites a real release, and the
 * public /changelog page shows the wrong history with no error anywhere.
 *
 *   pnpm changelog:check
 *
 * Exits non-zero with every problem listed, not just the first — a gate that
 * reports one mistake per run costs a round trip per mistake.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { latestRelease, lintChangelog } from "../src/lib/changelog";

const ROOT = process.cwd();

const read = (...segments: string[]) =>
  readFileSync(join(ROOT, ...segments), "utf8");

/**
 * `## ✅ 2026-08-30 — Title (2.41.0)` — the version in the trailing parens is
 * what ties an engineer-facing entry to a user-facing release.
 */
const STATUS_HEADER = /^##\s+✅\s+(\d{4}-\d{2}-\d{2})\s+—\s+.+\((\d+\.\d+\.\d+)\)\s*$/;

function statusVersions(markdown: string): { version: string; date: string }[] {
  return markdown
    .split("\n")
    .map((line) => STATUS_HEADER.exec(line.trimEnd()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ version: match[2], date: match[1] }));
}

function main() {
  const problems: string[] = [];

  const changelog = read("CHANGELOG.md");
  const status = read("STATUS.md");
  const pkg = JSON.parse(read("package.json")) as { version?: string };
  const versionModule = read("src", "lib", "version.ts");

  for (const problem of lintChangelog(changelog)) {
    problems.push(`CHANGELOG.md:${problem.line} — ${problem.message}`);
  }

  const latest = latestRelease(changelog);

  if (!latest) {
    problems.push("CHANGELOG.md — no parsable release; nothing else can be checked against it");
    report(problems);
    return;
  }

  const appVersion = /APP_VERSION\s*=\s*"([^"]+)"/.exec(versionModule)?.[1];

  if (!appVersion) {
    problems.push('src/lib/version.ts — could not read APP_VERSION = "x.y.z"');
  } else if (appVersion !== latest.version) {
    problems.push(
      `src/lib/version.ts — APP_VERSION is ${appVersion}, newest CHANGELOG.md release is ${latest.version}`
    );
  }

  if (pkg.version !== latest.version) {
    problems.push(
      `package.json — "version" is ${pkg.version ?? "(unset)"}, newest CHANGELOG.md release is ${latest.version}`
    );
  }

  const recorded = statusVersions(status);

  if (!recorded.some((entry) => entry.version === latest.version)) {
    problems.push(
      `STATUS.md — no entry for ${latest.version}. Every release needs one: "## ✅ ${latest.releasedAt.toISOString().slice(0, 10)} — <Title> (${latest.version})"`
    );
  }

  // A STATUS entry for a version the changelog never released means one of the
  // two files was edited alone — usually the changelog entry was dropped in a
  // rebase, which is invisible until the page is missing a release.
  const released = new Set(
    changelog
      .split("\n")
      .map((line) => /^##\s+\[([^\]]+)\]/.exec(line.trimEnd())?.[1])
      .filter(Boolean)
  );

  for (const entry of recorded) {
    if (!released.has(entry.version)) {
      problems.push(
        `STATUS.md — entry for ${entry.version} has no matching CHANGELOG.md release`
      );
    }
  }

  report(problems, latest.version, recorded.length);
}

function report(problems: string[], version?: string, statusEntries?: number) {
  if (problems.length === 0) {
    console.log(
      `[changelog:check] ok — ${version} agrees across CHANGELOG.md, STATUS.md (${statusEntries} entries), package.json and src/lib/version.ts`
    );
    return;
  }

  console.error(`[changelog:check] ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error("\nSee AGENTS.md §8 — Session discipline.");
  process.exit(1);
}

main();
