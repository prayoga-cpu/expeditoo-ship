import { earningsService } from "@/server/services/earnings.service";
import { db } from "@/db";
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

        if (paymentIntent.status === "succeeded" && transferGroup) {
          // Update local payment status
          await db
            .update(payments)
            .set({ status: "succeeded" })
            .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

          // Trigger transfers (Seller + Driver)
          // NOTE: This logic might move to a separate function triggered here
          await this.processSplitTransfers(paymentIntent);
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
   * Process Split Transfers after Payment Success
   * "Separate Charges and Transfers" flow
   */
  async processSplitTransfers(paymentIntent: Stripe.PaymentIntent) {
    // We need metadata to know who gets what
    const {
      orderId,
      sellerId,
      driverId,
      sellerStripeId,
      driverStripeId,
      itemAmount,
      shippingAmount,
    } = paymentIntent.metadata;

    if (!orderId) return; // Should not happen if metadata is set correctly

    // 1. Transfer to Seller (Item Cost)
    if (sellerStripeId && itemAmount) {
      try {
        const transfer = await stripe.transfers.create({
          amount: parseInt(itemAmount),
          currency: paymentIntent.currency,
          destination: sellerStripeId,
          transfer_group: paymentIntent.transfer_group as string,
          metadata: { orderId, type: "item_cost" },
        });

        // Record Earning in DB
        if (sellerId) {
          await earningsService.recordEarning({
            userId: sellerId,
            orderId,
            amount: parseInt(itemAmount),
            source: "sale",
            description: "Item sale revenue",
            stripeTransferId: transfer.id,
          });
        }
      } catch (err) {
        console.error("Seller transfer failed", err);
        // Log failure for manual retry
      }
    }

    // 2. Transfer to Driver (Shipping Cost)
    if (driverStripeId && shippingAmount) {
      try {
        const transfer = await stripe.transfers.create({
          amount: parseInt(shippingAmount),
          currency: paymentIntent.currency,
          destination: driverStripeId,
          transfer_group: paymentIntent.transfer_group as string,
          metadata: { orderId, type: "shipping_cost" },
        });

        // Record Earning in DB
        if (driverId) {
          await earningsService.recordEarning({
            userId: driverId,
            orderId,
            amount: parseInt(shippingAmount),
            source: "delivery",
            description: "Delivery service revenue",
            stripeTransferId: transfer.id,
          });
        }
      } catch (err) {
        console.error("Driver transfer failed", err);
      }
    }
  },
  /**
   * List Saved Payment Methods
   */
  async listPaymentMethods(userId: string) {
    const customerId = await this.getOrCreateCustomer(userId);

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
    const customerId = await this.getOrCreateCustomer(userId);

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
