import { db } from "@/db";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { paymentsService } from "@/server/services/payments.service";
import { user } from "@/db/schema/users";
import { payments } from "@/db/schema/payments";
import { stripe } from "@/lib/stripe";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { Stripe } from "stripe";

const HOST_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const stripeService = {
  /**
   * Create or retrieve a Stripe Connect account for a user
   */
  async createConnectAccount(userId: string) {
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    if (!userRecord) throw new Error("User not found");

    if (userRecord.stripeAccountId) {
      return userRecord.stripeAccountId;
    }

    // Create Express account (simplest for platforms)
    // Stripe will collect required info during onboarding
    const account = await stripe.accounts.create({
      type: "express",
      email: userRecord.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        userId: userId,
      },
    });

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
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${HOST_URL}/api/stripe/connect/refresh`, // TODO: Create Route
      return_url: `${HOST_URL}/api/stripe/connect/return`, // TODO: Create Route
      type: "account_onboarding",
    });

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

    if (!userRecord?.stripeAccountId) {
      throw new Error("No Stripe account connected");
    }

    if (userRecord.stripeAccountStatus !== "active") {
      throw new Error("Stripe account is not fully set up yet");
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
    } catch (err: any) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
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
          // Update local payment status
          await db
            .update(payments)
            .set({ status: "captured" })
            .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

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
