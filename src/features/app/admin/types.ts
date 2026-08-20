/**
 * Admin feature types
 * Following SOLID principle - centralized type definitions
 */

export interface PendingDelivery {
  id: string;
  title: string;
  origin: string;
  destination: string;
  status: string;
  price: number;
  createdDate: string;
  assignedDriver?: string;
  proposalCount: number;
  // UI helper props
  pickup?: string;
  dropoff?: string;
  date?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
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
