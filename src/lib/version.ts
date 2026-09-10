/**
 * The current EXPEDITOO release.
 *
 * Kept equal to `package.json` "version" and the newest `CHANGELOG.md` header.
 * Bump all three together — `pnpm changelog:check` and
 * `src/lib/__tests__/changelog.test.ts` both fail when they disagree, because a
 * stale version silently mislabels the release history (AGENTS.md §8).
 */
export const APP_VERSION = "2.39.0";
