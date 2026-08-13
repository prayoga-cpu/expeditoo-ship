# Email Templates

This directory contains React Email templates for EXPEDITOO's transactional emails.

## Templates

### VerificationEmail

Used for email verification during signup.

**Props:**

- `verificationUrl` (string): The verification link
- `userName` (string, optional): User's first name (defaults to "there")

### PasswordResetEmail

Used for password reset requests.

**Props:**

- `resetUrl` (string): The password reset link
- `userName` (string, optional): User's first name (defaults to "there")

## Usage

```typescript
import { VerificationEmail, PasswordResetEmail } from "../emails";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Send verification email
await resend.emails.send({
  from: "EXPEDITOO <onboarding@resend.dev>",
  to: "user@example.com",
  subject: "Verify your EXPEDITOO account",
  react: VerificationEmail({
    verificationUrl: "https://expeditoo.com/verify?token=...",
    userName: "John",
  }),
});

// Send password reset email
await resend.emails.send({
  from: "EXPEDITOO <onboarding@resend.dev>",
  to: "user@example.com",
  subject: "Reset your EXPEDITOO password",
  react: PasswordResetEmail({
    resetUrl: "https://expeditoo.com/reset?token=...",
    userName: "John",
  }),
});
```

## Testing

In development mode (NODE_ENV !== "production"), all emails are automatically sent to Resend's test address: `delivered@resend.dev`

This allows you to test email functionality without sending emails to real users.

## Environment Variables

Required environment variables:

```env
RESEND_API_KEY=re_...           # Your Resend API key
EMAIL_FROM=EXPEDITOO <onboarding@resend.dev>  # Sender email
NEXT_PUBLIC_APP_URL=http://localhost:3000     # App URL for links
NODE_ENV=development            # Set to 'production' to send real emails
```

## Resend Documentation

- [Resend Docs](https://resend.com/docs)
- [React Email Components](https://react.email/docs/components/html)
- [Testing with Resend](https://resend.com/docs/send-with-nextjs#testing)

## Design

All templates follow EXPEDITOO's brand guidelines:

- Clean, modern design
- Black CTA buttons
- Responsive layout (max-width: 600px)
- Professional typography
- Accessible color contrast
