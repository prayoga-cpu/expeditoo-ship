/**
 * Reads a `notification:new` event as a job alert, or says it is not one.
 *
 * `new_job` (every approved driver, when a job reaches the board) and
 * `carrier_route_match` (a driver whose declared trajet fits it) both open the
 * job. The event is whatever the server published, so nothing here trusts its
 * shape: a link that is not an in-app path is refused, because a toast action
 * that navigates is an open redirect if it will follow any string.
 */

const JOB_ALERT_TYPES = ["new_job", "carrier_route_match"];

export interface JobAlert {
  title: string;
  message: string;
  href: string;
}

export function jobAlertFrom(event: unknown): JobAlert | null {
  if (!event || typeof event !== "object") return null;
  const { type, title, message, data } = event as Record<string, unknown>;
  if (typeof type !== "string" || !JOB_ALERT_TYPES.includes(type)) return null;
  if (typeof title !== "string" || typeof message !== "string") return null;

  const fields = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const href =
    typeof fields.linkUrl === "string"
      ? fields.linkUrl
      : typeof fields.listingId === "string"
        ? `/listing/${fields.listingId}`
        : null;
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null;

  return { title, message, href };
}
