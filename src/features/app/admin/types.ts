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
  status: "active" | "suspended" | "inactive";
  joinDate: string;
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
