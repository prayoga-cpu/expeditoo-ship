import { changelogService } from "@/server/services/changelog.service";

import { ChangelogShell } from "./ChangelogShell";

/**
 * `/changelog` — the public release history, read from `CHANGELOG.md`.
 *
 * Statically rendered, so the file is read once during `next build` and never
 * from a serverless function on a request. A release only changes on a deploy,
 * which is exactly when this is regenerated.
 *
 * The page stays thin: it reads, and hands plain serialisable data to the
 * client shell. Translations are resolved in the browser, because
 * `LocaleProvider` withholds the intl provider on the server.
 */
export const dynamic = "force-static";

export default function ChangelogPage() {
  return <ChangelogShell releases={changelogService.getReleases()} />;
}
