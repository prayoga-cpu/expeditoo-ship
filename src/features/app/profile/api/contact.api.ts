import { api } from "@/lib/fetcher";

/**
 * Client API for a person's names and phones (client_feedback_2026_10_spec.md
 * §7b). The owner reads and writes their own; staff read anyone's.
 */

export interface ContactDetails {
  name: string;
  firstName: string | null;
  lastName: string | null;
  alias: string | null;
  phone: string | null;
  relativeName: string | null;
  relativePhone: string | null;
}

/** What the card sends: every field it shows, `""` clearing one. */
export interface ContactDetailsInput {
  firstName: string;
  lastName: string;
  alias: string;
  phone: string;
  relativeName: string;
  relativePhone: string;
}

export const contactApi = {
  mine: () => api.get<ContactDetails>("/api/users/me/contact"),
  save: (input: ContactDetailsInput) =>
    api.put<ContactDetails>("/api/users/me/contact", input),
  forStaff: (userId: string) =>
    api.get<ContactDetails>(`/api/admin/users/${userId}/contact`),
};
