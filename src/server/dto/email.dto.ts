import { z } from "zod";

export const SendEmailSchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  html: z.string().optional(),
  text: z.string().optional(),
  // Where a reply goes when it should not come back to the platform address.
  // The contact form needs it: support mail is sent *by* Expeditoo but is
  // answered *to* the visitor who wrote in.
  replyTo: z.string().email("Invalid reply-to address").optional(),
});

export type SendEmailInput = z.infer<typeof SendEmailSchema>;
