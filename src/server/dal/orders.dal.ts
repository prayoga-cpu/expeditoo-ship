import { db } from "@/db";
import {
  orders,
  type InsertOrder,
  type OrderStatusType,
} from "@/db/schema/orders";
import { eq, and, desc, count } from "drizzle-orm";
import { nanoid } from "nanoid";

export const ordersDal = {
  /**
   * Create a new order
   */
  async create(data: Omit<InsertOrder, "id">) {
    const id = nanoid();
    const [result] = await db
      .insert(orders)
      .values({ id, ...data })
      .returning();
    return result;
  },

  /**
   * Get order by ID with all relations
   */
  async getById(id: string) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        buyer: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
        seller: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
        listing: {
          columns: {
            id: true,
            title: true,
            address: true,
            lat: true,
            lng: true,
          },
          with: {
            images: {
              limit: 1,
              orderBy: (images, { asc }) => [asc(images.order)],
            },
          },
        },
        shipment: {
          columns: {
            id: true,
            status: true,
            driverId: true,
            price: true,
          },
          with: {
            driver: {
              columns: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return order;
  },

  /**
   * Get order by listing ID
   */
  async getByListingId(listingId: string) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.listingId, listingId),
      with: {
        buyer: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
        seller: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
        listing: {
          columns: {
            id: true,
            title: true,
            address: true,
            lat: true,
            lng: true,
          },
          with: {
            images: {
              limit: 1,
              orderBy: (images, { asc }) => [asc(images.order)],
            },
          },
        },
        shipment: {
          columns: {
            id: true,
            status: true,
            driverId: true,
            price: true,
            destinationLat: true,
            destinationLng: true,
          },
          with: {
            driver: {
              columns: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });
    return order;
  },

  /**
   * Get order by shipment ID
   */
  async getByShipmentId(shipmentId: string) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.shipmentId, shipmentId),
    });
    return order;
  },

  /**
   * Get orders by buyer ID
   */
  async getByBuyerId(
    buyerId: string,
    filters?: {
      status?: OrderStatusType;
      limit?: number;
      offset?: number;
    }
  ) {
    const { status, limit = 20, offset = 0 } = filters || {};

    let whereCondition = eq(orders.buyerId, buyerId);

    if (status) {
      whereCondition = and(whereCondition, eq(orders.status, status))!;
    }

    const results = await db.query.orders.findMany({
      where: whereCondition,
      with: {
        listing: {
          columns: {
            id: true,
            title: true,
          },
          with: {
            images: {
              limit: 1,
              orderBy: (images, { asc }) => [asc(images.order)],
            },
          },
        },
      },
      orderBy: [desc(orders.createdAt)],
      limit,
      offset,
    });

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(orders)
      .where(whereCondition);

    const data = results.map((order) => ({
      ...order,
      listing: order.listing
        ? {
          id: order.listing.id,
          title: order.listing.title,
          image: order.listing.images?.[0]?.url || null,
        }
        : null,
    }));

    return { data, total };
  },

  /**
   * Update order status
   */
  async updateStatus(id: string, status: OrderStatusType) {
    const [result] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return result;
  },

  /**
   * Set delivery address
   */
  async setDeliveryAddress(
    id: string,
    address: string,
    lat?: string,
    lng?: string
  ) {
    const [result] = await db
      .update(orders)
      .set({
        deliveryAddress: address,
        deliveryLat: lat || null,
        deliveryLng: lng || null,
        status: "pending_proposals",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    return result;
  },

  /**
   * Link shipment to order
   */
  async linkShipment(orderId: string, shipmentId: string) {
    const [result] = await db
      .update(orders)
      .set({
        shipmentId,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();
    return result;
  },

  /**
   * Update shipping price and total
   */
  async updateShippingPrice(id: string, shippingPrice: number) {
    // Get current order to calculate total
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      columns: { itemPrice: true },
    });

    if (!order) return null;

    const totalPrice = order.itemPrice + shippingPrice;

    const [result] = await db
      .update(orders)
      .set({
        shippingPrice,
        totalPrice,
        status: "pending_payment",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    return result;
  },

  /**
   * Confirm payment (mock)
   */
  async confirmPayment(id: string) {
    const [result] = await db
      .update(orders)
      .set({
        status: "paid",
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    return result;
  },

  /**
   * Update order to shipped
   */
  async markShipped(id: string) {
    const [result] = await db
      .update(orders)
      .set({
        status: "shipped",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    return result;
  },

  /**
   * Update order to delivered
   */
  async markDelivered(id: string) {
    const [result] = await db
      .update(orders)
      .set({
        status: "delivered",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    return result;
  },
};
