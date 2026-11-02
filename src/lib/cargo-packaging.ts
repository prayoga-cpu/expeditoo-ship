/**
 * How the goods already are, against what the carrier is asked to do to them.
 *
 * `packagingLevel` is a state the requester reports; `needsProtection` and
 * `needsPackaging` are services the carrier performs and prices. A state can
 * make a service meaningless — a boxed item does not need boxing — and a job
 * carrying both would tell the carrier two contradictory things. This is the
 * one place that says which pairs contradict; the form uses it to keep a
 * request coherent and the create DTO uses it to refuse one that is not.
 *
 * See docs/specs/cargo_packaging_services_spec.md §2.
 */

export type PackagingLevel = "protected" | "boxed";

export type PackagingService = "needsProtection" | "needsPackaging";

export const PACKAGING_SERVICES = [
  "needsProtection",
  "needsPackaging",
] as const satisfies readonly PackagingService[];

/**
 * Whether the stated state already covers the service. Boxed means protected
 * and then put in a box, so it covers both; protected covers protection only —
 * a wrapped item may still need a box.
 */
export function isRedundantService(
  level: PackagingLevel | null | undefined,
  service: PackagingService
): boolean {
  if (level === "boxed") return true;
  if (level === "protected") return service === "needsProtection";
  return false;
}

/**
 * « Ni protection ni emballage »: the item travels as it is, and the carrier
 * does nothing to it. Not a stored flag but the state where neither the item's
 * preparation nor a service is stated — so it can never disagree with them
 * (client_feedback_2026_10_31_spec.md §5).
 */
export function hasNoPackaging(job: {
  packagingLevel?: PackagingLevel | null;
  needsProtection?: boolean | null;
  needsPackaging?: boolean | null;
}): boolean {
  return !job.packagingLevel && !job.needsProtection && !job.needsPackaging;
}
