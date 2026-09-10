import { db } from "@/db";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { paymentsService } from "@/server/services/payments.service";
import { user } from "@/db/schema/users";
import { stripe } from "@/lib/stripe";
import { eq } from "drizzle-orm";
import type { Stripe } from "stripe";

const HOST_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ========================================
// Errors
// ========================================

export class StripeConnectError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "StripeConnectError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new StripeConnectError(code, status, message);

/** The shape every Stripe SDK rejection carries, narrowed from `unknown`. */
interface StripeFailure {
  type: string;
  message: string;
}

function asStripeFailure(error: unknown): StripeFailure | null {
  if (typeof error !== "object" || error === null) return null;

  const candidate = error as { type?: unknown; message?: unknown };
  if (typeof candidate.type !== "string") return null;
  if (!candidate.type.startsWith("Stripe")) return null;

  return {
    type: candidate.type,
    message: typeof candidate.message === "string" ? candidate.message : "",
  };
}

/**
 * Runs a Stripe call and tells Stripe's refusals apart from our own failures.
 *
 * Stripe answering 400 is not this server falling over, and reporting it as a
 * 500 is what left the payout button dead with nothing to say: the platform
 * account was restricted from opening connected accounts ("we've temporarily
 * restricted your ability to create this type of connected account"), which
 * only the platform owner can clear in the Stripe dashboard.
 *
 * Stripe's own prose names the *platform's* account and is written for whoever
 * reads that dashboard, so it stays in the server log and never reaches a
 * browser. Anything that is not a Stripe rejection — a network fault, a bug of
 * ours — is rethrown untouched and becomes the 500 it genuinely is.
 */
async function throughStripe<T>(
  context: string,
  call: () => Promise<T>
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const failure = asStripeFailure(error);
    if (!failure) throw error;

    console.error(`Stripe ${context} failed:`, failure.type, failure.message);

    if (failure.type === "StripeInvalidRequestError") {
      throw err("STRIPE_REQUEST_REJECTED", 422, "Stripe refused this request");
    }

    throw error;
  }
}

export const stripeService = {
  /**
   * Create or retrieve a Stripe Connect account for a user
   */
  async createConnectAccount(userId: string) {
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    if (!userRecord) throw err("USER_NOT_FOUND", 404, "User not found");

    if (userRecord.stripeAccountId) {
      return userRecord.stripeAccountId;
    }

    // Create Express account (simplest for platforms)
    // Stripe will collect required info during onboarding
    const account = await throughStripe("accounts.create", () =>
      stripe.accounts.create({
        type: "express",
        email: userRecord.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          userId: userId,
        },
      })
    );

    // Save to DB
    await db
      .update(user)
      .set({
        stripeAccountId: account.id,
        stripeAccountStatus: "pending",
      })
      .where(eq(user.id, userId));

    return account.id;
  },

  /**
   * Get or Create Customer ID
   * Used for saving payment methods
   */
  async getOrCreateCustomer(userId: string) {
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    if (!userRecord) throw new Error("User not found");

    if (userRecord.stripeCustomerId) {
      return userRecord.stripeCustomerId;
    }

    // Create new Customer
    const customer = await stripe.customers.create({
      email: userRecord.email,
      name: userRecord.name,
      metadata: { userId },
    });

    // Save to DB
    await db
      .update(user)
      .set({
        stripeCustomerId: customer.id,
      })
      .where(eq(user.id, userId));

    return customer.id;
  },

  /**
   * Create an account link for onboarding
   */
  async createAccountLink(accountId: string) {
    const accountLink = await throughStripe("accountLinks.create", () =>
      stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${HOST_URL}/api/stripe/connect/refresh`,
        return_url: `${HOST_URL}/api/stripe/connect/return`,
        type: "account_onboarding",
      })
    );

    return accountLink.url;
  },

  /**
   * Create a login link to Stripe Express Dashboard
   * User can manage payout settings, view transactions, etc.
   */
  async createDashboardLink(userId: string) {
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { stripeAccountId: true, stripeAccountStatus: true },
    });

    // Typed, like `createConnectAccount`'s refusals: an untyped Error falls
    // through `handleError` to a 500, and "you have not connected an account
    // yet" is the caller's state, not this server failing.
    if (!userRecord?.stripeAccountId) {
      throw err("STRIPE_ACCOUNT_MISSING", 409, "No Stripe account connected");
    }

    if (userRecord.stripeAccountStatus !== "active") {
      throw err(
        "STRIPE_ACCOUNT_NOT_READY",
        409,
        "Stripe onboarding is not finished"
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(
      userRecord.stripeAccountId
    );

    return loginLink.url;
  },

  /**
   * Handle Webhook Events (Account updates, Payment Intents)
   */
  async handleWebhook(body: string, sig: string) {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (failure) {
      const reason =
        failure instanceof Error ? failure.message : String(failure);
      throw new Error(`Webhook signature verification failed: ${reason}`);
    }

    switch (event.type) {
      // 1. Account Updated (Onboarding status)
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (account.metadata?.userId) {
          const isEnabled = account.charges_enabled && account.payouts_enabled;
          await db
            .update(user)
            .set({
              stripeAccountStatus: isEnabled ? "active" : "restricted",
            })
            .where(eq(user.id, account.metadata.userId));
        }
        break;
      }

      // 2. Payment Succeeded (Handle Transfers)
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const transferGroup = paymentIntent.transfer_group;

        if (transferGroup) {
          // Through the service, never with a bare UPDATE here. This wrote no
          // `capturedAt` and had no status predicate, so it settled payments
          // outside every service — raising no document — and a retry arriving
          // after a refund turned the refunded row back into a captured one
          // (docs/specs/invoice_at_payment_spec.md §2).
          await paymentsService.captureByIntent(paymentIntent.id);

          // Trigger transfers (Seller + Driver)
          // NOTE: This logic might move to a separate function triggered here
          await this.recordCarrierPayout(paymentIntent);
        }
        break;
      }
    }
  },

  /**
   * Explicitly check account status (for sync after return)
   */
  async checkAccountStatus(userId: string) {
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { stripeAccountId: true },
    });

    if (!userRecord?.stripeAccountId) {
      console.log("CheckAccountStatus: No stripeAccountId for user", userId);
      return;
    }

    const account = await stripe.accounts.retrieve(userRecord.stripeAccountId);
    if (!account) {
      console.log(
        "CheckAccountStatus: Stripe account not found",
        userRecord.stripeAccountId
      );
      return;
    }

    const isEnabled = account.charges_enabled && account.payouts_enabled;
    const status = isEnabled ? "active" : "restricted";

    console.log("CheckAccountStatus Result:", {
      id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      status,
    });

    await db
      .update(user)
      .set({
        stripeAccountStatus: status,
      })
      .where(eq(user.id, userId));

    return status;
  },

  /**
   * Records the carrier's payout once the held funds are captured.
   *
   * The goods model split one payment between a seller and a driver. A
   * transport job has a single counterparty, so what remains is the job price
   * less the platform commission, which was held at source.
   */
  async recordCarrierPayout(paymentIntent: Stripe.PaymentIntent) {
    const shipmentId = paymentIntent.metadata?.shipmentId;
    if (!shipmentId) {
      console.error("payment_intent without shipmentId", paymentIntent.id);
      return;
    }

    const shipment = await shipmentsDal.getOwnership(shipmentId);
    if (!shipment) {
      console.error("payment_intent for unknown shipment", shipmentId);
      return;
    }

    await paymentsService.schedulePayout(shipmentId, shipment.carrierId);
  },
  /**
   * The Stripe customer this user already has, or null.
   *
   * Reading a user's cards must not bring a customer into existence. Both
   * screens below load from a `useEffect` on mount, so `getOrCreateCustomer`
   * here meant that merely opening the payments page created a real Stripe
   * Customer and stamped `stripeCustomerId` on the row -- a write performed by
   * a GET, on behalf of someone who had not asked for anything.
   */
  async findCustomer(userId: string): Promise<string | null> {
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    if (!userRecord) throw new Error("User not found");

    return userRecord.stripeCustomerId ?? null;
  },

  /**
   * List Saved Payment Methods
   */
  async listPaymentMethods(userId: string) {
    const customerId = await this.findCustomer(userId);

    // No customer means no saved cards. That is the answer, not an error.
    if (!customerId) return [];

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });

    return paymentMethods.data;
  },

  /**
   * Detach (Delete) Payment Method
   */
  async detachPaymentMethod(userId: string, paymentMethodId: string) {
    const customerId = await this.findCustomer(userId);

    if (!customerId) {
      throw new Error("Unauthorized to delete this payment method");
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.customer !== customerId) {
      throw new Error("Unauthorized to delete this payment method");
    }

    await stripe.paymentMethods.detach(paymentMethodId);
  },

  /**
   * Create Setup Intent (Forwarding Future Usage)
   * Used for "Add Card" functionality
   */
  async createSetupIntent(userId: string) {
    const customerId = await this.getOrCreateCustomer(userId);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session", // We want to use this card later without user present
      payment_method_types: ["card"], // Restrict to cards only for cleaner UI
    });

    return {
      clientSecret: setupIntent.client_secret,
    };
  },
};
