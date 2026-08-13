import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

// Initialize Resend client only if API key is present
// Otherwise we'll handle it in the service layer (mock mode)
export const resend = apiKey ? new Resend(apiKey) : null;

export const EMAIL_FROM =
  process.env.EMAIL_FROM || "Expeditoo <onboarding@resend.dev>";

