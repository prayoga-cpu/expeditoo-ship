# Cron Jobs & Scheduled Tasks Specification

**Project:** EXPEDITOO
**Feature:** Cron Jobs / Scheduled Tasks
**Version:** 1.0.0
**Created:** 2025-12-13
**Purpose:** Define all scheduled background tasks, their implementation, and deployment configuration.

---

## 1. Overview

Expeditoo uses **External Cron Services** (specifically [cron-job.org](https://cron-job.org)) to trigger API endpoints that perform background maintenance tasks.

We do **NOT** use internal schedulers (like `node-cron`) or serverless cron wrappers (like Vercel Cron) to avoid platform lock-in and ensure reliability across different hosting environments (VPS, Vercel, Docker).

### Architecture

```
┌─────────────────┐             ┌─────────────────────────┐             ┌─────────────────────┐
│  cron-job.org   │   HTTPS     │  Next.js API Endpoint   │   Calls     │    Service Layer    │
│ (External Job)  │ ──────────► │  (Protected Route)      │ ──────────► │ (Business Logic)    │
└─────────────────┘             └─────────────────────────┘             └─────────────────────┐
        │                                    │                                     │
        ▼                                    ▼                                     ▼
   Triggers every                        Validates                           Executes logic
   1 minute                              Bearer Token                        (Processing DB)
```

---

## 2. Security

All Cron endpoints MUST be protected to prevent unauthorized execution.

### Authentication Mechanism

- **Method:** Bearer Token Authentication
- **Header:** `Authorization: Bearer <CRON_SECRET>`
- **Environment Variable:** `CRON_SECRET` (Must be set in `.env`)

### Implementation Pattern

Every cron route must implement this validation:

```typescript
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Unauthorized" },
      },
      { status: 401 }
    );
  }

  // ... execute task
}
```

---

## 3. Implemented Jobs

### 3.1 Close Expired Auctions

Automatically closes auctions that have passed their `endsAt` time and determines the winner.

- **Endpoint:** `GET /api/cron/close-auctions`
- **Schedule:** Every **1 Minute**
- **Service:** `auctionsService.processExpiredAuctions()`
- **Logic:**
  1. Finds all listings where `type = 'auction'`, `status = 'ACTIVE'`, and `endsAt <= NOW()`.
  2. For each listing:
     - Gets the highest bid.
     - Sets `winnerId` to highest bidder (or `null` if no bids).
     - Updates `status` to `'ENDED'`.
  3. Returns stats of processed items.

---

## 4. Planned Jobs (Future)

These jobs are planned for future phases but follow the same architecture.

| Job Name                  | Proposed Endpoint                | Frequency    | Purpose                                               |
| :------------------------ | :------------------------------- | :----------- | :---------------------------------------------------- |
| **Payment Timeout**       | `/api/cron/cancel-unpaid-orders` | Every 1 Hour | Cancel orders/invoices unpaid after 24 hours.         |
| **Auction Notifications** | `/api/cron/auction-alerts`       | Every 5 Mins | Send "Auction Ending Soon" emails/push notifications. |
| **Cleanup Temp Files**    | `/api/cron/cleanup-storage`      | Daily        | Remove unlinked images from R2/S3 storage.            |

---

## 5. Deployment & Configuration (MANDATORY)

Since we are using an external service, simply deploying the code is **NOT ENOUGH**. You must manually configure the cron job.

### 5.1 Setting up cron-job.org

1. **Create Account**: Register at [cron-job.org](https://cron-job.org) (Free).
2. **Create Job**: Click "Create Cronjob".
   - **Title**: `Expeditoo - Close Auctions`
   - **URL**: `https://<YOUR_PRODUCTION_DOMAIN>/api/cron/close-auctions`
   - **Execution Schedule**: Every 1 minute.
3. **Advanced Settings (Headers)**:
   - This is REQUIRED for security.
   - Key: `Authorization`
   - Value: `Bearer <VALUE_FROM_CRON_SECRET>` (Copy this value from your production `.env`)
4. **Save**: Click "Create Cronjob".

### 5.2 Environment Variables

Ensure your production environment (Vercel/VPS) has the secret key defined:

```bash
# Must match the Bearer token value used in cron-job.org
CRON_SECRET=your_secure_random_string_here
```

---

## 6. Testing

### Local Testing

You can use `curl` or Postman to test the endpoint locally.

**Success Case:**

```bash
curl -H "Authorization: Bearer <YOUR_LOCAL_SECRET>" http://localhost:3000/api/cron/close-auctions
```

**Unauthorized Case:**

```bash
curl http://localhost:3000/api/cron/close-auctions
# Returns 401 Unauthorized
```
