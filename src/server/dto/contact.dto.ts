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

/**
 * The subject as staff read it, in the mail to the support desk and in the
 * support thread. French, like the rest of the staff-facing mail; the visitor's
 * own form reads `marketing.contact.form.subjects` in their language, and these
 * are the same six labels.
 */
export const CONTACT_SUBJECT_LABELS: Record<ContactSubject, string> = {
  carrier: "Devenir transporteur",
  auctionHouse: "Partenariat maison de vente",
  expedionQuote: "Une livraison ou un devis Expedion",
  billing: "Facturation ou versements",
  press: "Presse",
  other: "Autre sujet",
};

/**
 * Every message below is a key under `marketing.contact.form.errors`, never a
 * sentence: the public form prints the issue beside its field, in the
 * visitor's language (`ContactForm`'s `FieldError`).
 */
export const contactSubmitSchema = z.object({
  name: z.string().trim().min(2, "nameTooShort").max(80, "tooLong"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("emailInvalid")
    .max(160, "tooLong"),
  company: z.string().trim().max(120, "tooLong").optional(),
  subject: z.enum(contactSubjects),
  // Floored at 20 characters: an enquiry an operator can act on needs more
  // than a greeting, and the floor is the cheapest filter against drive-by
  // submissions on a form that is public by design.
  message: z.string().trim().min(20, "messageTooShort").max(2000, "tooLong"),
});

export type ContactSubmitInput = z.infer<typeof contactSubmitSchema>;

export interface ContactSubmitResult {
  delivered: true;
  /** Whether the message also landed in the sender's in-product support thread. */
  threadOpened: boolean;
}
