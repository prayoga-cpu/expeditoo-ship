import { api } from "@/lib/fetcher";

/**
 * Client API for the public one-tap confirmation link.
 *
 * The only client API in the app that talks to an unauthenticated route: the
 * signed token is the whole authority, and it grants nothing but the right to
 * record one attestation (transport_status_confirmation_spec.md §6).
 */

export type ConfirmableMilestone = "PICKED_UP" | "DELIVERED";

export type ConfirmationChannel = "expedion_app" | "link";

/**
 * What the landing page renders. Deliberately thin — no price, no parties, and
 * cities rather than street addresses: the link lives for 30 days in an SMS
 * and the dropoff on an Expedion job is the client's home address.
 */
export interface ConfirmationSubject {
  milestone: ConfirmableMilestone;
  shipmentStatus: string;
  pickupCity: string | null;
  dropoffCity: string | null;
  reference: string | null;
  alreadyConfirmed: boolean;
  confirmedAt: string | null;
  /** False while the transporter has not recorded the milestone yet. */
  confirmable: boolean;
  /** Distinct from `!confirmable`: a cancelled run gets no further message. */
  cancelled: boolean;
}

export interface ShipmentConfirmation {
  id: string;
  milestone: ConfirmableMilestone;
  channel: ConfirmationChannel;
  /** `operator` when staff answered on the client's behalf. */
  confirmedByRole: "client" | "operator";
  createdAt: string;
}

export interface AttestResult {
  confirmation: ShipmentConfirmation;
  alreadyConfirmed: boolean;
}

export const confirmApi = {
  describe: (token: string) =>
    api.get<ConfirmationSubject>(
      `/api/shipments/confirm?token=${encodeURIComponent(token)}`
    ),

  submit: (token: string, note?: string) =>
    api.post<AttestResult>("/api/shipments/confirm", { token, note }),
};
