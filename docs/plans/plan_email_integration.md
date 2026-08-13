# Email Service Integration Plan

## Goal

Implement a robust email service using **Resend** to handle transactional emails (welcome, notifications, etc.) properly following the Clean Architecture.

## Dependencies

- `resend` (Already installed)
- `@react-email/components` (Already installed)

## Implementation Steps

### 1. Infrastructure Setup

- [ ] Create `src/lib/email.ts` to initialize Resend client.
- [ ] Ensure `RESEND_API_KEY` is in environment variables (will use placeholder for dev).

### 2. Service Layer

- [ ] Create `src/server/dto/email.dto.ts` for validation schemas.
- [ ] Create `src/server/services/email.service.ts`.
  - Should handle `sendEmail` method.
  - Development mode: Log to console if no API Key provided.
  - Production mode: Send via Resend.

### 3. Email Templates (Basic)

- [ ] Create `src/server/emails/WelcomeEmail.tsx` (using @react-email).
- [ ] Create `src/server/emails/NotificationEmail.tsx`.

### 4. Integration

- [ ] Add `emailService.sendWelcomeEmail` to Auth flow (optional/future trigger).
- [ ] Add generic `sendEmail` functionality.

### 5. API Testing

- [ ] Create a test route `src/app/api/test-email/route.ts` (dev only) to verify functionality.

## File Structure Changes

```
src/
  lib/
    email.ts            # Resend client initialization
  server/
    dto/
      email.dto.ts      # Zod schemas for email
    services/
      email.service.ts  # Logic for sending emails
    emails/             # React Email templates
      WelcomeEmail.tsx
      NotificationEmail.tsx
```
