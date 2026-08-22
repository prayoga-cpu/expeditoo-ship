import { z } from "zod";

/**
 * The one place the contact subjects are named. The form derives its options
 * from this list — restating them in the UI is how the role enum silently
 * broke admin role assignment (CLAUDE.md gotcha 8), and the same trap applies
 * to any enum with a second copy.
 */
export const contactSubjects = [
  "carrier",
  "auctionHouse",
  "expedionQuote",
  "billing",
  "press",
  "other",
] as const;

export type ContactSubject = (typeof contactSubjects)[number];

export const contactSubmitSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(160),
  company: z.string().trim().max(120).optional(),
  subject: z.enum(contactSubjects),
  // Floored at 20 characters: an enquiry an operator can act on needs more
  // than a greeting, and the floor is the cheapest filter against drive-by
  // submissions on a form that is public by design.
  message: z.string().trim().min(20, "Message is too short").max(2000),
});

export type ContactSubmitInput = z.infer<typeof contactSubmitSchema>;

export interface ContactSubmitResult {
  delivered: true;
  /** Whether the message also landed in the sender's in-product support thread. */
  threadOpened: boolean;
}
