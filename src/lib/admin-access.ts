import type { UserRoleEnum } from "@/db/schema/users";

/**
 * Which staff role may open which back-office page — once.
 *
 * `roles_spec.md` §5 has always said `/admin/*` is for `operator`, `support`,
 * `finance` and `admin`, « each seeing only its permitted tabs ». Until 2.95.0
 * the proxy admitted `admin` alone while `active-access.ts` offered Admin mode
 * to all four, so three of them were shown a switch that bounced them to
 * `/home`. The proxy, the sidebar, the phone bar and the mode switcher all
 * read this table now.
 *
 * **A navigation table, never a permission.** Every read and write behind
 * these pages is still authorised by its own service; this only decides which
 * pages are worth showing. Each row is therefore derived from what the page's
 * services accept *today*, not from what the spec wishes: a page whose reads
 * would all answer 403 is not listed for that role, even where §3 of the spec
 * grants the capability (the disagreements are listed in §5.2 there).
 *
 * `admin` opens everything listed. A path that matches no row is admin-only:
 * a new page is closed to the other three until someone classifies it, and
 * `admin-access.test.ts` walks `src/app/(app)/admin` and fails until they do.
 */

export const STAFF_ROLES = [
  "admin",
  "operator",
  "support",
  "finance",
] as const satisfies readonly UserRoleEnum[];

export type StaffRole = (typeof STAFF_ROLES)[number];

export interface AdminPage {
  /** The route as the file tree spells it: `/admin/users/[id]/activity`. */
  path: string;
  /** Who may open it besides `admin`, who always may. */
  roles: readonly Exclude<StaffRole, "admin">[];
  /** A sidebar entry, and so a candidate landing. Redirects and detail
   * pages are not. */
  nav?: true;
}

/**
 * Sidebar entries first and in sidebar order — `adminLandingFor` walks this
 * list, and `nav.test.ts` asserts it agrees with `ADMIN_NAV_GROUPS`.
 */
export const ADMIN_PAGES: readonly AdminPage[] = [
  // Operations. The report and every quote action sit behind
  // `requireExpedionAdmin` / an admin-only route, so Supervision is admin's.
  { path: "/admin/expedion", roles: [], nav: true },
  { path: "/admin/bordereaux", roles: ["operator"], nav: true },
  { path: "/admin/awards", roles: ["operator"], nav: true },
  { path: "/admin/listings", roles: ["operator"], nav: true },
  { path: "/admin/shipments", roles: ["operator"], nav: true },
  // People. `getUsers` and the client book are admin-only.
  { path: "/admin/users", roles: [], nav: true },
  { path: "/admin/expedion-clients", roles: [], nav: true },
  { path: "/admin/drivers", roles: ["operator"], nav: true },
  // Money. `/api/admin/payments` and `/refunds` refuse everyone but admin.
  { path: "/admin/payments", roles: [], nav: true },
  { path: "/admin/withdrawals", roles: ["operator", "finance"], nav: true },
  // Quality.
  { path: "/admin/incidents", roles: ["operator"], nav: true },
  { path: "/admin/feedback", roles: ["operator"], nav: true },
  { path: "/admin/support", roles: ["support"], nav: true },
  // System.
  { path: "/admin/settings", roles: ["finance"], nav: true },

  // Detail pages and redirects.
  { path: "/admin/users/[id]/activity", roles: ["support"] },
  // `messagesService` admits `admin` and `support` into a support thread it is
  // not a participant of (roles_spec.md §3: support acts in support threads).
  { path: "/admin/support/[id]", roles: ["support"] },
  { path: "/admin/applications", roles: ["operator"] },
  { path: "/admin/profile", roles: ["finance"] },
  // Both redirect to Supervision; anyone else is sent to their own landing.
  { path: "/admin", roles: [] },
  { path: "/admin/dashboard", roles: [] },
];

const segmentsOf = (path: string) => path.split("/").filter(Boolean);

const PAGE_SEGMENTS = ADMIN_PAGES.map((page) => ({
  page,
  segments: segmentsOf(page.path),
}));

const isDynamic = (segment: string) =>
  segment.startsWith("[") && segment.endsWith("]");

/** Whether `pattern` matches the leading segments of `path`. */
function leads(pattern: string[], path: string[]): boolean {
  if (pattern.length > path.length) return false;
  return pattern.every(
    (segment, index) => isDynamic(segment) || segment === path[index]
  );
}

/**
 * The row that governs a path: the longest one whose segments lead it, so
 * `/admin/users/u1/activity` is the activity page and `/admin/users/u1` falls
 * back to the user list. Whole segments only — `/admin/expedion-clients` is
 * not under `/admin/expedion`.
 */
export function adminPageFor(pathname: string): AdminPage | null {
  const path = segmentsOf(pathname.split(/[?#]/)[0]);
  let best: (typeof PAGE_SEGMENTS)[number] | null = null;
  for (const candidate of PAGE_SEGMENTS) {
    if (!leads(candidate.segments, path)) continue;
    if (!best || candidate.segments.length > best.segments.length) {
      best = candidate;
    }
  }
  return best?.page ?? null;
}

/** The staff roles among an account's roles; everything else is ignored. */
export function staffRolesOf(roles: readonly string[]): StaffRole[] {
  return STAFF_ROLES.filter((role) => roles.includes(role));
}

/** Whether an account holding these roles may open this back-office path. */
export function canOpenAdminPath(
  roles: readonly string[],
  pathname: string
): boolean {
  const held = staffRolesOf(roles);
  if (held.length === 0) return false;
  if (held.includes("admin")) return true;

  // Unlisted: admin-only. Fail closed.
  const page = adminPageFor(pathname);
  if (!page) return false;
  return page.roles.some((role) => held.includes(role));
}

/**
 * Where Admin mode opens for these roles: the first sidebar entry they may
 * see. `null` for an account with no back-office page at all — which is also
 * how `active-access.ts` decides whether to offer Admin mode.
 */
export function adminLandingFor(roles: readonly string[]): string | null {
  const landing = ADMIN_PAGES.find(
    (page) => page.nav && canOpenAdminPath(roles, page.path)
  );
  return landing?.path ?? null;
}

/**
 * Whether the sidebar badges may be asked for. `adminNavService.counts`
 * answers `admin` and `operator` only; asking for the others is a 403 every
 * minute for numbers on entries they cannot see anyway.
 */
export function canReadAdminNavCounts(roles: readonly string[]): boolean {
  return roles.includes("admin") || roles.includes("operator");
}

/**
 * Where « back to users » goes: the users list for an account that may open it,
 * otherwise the account's own landing, so a support agent is not bounced.
 */
export function usersHrefFor(roles: readonly string[]): string {
  if (canOpenAdminPath(roles, "/admin/users")) return "/admin/users";
  return adminLandingFor(roles) ?? "/home";
}
