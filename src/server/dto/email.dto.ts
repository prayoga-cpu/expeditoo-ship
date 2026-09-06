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
  // Base64 payloads only. The Resend SDK JSON-encodes its body and does no
  // conversion of its own, so a Buffer here would arrive as
  // {"type":"Buffer","data":[...]} and the attachment would be corrupt with no
  // error raised anywhere (docs/specs/invoice_at_payment_spec.md §7.1).
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1),
        content: z.string().min(1),
        contentType: z.string().optional(),
      })
    )
    .optional(),
});

export type SendEmailInput = z.infer<typeof SendEmailSchema>;
