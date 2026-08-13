import { db } from "@/db";
import { orders, shipments, payments } from "@/db/schema";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  CreateOrderDTO,
  UpdateOrderDTO,
  OrderListDTO,
  OrderResponseDTO,
  OrderListResponseDTO,
  canSetDeliveryAddress,
  canConfirmPayment,
  SetDeliveryAddressInput,
} from "@/server/dto/orders.dto";
import { ordersDal } from "@/server/dal/orders.dal";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { PRICING_CONFIG } from "@/lib/pricing/config";
import { user } from "@/db/schema/users";
import { stripe } from "@/lib/stripe";
import { notificationsService } from "./notifications.service";
import { emailService } from "./email.service";
import { ablyServer } from "@/lib/ably-server";
import { listings } from "@/db/schema/listings";
import type { OrderStatusEvent } from "@/server/dto/ably-events.dto";
import { stripeService } from "./stripe.service";

// Custom Error Classes
export class OrderNotFoundError extends Error {
  constructor(message = "Order not found") {
    super(message);
    this.name = "OrderNotFoundError";
  }
}

export class OrderAccessDeniedError extends Error {
  constructor(message = "Access denied to this order") {
    super(message);
    this.name = "OrderAccessDeniedError";
  }
}

export class InvalidOrderStateError extends Error {
  constructor(message = "Invalid order state for this operation") {
    super(message);
    this.name = "InvalidOrderStateError";
  }
}

// Helper to publish order status events (Local impl matching previous file)
async function publishOrderStatusChange(
  orderId: string,
  status: string,
  previousStatus?: string,
  message?: string
) {
  const event: OrderStatusEvent = {
    orderId,
    status,
    previousStatus,
    updatedAt: new Date().toISOString(),
    message,
  };
  await ablyServer.publishOrderStatus(orderId, event);
}


// Helper type for the DB result with relations
type OrderWithRelations = NonNullable<Awaited<ReturnType<typeof ordersDal.getById>>>;

function mapOrderToDTO(order: OrderWithRelations): OrderResponseDTO {
  return {
    id: order.id,
    status: order.status,
    listing: {
      id: order.listing.id,
      title: order.listing.title,
      image: order.listing.images?.[0]?.url || null,
    },
    seller: {
      id: order.seller.id,
      name: order.seller.name,
      image: order.seller.image,
    },
    itemPrice: order.itemPrice,
    shippingPrice: order.shippingPrice,
    totalPrice: order.totalPrice,
    deliveryAddress: order.deliveryAddress,
    originAddress: order.listing.address,
    driver: order.shipment?.driver ? {
      id: order.shipment.driver.id,
      name: order.shipment.driver.name,
      image: order.shipment.driver.image,
    } : null,
    shipmentId: order.shipmentId,
    shipmentStatus: order.shipment?.status || null,
    createdAt: order.createdAt,
  };
}

export const ordersService = {
  /**
   * Create order from auction win
   * This is the main entry point when an auction ends with a winner
   */
  async createFromAuctionWin(
    listingId: string,
    buyerId: string,
    sellerId: string,
    winningBidAmount: number // Amount in CENTS
  ): Promise<OrderResponseDTO> {
    const orderId = nanoid();

    await ordersDal.create({
      id: orderId,
      listingId,
      buyerId,
      sellerId,
      itemPrice: winningBidAmount, // Store in cents
      totalPrice: winningBidAmount, // Initial total = item price
      status: "pending_address",
    });

    console.log(
      `[Orders] Created order ${orderId} for listing ${listingId} with itemPrice ${winningBidAmount} cents`
    );

    // Refetch to get full relations for DTO
    const fullOrder = await ordersDal.getById(orderId);
    if (!fullOrder) throw new OrderNotFoundError("Failed to retrieve created order");

    return mapOrderToDTO(fullOrder);
  },

  // Use specific DAL create
  async create(data: Omit<CreateOrderDTO, "id">): Promise<OrderResponseDTO> {
    const newOrder = await ordersDal.create({
      ...data,
      totalPrice: data.itemPrice, // Initial total is just item price
    });
    
    // Refetch to get full relations for DTO
    const fullOrder = await ordersDal.getById(newOrder.id);
    if (!fullOrder) throw new OrderNotFoundError("Failed to retrieve created order");
    
    return mapOrderToDTO(fullOrder);
  },

  // Removed getAll() as it's not supported by DAL
  // Removed update() as it's not supported by DAL (use specific status updates)

  async getById(id: string): Promise<OrderResponseDTO | null> {
    const order = await ordersDal.getById(id);
    return order ? mapOrderToDTO(order) : null;
  },

  async getByListingId(listingId: string): Promise<OrderResponseDTO | null> {
    const order = await ordersDal.getByListingId(listingId);
    if (!order) return null;
    return this.getById(order.id);
  },

  /**
   * Get order by listing ID with access control
   * Used by checkout page to fetch order details
   * Also creates order on-the-fly if user won but order wasn't created
   */
  async getOrderByListingId(
    listingId: string,
    userId: string
  ): Promise<OrderResponseDTO> {
    let order = await ordersDal.getByListingId(listingId);

    // If no order exists, check if user won this auction and create order
    if (!order) {
      // Get listing to check if user won
      const listing = await db.query.listings.findFirst({
        where: eq(listings.id, listingId),
        columns: {
          id: true,
          sellerId: true,
          winnerId: true,
          status: true,
          currentPrice: true,
          startPrice: true,
        },
      });

      if (!listing) {
        throw new OrderNotFoundError(`Listing ${listingId} not found`);
      }

      // Check if this user is the winner
      let isWinner = listing.winnerId === userId;
      let winningAmount = listing.currentPrice || listing.startPrice || 0;

      // Fallback: if winnerId is null but auction is sold, check if user is highest bidder
      if (!isWinner && !listing.winnerId && listing.status === "sold") {
        // Import bidsDal dynamically to avoid circular dependency
        const { bidsDal } = await import("@/server/dal/bids.dal");
        const bids = await bidsDal.getByListingId(listingId);

        if (bids.length > 0) {
          const highestBid = bids[0]; // bids are sorted by amount desc
          if (highestBid.bidderId === userId) {
            isWinner = true;
            winningAmount = highestBid.amount;

            // Also update the listing to set winnerId for future reference
            const { listingsDal } = await import("@/server/dal/listings.dal");
            await listingsDal.updateStatus(
              listingId,
              "sold",
              undefined,
              userId
            );
            console.log(
              `[Orders] Fixed missing winnerId for listing ${listingId}`
            );
          }
        }
      }

      if (!isWinner) {
        throw new OrderAccessDeniedError("You did not win this auction");
      }

      // User won but order wasn't created - create it now
      console.log(
        `[Orders] Creating missing order for listing ${listingId}, winner ${userId}`
      );

      const newOrder = await this.createFromAuctionWin(
        listingId,
        userId,
        listing.sellerId,
        winningAmount
      );

      return newOrder;
    }

    // Check access - must be buyer or seller
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new OrderAccessDeniedError("You don't have access to this order");
    }

    // Ensure we have full DTO
    const fullOrder = await this.getById(order.id);
    if (!fullOrder) throw new OrderNotFoundError("Order found but failed to retrieve details");
    
    return fullOrder;
  },

  async setDeliveryAddress(
    orderId: string,
    address: string,
    userId: string,
    lat?: string, // Changed to string to match DAL
    lng?: string // Changed to string to match DAL
  ): Promise<OrderResponseDTO> {
    const order = await ordersDal.getById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.buyerId !== userId) throw new Error("Unauthorized");

    // Check logic
    if (order.status !== "pending_address") {
      throw new Error("Address already set or invalid status");
    }

    await ordersDal.setDeliveryAddress(
      orderId,
      address,
      lat,
      lng
    );

    // Create shipment automatically
    if (order.listing) {
      const shipment = await shipmentsDal.create({
        userId: order.buyerId,
        listingId: order.listingId,
        status: "PENDING",
        originLat: order.listing.lat || 0,
        originLng: order.listing.lng || 0,
        originAddress: order.listing.address || "Unknown",
        destinationLat: lat ? parseFloat(lat) : 0,
        destinationLng: lng ? parseFloat(lng) : 0,
        destinationAddress: address,
      });

      await shipmentsDal.createEvent({
        shipmentId: shipment.id,
        status: "PENDING",
        actorId: userId,
        actorRole: "buyer",
        note: "Shipment created from auction order",
      });

      await ordersDal.linkShipment(orderId, shipment.id);
    }
    
    // Refetch to get updated status and relations
    const updatedOrder = await ordersDal.getById(orderId);
    if (!updatedOrder) throw new Error("Failed to retrieve updated order");

    await publishOrderStatusChange(
      orderId,
      updatedOrder.status,
      order.status,
      "Delivery address set. Waiting for driver proposals."
    );

    return mapOrderToDTO(updatedOrder);
  },

  async confirmPayment(
    orderId: string,
    userId: string
  ): Promise<OrderResponseDTO> {
    const order = await ordersDal.getById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.buyerId !== userId) throw new Error("Unauthorized");

    if (order.status !== "pending_payment") {
      throw new Error("Order not ready for payment");
    }

    // This handles the status update
    await ordersDal.confirmPayment(orderId);

    // Update shipment status if exists
    if (order.shipmentId) {
      await shipmentsDal.updateStatus(order.shipmentId, "ASSIGNED"); // Or ready for pickup?
    }

    // Refetch
    const updatedOrder = await ordersDal.getById(orderId);
    if (!updatedOrder) throw new Error("Failed to retrieve updated order");

    // Notifications
    await publishOrderStatusChange(
      orderId,
      updatedOrder.status,
      order.status,
      "Payment confirmed! Your item will be picked up soon."
    );

    // In-app notifications
    await notificationsService.createNotification({
      userId: order.sellerId,
      type: "payment_received",
      title: "Payment received!",
      message: "The buyer has paid. The driver will pick up the item soon.",
      data: { resourceId: orderId, resourceType: "order" },
    });

    // Emails
    const [buyerInfo, sellerInfo] = await Promise.all([
      db.query.user.findFirst({
        where: eq(user.id, order.buyerId),
        columns: { email: true, name: true },
      }),
      db.query.user.findFirst({
        where: eq(user.id, order.sellerId),
        columns: { email: true, name: true },
      }),
    ]);

    if (buyerInfo?.email) {
      // Mock email send
      // await emailService.sendPaymentReceiptEmail(...)
    }

    return mapOrderToDTO(updatedOrder);
  },

  // Driver selected handler (logic from previous file)
  async onDriverSelected(orderId: string, shippingPrice: number) {
    // This is usually called by shipment acceptance logic
    await ordersDal.updateShippingPrice(
      orderId,
      shippingPrice
    );
     // Refetch
    const updatedOrder = await ordersDal.getById(orderId);
    return updatedOrder ? mapOrderToDTO(updatedOrder) : null;
  },

  /**
   * Creates a Stripe Payment Intent for the order.
   * If paymentMethodId is provided, confirms payment immediately with saved card.
   */
  async createPaymentIntent(
    orderId: string,
    userId: string,
    paymentMethodId?: string
  ) {
    const order = await ordersDal.getById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.buyerId !== userId) throw new Error("Unauthorized");

    if (!order.totalPrice || order.status !== "pending_payment") {
      throw new Error("Order not ready for payment");
    }

    // Check seller Stripe
    const seller = await db.query.user.findFirst({
      where: eq(user.id, order.sellerId),
      columns: { id: true, stripeAccountId: true, stripeAccountStatus: true },
    });

    if (!seller?.stripeAccountId || seller.stripeAccountStatus !== "active") {
      throw new Error("Seller has not set up payouts via Stripe yet.");
    }

    // Check driver Stripe if applicable
    let driverStripeId: string | undefined;
    if (order.shipmentId) {
      const shipment = await shipmentsDal.getById(order.shipmentId);
      if (shipment?.driverId) {
        const driver = await db.query.user.findFirst({
          where: eq(user.id, shipment.driverId),
          columns: { stripeAccountId: true, stripeAccountStatus: true },
        });
        // We might want to allow driver payment to be pending if platform holds it?
        // But for direct transfer, they need account.
        if (
          driver?.stripeAccountId &&
          driver.stripeAccountStatus === "active"
        ) {
          driverStripeId = driver.stripeAccountId;
        } else {
          // If driver not ready, we can't split payment correctly for them.
          // Throwing error might block flow.
          throw new Error("Driver has not set up payouts via Stripe yet.");
        }
      }
    }

    // Amounts (stored in Cents)
    const itemAmount = order.itemPrice;
    const shippingAmount = order.shippingPrice || 0;

    // Fee Calculation
    const feePercent = PRICING_CONFIG.serviceFeePercent / 100;
    const subtotal = itemAmount + shippingAmount;
    const applicationFee = Math.round(subtotal * feePercent);
    // Total charge is subtotal + fee (User pays fee)
    const totalAmount = subtotal + applicationFee;

    // Get or Create Stripe Customer for Buyer (to enable saving cards)
    const customerId = await stripeService.getOrCreateCustomer(userId);

    // Build PaymentIntent create options
    const paymentIntentOptions: Parameters<
      typeof stripe.paymentIntents.create
    >[0] = {
      amount: totalAmount,
      currency: "eur",
      customer: customerId,
      transfer_group: `order_${orderId}`,
      metadata: {
        orderId,
        buyerId: userId,
        sellerId: seller.id, // Needed for recording earnings
        driverId: order.shipment?.driverId || "", // Needed for recording earnings
        sellerStripeId: seller.stripeAccountId,
        driverStripeId: driverStripeId || "",
        itemAmount: itemAmount.toString(),
        shippingAmount: shippingAmount.toString(),
      },
    };

    // If paymentMethodId provided, confirm immediately with saved card
    if (paymentMethodId) {
      paymentIntentOptions.payment_method = paymentMethodId;
      paymentIntentOptions.confirm = true;
      paymentIntentOptions.off_session = true;
      paymentIntentOptions.return_url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/checkout/success`;
    } else {
      // New card flow - let frontend handle confirmation
      paymentIntentOptions.setup_future_usage = "off_session";
      paymentIntentOptions.payment_method_types = ["card"];
      // paymentIntentOptions.automatic_payment_methods = { enabled: true };
    }

    // Create Payment Intent
    const paymentIntent =
      await stripe.paymentIntents.create(paymentIntentOptions);

    // Save initial payment record
    await db.insert(payments).values({
      id: nanoid(),
      userId,
      listingId: order.listingId,
      stripePaymentIntentId: paymentIntent.id,
      amount: totalAmount,
      currency: "eur",
      status:
        paymentMethodId && paymentIntent.status === "succeeded"
          ? "succeeded"
          : "pending",
      transferGroup: `order_${orderId}`,
      applicationFeeAmount: applicationFee,
    });

    // If payment succeeded with saved card, update order status
    if (paymentMethodId && paymentIntent.status === "succeeded") {
      await ordersDal.confirmPayment(orderId);
      return {
        success: true,
        status: "succeeded",
        totalAmount,
        currency: "eur",
      };
    }

    return {
      clientSecret: paymentIntent.client_secret,
      totalAmount: totalAmount,
      currency: "eur",
    };
  },

  async getBuyerOrders(
    buyerId: string,
    filters?: { status?: any; limit?: number; offset?: number }
  ) {
    return ordersDal.getByBuyerId(buyerId, filters);
  },
};
