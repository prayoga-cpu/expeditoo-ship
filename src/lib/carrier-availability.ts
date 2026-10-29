/**
 * Whether a driver may take new work (client_feedback_2026_10_29_spec.md
 * §REQ-02).
 *
 * « Actif » is `approved` and not absent. « Absent » is two columns rather than
 * a status, so it ends by itself on its date without a sweep: absent while
 * `absentSince` is set and `absentUntil` is unset or still ahead. An absent
 * driver keeps everything they have — live runs, money owed, documents — and
 * only stops being offered new work: no offer, no take, no award, no direct
 * assignment, not listed under « Transporteurs disponibles ».
 */

export interface CarrierAvailabilityInput {
  status: string;
  absentSince?: Date | string | null;
  absentUntil?: Date | string | null;
}

export function isAbsent(
  carrier: CarrierAvailabilityInput,
  now: Date = new Date()
): boolean {
  if (!carrier.absentSince) return false;
  if (!carrier.absentUntil) return true;
  return new Date(carrier.absentUntil).getTime() > now.getTime();
}

/** Approved, and not away: the one test every new-work path asks. */
export function mayTakeWork(
  carrier: CarrierAvailabilityInput | null | undefined,
  now: Date = new Date()
): boolean {
  return !!carrier && carrier.status === "approved" && !isAbsent(carrier, now);
}

/**
 * What the admin and the driver read the account as, in the client's four
 * words — plus the application stages before any of them applies.
 */
export type DriverStanding =
  | "active"
  | "absent"
  | "suspended"
  | "deregistered"
  | "applying";

export function driverStanding(
  carrier: CarrierAvailabilityInput,
  now: Date = new Date()
): DriverStanding {
  if (carrier.status === "approved") {
    return isAbsent(carrier, now) ? "absent" : "active";
  }
  if (carrier.status === "suspended") return "suspended";
  if (carrier.status === "deregistered") return "deregistered";
  return "applying";
}
