/**
 * Admin feature types
 * Following SOLID principle - centralized type definitions
 */

/** A run on the admin « Expéditions » table (client_feedback_2026_10_21_spec.md §A5). */
export interface PendingDelivery {
  id: string;
  title: string;
  /** The job's « Réf. », null for a run with no job behind it. */
  reference: number | null;
  /** Departure and arrival towns. */
  origin: string;
  destination: string;
  /** `shipment_status`, uppercase, as stored. */
  status: string;
  price: number;
  createdDate: string;
  /** Who is driving it, or null while nobody is. */
  driverName: string | null;
  /** Who posted the job, or null for a run with no job behind it. */
  requesterName: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  /** The strongest role held — still used for sorting and the KYC dialog's
   * "current role" line. Display now reads `roles` instead: an account
   * commonly holds more than one, and collapsing to this one is what used to
   * make a support or finance account read "Shipper" in this table. */
  role: string;
  /** Every role the account holds, in `user_roles` order. */
  roles: string[];
  /** `pending` is an account that has never verified its email address. */
  status: "active" | "suspended" | "pending";
  joinDate: string;
  /** ISO timestamp of the last real sign-in; null when there has never been one. */
  lastLoginAt: string | null;
  /** Which app the account was created in. */
  origin: "expeditoo" | "expedion";
  /**
   * Why the server would refuse each action on this row, or null when it would
   * accept it — decided once in account-policy.ts. The menu shows every action
   * either way: offering one the endpoint then refuses is confusing, but so is
   * an item that silently disappears, so a blocked one is disabled and says
   * why.
   */
  impersonateBlocked: string | null;
  deleteBlocked: string | null;
  suspendBlocked: string | null;
}

export interface Proposal {
  id: string;
  driverId: string;
  price: number;
  message?: string | null;
  createdAt: string;
  driver?: {
    name: string;
    image?: string | null;
  };
}
