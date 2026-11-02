import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No screen ends on a sentence with nothing to press
 * (docs/specs/no_dead_ends_spec.md §7).
 *
 * Two shapes did, over and over, before 2.75.0: a failed read rendered as a
 * line of red text (or worse, as « nothing here »), and an empty state with no
 * way on from it. This reads the source rather than rendering it, the way
 * `listing-view.test.ts` reads the schema: it is a guard against the next
 * screen forgetting, not a test of any one screen.
 *
 * An exception is allowed, and has to say why.
 */

const ROOT = join(__dirname, "..");

/** Files whose failure branch may stand without a retry, and the reason. */
const ERROR_WITHOUT_RETRY: Record<string, string> = {
  "features/app/create/ui/RequestPostedScreen.tsx":
    "its failure branch links to « Mes demandes », where the request is",
  "features/app/profile/ui/RequestActivityCard.tsx":
    "two counters that show « — » when unread; nothing on the page depends on them",
};

/**
 * Empty states that may stand without an action, keyed `file :: title`, and
 * the reason. An empty work queue is the goal, not a dead end.
 */
const EMPTY_WITHOUT_ACTION: Record<string, string> = {
  'features/app/admin/expedion/ui/ExpedionClientsTable.tsx :: t("empty")':
    "staff list; the search box above is the way on",
  'features/app/admin/expedion/ui/RecentDirectRequestsPanel.tsx :: t("empty")':
    "staff panel: no new direct request is nothing to act on",
  'features/app/admin/ui/AwardQueue.tsx :: t("empty.title")': "an empty award queue is the goal",
  'features/app/admin/ui/CarrierApplicationsList.tsx :: t("table.empty.title")':
    "staff queue; the status filter above is the way on",
  "features/app/feedback/ui/FeedbackConsole.tsx :: hasFilters":
    "staff queue; the filters above are the way on",
  'features/app/feedback/ui/FeedbackDialog.tsx :: t("history.emptyTitle")':
    "the other tab of the same dialog is the form to send one",
  'features/app/incidents/ui/IncidentQueue.tsx :: t("queue.emptyTitle")': "an empty incident queue is the goal",
  'features/app/withdrawals/ui/WithdrawalQueue.tsx :: t("queueEmpty")': "an empty payout queue is the goal",
  'features/app/carrier/ui/PlannedTripsPanel.tsx :: t("empty.title")':
    "the « add a trip » button sits directly above it",
  'features/app/listing/ui/AvailableCarriersPanel.tsx :: t("empty.title")':
    "the tab strip above leads back to the offers; carriers still bid on the board",
  'features/app/platform-settings/ui/CronStatusPanel.tsx :: t("error")':
    "the panel's header carries its own refresh button",
  'features/app/profile/ui/invoices/InvoiceList.tsx :: t("empty")':
    "a receipt is raised by paying; there is nothing to do from here",
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sources(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

const files = [...sources(join(ROOT, "features")), ...sources(join(ROOT, "app"))].map(
  (path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") })
);

/** A branch that renders on a failed read. */
const FAILURE_BRANCH = /(?:\bisError|\.isError)\s*(?:\?|&&|\|\|)|if \([^)]*\bisError\b/;
/** Anything that offers the read again. */
const RETRY = /LoadErrorState|onRetry|refetch|\bretry\b/;

/** `<CenteredEmptyState … />` — closed on itself, so it has no children. */
const SELF_CLOSING_EMPTY = /<CenteredEmptyState\b(?:[^<>]|=>|\{[^{}]*\})*?\/>/g;

function emptyKey(path: string, element: string) {
  const title = /title=\{\s*([^}\n]*?)\s*(?:\}|\n)/.exec(element)?.[1] ?? "";
  // A ternary title is keyed on its condition, which is what tells two apart.
  return `${path} :: ${title.split(" ?")[0].trim()}`;
}

describe("no dead ends", () => {
  it("offers a retry wherever a failed read is rendered", () => {
    const offenders = files
      .filter(({ text }) => FAILURE_BRANCH.test(text) && !RETRY.test(text))
      .map(({ path }) => path)
      .filter((path) => !(path in ERROR_WITHOUT_RETRY));

    expect(offenders).toEqual([]);
  });

  it("gives every empty state a way on, or a stated reason it needs none", () => {
    const offenders = files.flatMap(({ path, text }) =>
      [...text.matchAll(SELF_CLOSING_EMPTY)]
        .map((match) => emptyKey(path, match[0]))
        .filter((key) => !(key in EMPTY_WITHOUT_ACTION))
    );

    expect(offenders).toEqual([]);
  });

  it("keeps no exception for a screen that no longer needs one", () => {
    const stillNeeded = new Set(
      files.flatMap(({ path, text }) => [
        ...[...text.matchAll(SELF_CLOSING_EMPTY)].map((m) => emptyKey(path, m[0])),
        ...(FAILURE_BRANCH.test(text) && !RETRY.test(text) ? [path] : []),
      ])
    );
    const stale = [...Object.keys(ERROR_WITHOUT_RETRY), ...Object.keys(EMPTY_WITHOUT_ACTION)].filter(
      (key) => !stillNeeded.has(key)
    );

    expect(stale).toEqual([]);
  });
});
