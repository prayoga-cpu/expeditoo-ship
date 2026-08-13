import { z } from "zod";

export const SendEmailSchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  html: z.string().optional(),
  text: z.string().optional(),
});

export type SendEmailInput = z.infer<typeof SendEmailSchema>;
