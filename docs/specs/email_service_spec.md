# Email Service Specification

## Overview

The Email Service handles outgoing transactional emails using Resend. It must be reliable, type-safe, and support development environments where actual sending might be disabled.

## Data Models

### Email Payload (DTO)

Defined in `src/server/dto/email.dto.ts`.

```typescript
import { z } from "zod";

export const SendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(), // Fallback
});

export type SendEmailInput = z.infer<typeof SendEmailSchema>;
```

## Service Interface

`src/server/services/email.service.ts`

### Core Method

#### `sendEmail(input: SendEmailInput): Promise<boolean>`

**Behavior:**

1. Validates input using Zod.
2. Checks for `RESEND_API_KEY`.
   - If missing: Logs email details to console (Dev Mode) and returns `true`.
   - If present: Calls `resend.emails.send`.
3. Returns `true` on success, throws Error on failure.

**Inputs:**

- `to`: Recipient email address.
- `subject`: Email subject line.
- `html`: HTML content (usually rendered from React component).
- `text`: Plain text version.

**Outputs:**

- `Promise<boolean>`: Success status.

---

### Email Methods

#### `sendWelcomeEmail(email: string, name: string): Promise<boolean>`

Sends welcome email to new users after registration.

**Template:** `src/server/emails/WelcomeEmail.tsx`

---

#### `sendAuctionWinEmail(to, winnerName, itemTitle, winningAmount, listingId): Promise<boolean>`

Sends congratulations email to auction winner.

**Template:** `src/server/emails/AuctionWinEmail.tsx`

**Triggered by:**
- `auctionsService.processExpiredAuctions()` (cron job - auction time expires)
- `listingsService.updateListingStatus()` (seller manually ends auction)

**Content:**
- Congratulations message
- Item title and winning bid amount
- CTA: "Complete Checkout" button

---

#### `sendAuctionEndedSellerEmail(to, sellerName, itemTitle, hasWinner, listingId, winnerName?, winningAmount?): Promise<boolean>`

Sends notification email to seller when their auction ends.

**Template:** `src/server/emails/AuctionEndedSellerEmail.tsx`

**Triggered by:**
- `auctionsService.processExpiredAuctions()` (cron job - auction time expires)
- `listingsService.updateListingStatus()` (seller manually ends auction)

**Content (if sold):**
- "Your Auction Sold!" message
- Winner name and final price
- Next steps info

**Content (if no bids):**
- "Auction Ended" message
- CTA: "Repost Item" button

---

#### `sendAuctionLostEmail(to, bidderName, itemTitle, yourHighestBid, winningBid): Promise<boolean>`

Sends notification email to bidders who were outbid.

**Template:** `src/server/emails/AuctionLostEmail.tsx`

**Triggered by:**
- `auctionsService.processExpiredAuctions()` (cron job - auction time expires)
- `listingsService.updateListingStatus()` (seller manually ends auction)

**Content:**
- "Auction Ended" message
- Their highest bid vs winning bid
- CTA: "Browse More Items" button

---

## Email Templates

All templates use React Email (`@react-email/components`) with Tailwind styling.

| Template | File | Purpose |
|----------|------|---------|
| Welcome | `WelcomeEmail.tsx` | New user registration |
| Auction Win | `AuctionWinEmail.tsx` | Winner notification |
| Auction Ended (Seller) | `AuctionEndedSellerEmail.tsx` | Seller notification |
| Auction Lost | `AuctionLostEmail.tsx` | Outbid bidder notification |

---

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `RESEND_API_KEY` | Resend API key for sending emails | _(required for production)_ |
| `EMAIL_FROM` | Sender email address | `Expeditoo <onboarding@resend.dev>` |

**Note:** If `RESEND_API_KEY` is not set, emails are logged to console instead of being sent (development mode).

---

## Error Handling

- **Validation Error**: Throws ZodError if email format is invalid.
- **Provider Error**: Wraps Resend API errors into generic ServiceError.
- **Fire-and-Forget**: Auction emails use `.catch()` to prevent blocking main flow.

