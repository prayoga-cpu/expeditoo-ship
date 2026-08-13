import { db } from "@/db";
import {
  shipments,
  shipmentProposals,
  type InsertShipment,
  type ShipmentStatusType,
} from "@/db/schema/shipments";
import { eq, and, or, desc, sql, count } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Parse weight range string from listing (e.g. "0-5", "5-10") to approximate weight number
 * Returns the upper bound of the range as the weight estimate
 */
function parseWeightRange(weightRange: string): number | null {
  if (!weightRange) return null;

  // Try to parse as range (e.g., "0-5", "5-10")
  const rangeMatch = weightRange.match(/(\d+)-(\d+)/);
  if (rangeMatch) {
    const max = parseInt(rangeMatch[2], 10);
    return isNaN(max) ? null : max;
  }

  // Try to parse as single number
  const num = parseInt(weightRange, 10);
  return isNaN(num) ? null : num;
}

export const shipmentsDal = {
  /**
   * Create a new shipment
   */
  async create(data: Omit<InsertShipment, "id">) {
    const id = nanoid();
    const [result] = await db
      .insert(shipments)
      .values({ id, ...data })
      .returning();
    return result;
  },

  /**
   * Get shipment by ID with all relations
   */
  async getById(id: string) {
    const shipment = await db.query.shipments.findFirst({
      where: eq(shipments.id, id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
        driver: {
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
            weight: true,
            length: true,
            width: true,
            height: true,
          },
          with: {
            images: {
              limit: 1,
              orderBy: (images, { asc }) => [asc(images.order)],
            },
          },
        },
      },
    });

    if (!shipment) return null;

    // Build dimensions string from listing if available
    const listingDimensions = shipment.listing?.length && shipment.listing?.width && shipment.listing?.height
      ? `${shipment.listing.length}x${shipment.listing.width}x${shipment.listing.height} cm`
      : null;

    // Use listing weight as fallback, converting from range string to approximate number
    // Listing weight is stored as range like "0-5", "5-10", etc.
    const listingWeight = shipment.listing?.weight
      ? parseWeightRange(shipment.listing.weight)
      : null;

    // Transform listing to include first image, and use listing data as fallback for package details
    return {
      ...shipment,
      // Use shipment's packageWeight if available, otherwise use listing's weight
      packageWeight: shipment.packageWeight ?? listingWeight,
      // Use shipment's packageDimensions if available, otherwise use listing's dimensions
      packageDimensions: shipment.packageDimensions ?? listingDimensions,
      listing: shipment.listing
        ? {
          id: shipment.listing.id,
          title: shipment.listing.title,
          image: shipment.listing.images?.[0]?.url || null,
        }
        : null,
    };
  },

  /**
   * Get available shipments (PENDING status)
   */
  async getAvailableShipments(filters?: { limit?: number; offset?: number }) {
    const { limit = 20, offset = 0 } = filters || {};

    // Only get shipments with PENDING status
    const whereCondition = eq(shipments.status, "PENDING");

    const results = await db.query.shipments.findMany({
      where: whereCondition,
      with: {
        user: {
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
          },
          with: {
            images: {
              limit: 1,
              orderBy: (images, { asc }) => [asc(images.order)],
            },
          },
        },
      },
      orderBy: [desc(shipments.createdAt)],
      limit,
      offset,
    });

    // Get total count
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(shipments)
      .where(whereCondition);

    // Transform results
    const data = results.map((shipment) => ({
      ...shipment,
      listing: shipment.listing
        ? {
          id: shipment.listing.id,
          title: shipment.listing.title,
          image: shipment.listing.images?.[0]?.url || null,
        }
        : null,
    }));

    return { data, total };
  },

  /**
   * Get shipments by user ID (as sender - where user created the shipment)
   * Per API spec, role=sender means shipments created by the user
   */
  async getByUserId(
    userId: string,
    filters?: {
      status?: ShipmentStatusType;
      limit?: number;
      offset?: number;
    }
  ) {
    const { status, limit = 20, offset = 0 } = filters || {};

    // Build where condition - filter by user who created the shipment
    let whereCondition = eq(shipments.userId, userId);

    // Add status filter if provided
    if (status) {
      whereCondition = and(whereCondition, eq(shipments.status, status))!;
    }

    // Get shipments
    const results = await db.query.shipments.findMany({
      where: whereCondition,
      with: {
        driver: {
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
          },
          with: {
            images: {
              limit: 1,
              orderBy: (images, { asc }) => [asc(images.order)],
            },
          },
        },
      },
      orderBy: [desc(shipments.createdAt)],
      limit,
      offset,
    });

    // Get total count
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(shipments)
      .where(whereCondition);

    // Transform results
    const data = results.map((shipment) => ({
      ...shipment,
      listing: shipment.listing
        ? {
          id: shipment.listing.id,
          title: shipment.listing.title,
          image: shipment.listing.images?.[0]?.url || null,
        }
        : null,
    }));

    return { data, total };
  },

  /**
   * Get shipments where the user is the Seller (Auctioneer)
   * Uses explicit SQL to avoid Drizzle ORM column resolution issues in EXISTS
   */
  async getBySellerId(
    sellerId: string,
    filters?: {
      status?: ShipmentStatusType;
      limit?: number;
      offset?: number;
    }
  ) {
    const { status, limit = 20, offset = 0 } = filters || {};

    // Use explicit SQL with proper table/column names to avoid Drizzle resolution issues
    // TODO: Revisit this workaround once Drizzle resolves column resolution issues in EXISTS subqueries.
    // Issue: Drizzle sometimes fails to resolve column names correctly in nested sql`` helpers within subqueries.
    // as of Drizzle Kit v0.20.14+ this might still be flaky in complex WHERE clauses.
    const baseCondition = sql`EXISTS (
      SELECT 1 FROM "listings"
      WHERE "listings"."id" = "shipments"."listing_id"
      AND "listings"."seller_id" = ${sellerId}
    )`;

    const whereCondition = status
      ? and(baseCondition, eq(shipments.status, status))
      : baseCondition;

    const results = await db.query.shipments.findMany({
      where: whereCondition,
      with: {
        driver: {
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
          },
          with: {
            images: {
              limit: 1,
              orderBy: (images, { asc }) => [asc(images.order)],
            },
          },
        },
      },
      orderBy: [desc(shipments.createdAt)],
      limit,
      offset,
    });

    // Get total count using explicit SQL
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(shipments)
      .where(
        and(
          sql`EXISTS (
            SELECT 1 FROM "listings"
            WHERE "listings"."id" = "shipments"."listing_id"
            AND "listings"."seller_id" = ${sellerId}
          )`,
          status ? eq(shipments.status, status) : undefined
        )
      );

    const data = results.map((shipment) => ({
      ...shipment,
      listing: shipment.listing
        ? {
          id: shipment.listing.id,
          title: shipment.listing.title,
          image: shipment.listing.images?.[0]?.url || null,
        }
        : null,
    }));

    return { data, total };
  },

  /**
   * Get shipments where the user is the Buyer (Bidder/Winner)
   * Uses explicit SQL to avoid Drizzle ORM column resolution issues in EXISTS
   */
  async getByBuyerId(
    buyerId: string,
    filters?: {
      status?: ShipmentStatusType;
      limit?: number;
      offset?: number;
    }
  ) {
    const { status, limit = 20, offset = 0 } = filters || {};

    const baseCondition = or(
      // Option 1: Won the listing associated with this shipment
      // TODO: Revisit explicit SQL strings once Drizzle fixes column resolution in subqueries
      sql`EXISTS (
        SELECT 1 FROM "listings"
        WHERE "listings"."id" = "shipments"."listing_id"
        AND "listings"."winner_id" = ${buyerId}
      )`,
      // Option 2: Created the shipment themselves
      eq(shipments.userId, buyerId)
    );

    const whereCondition = status
      ? and(baseCondition, eq(shipments.status, status))
      : baseCondition;

    const results = await db.query.shipments.findMany({
      where: whereCondition,
      with: {
        driver: {
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
          },
          with: {
            images: {
              limit: 1,
              orderBy: (images, { asc }) => [asc(images.order)],
            },
          },
        },
      },
      orderBy: [desc(shipments.createdAt)],
      limit,
      offset,
    });

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(shipments)
      .where(
        and(
          or(
            sql`EXISTS (
              SELECT 1 FROM "listings"
              WHERE "listings"."id" = "shipments"."listing_id"
              AND "listings"."winner_id" = ${buyerId}
            )`,
            eq(shipments.userId, buyerId)
          ),
          status ? eq(shipments.status, status) : undefined
        )
      );

    const data = results.map((shipment) => ({
      ...shipment,
      listing: shipment.listing
        ? {
          id: shipment.listing.id,
          title: shipment.listing.title,
          image: shipment.listing.images?.[0]?.url || null,
        }
        : null,
    }));

    return { data, total };
  },

  /**
   * Get shipments where driver has submitted a proposal
   */
  async getShipmentsByDriverProposals(driverId: string) {
    // Find shipments where this driver has a proposal
    const results = await db.query.shipments.findMany({
      where: (shipments, { exists, and, eq }) =>
        // We want shipments where...
        and(
          // ...there exists a proposal from this driver
          exists(
            db
              .select()
              .from(shipmentProposals)
              .where(
                and(
                  eq(shipmentProposals.shipmentId, shipments.id),
                  eq(shipmentProposals.driverId, driverId)
                )
              )
          )
          // And ideally, exclude ones that are already assigned to this driver (those are in "My Shipments")
          // But maybe we want to see them all? Let's just get all where proposal exists.
          // The UI can filter if needed.
        ),
      with: {
        user: {
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
          },
          with: {
            images: {
              limit: 1,
              orderBy: (images, { asc }) => [asc(images.order)],
            },
          },
        },
      },
      orderBy: [desc(shipments.createdAt)],
    });

    return results.map((shipment) => ({
      ...shipment,
      // Add a flag or proposal info?
      // For now just return the shipment.
      // The UI might want to know the status of the proposal.
      listing: shipment.listing
        ? {
          id: shipment.listing.id,
          title: shipment.listing.title,
          image: shipment.listing.images?.[0]?.url || null,
        }
        : null,
    }));
  },

  /**
   * Get shipments assigned to a driver
   */
  async getByDriverId(
    driverId: string,
    filters?: {
      status?: ShipmentStatusType;
      limit?: number;
      offset?: number;
    }
  ) {
    const { status, limit = 20, offset = 0 } = filters || {};

    let whereCondition = eq(shipments.driverId, driverId);

    if (status) {
      whereCondition = and(whereCondition, eq(shipments.status, status))!;
    }

    const results = await db.query.shipments.findMany({
      where: whereCondition,
      with: {
        user: {
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
          },
          with: {
            images: {
              limit: 1,
              orderBy: (images, { asc }) => [asc(images.order)],
            },
          },
        },
      },
      orderBy: [desc(shipments.createdAt)],
      limit,
      offset,
    });

    // Get total count
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(shipments)
      .where(whereCondition);

    // Transform results
    const data = results.map((shipment) => ({
      ...shipment,
      listing: shipment.listing
        ? {
          id: shipment.listing.id,
          title: shipment.listing.title,
          image: shipment.listing.images?.[0]?.url || null,
        }
        : null,
    }));

    return { data, total };
  },

  /**
   * Update shipment status
   */
  async updateStatus(id: string, status: ShipmentStatusType) {
    const [result] = await db
      .update(shipments)
      .set({ status, updatedAt: new Date() })
      .where(eq(shipments.id, id))
      .returning();
    return result;
  },

  /**
   * Assign driver to shipment
   */
  async assignDriver(id: string, driverId: string, price: number) {
    const [result] = await db
      .update(shipments)
      .set({
        driverId,
        price,
        status: "ASSIGNED",
        updatedAt: new Date(),
      })
      .where(eq(shipments.id, id))
      .returning();
    return result;
  },

  /**
   * Cancel shipment
   */
  async cancel(id: string) {
    const [result] = await db
      .update(shipments)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(shipments.id, id))
      .returning();
    return result;
  },

  /**
   * Get shipment owner (userId) and seller from listing
   */
  async getShipmentOwnership(id: string) {
    const result = await db.query.shipments.findFirst({
      where: eq(shipments.id, id),
      columns: {
        id: true,
        userId: true,
        driverId: true,
        status: true,
      },
      with: {
        listing: {
          columns: {
            sellerId: true,
          },
        },
      },
    });

    if (!result) return null;

    return {
      id: result.id,
      buyerId: result.userId,
      sellerId: result.listing?.sellerId || null,
      driverId: result.driverId,
      status: result.status,
    };
  },

  // ========================================
  // Proposal Methods
  // ========================================

  /**
   * Create a proposal (driver submits price)
   */
  async createProposal(data: {
    shipmentId: string;
    driverId: string;
    price: number;
    estimatedPickup?: Date;
    estimatedDelivery?: Date;
    message?: string;
  }) {
    const id = nanoid();
    const [result] = await db
      .insert(shipmentProposals)
      .values({
        id,
        shipmentId: data.shipmentId,
        driverId: data.driverId,
        price: data.price,
        estimatedPickup: data.estimatedPickup || null,
        estimatedDelivery: data.estimatedDelivery || null,
        message: data.message || null,
        status: "pending",
      })
      .returning();
    return result;
  },

  /**
   * Get proposals for a shipment
   */
  async getProposalsByShipmentId(shipmentId: string) {
    const results = await db.query.shipmentProposals.findMany({
      where: eq(shipmentProposals.shipmentId, shipmentId),
      with: {
        driver: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [desc(shipmentProposals.createdAt)],
    });
    return results;
  },

  /**
   * Get proposal by ID
   */
  async getProposalById(proposalId: string) {
    const result = await db.query.shipmentProposals.findFirst({
      where: eq(shipmentProposals.id, proposalId),
      with: {
        driver: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
        shipment: true,
      },
    });
    return result;
  },

  /**
   * Accept a proposal (assigns driver to shipment)
   */
  async acceptProposal(
    proposalId: string,
    shipmentId: string,
    driverId: string,
    price: number,
    estimatedDelivery?: Date | null
  ) {
    // Update proposal status to accepted
    await db
      .update(shipmentProposals)
      .set({ status: "accepted" })
      .where(eq(shipmentProposals.id, proposalId));

    // Reject all other proposals for this shipment
    await db
      .update(shipmentProposals)
      .set({ status: "rejected" })
      .where(
        and(
          eq(shipmentProposals.shipmentId, shipmentId),
          sql`${shipmentProposals.id} != ${proposalId}`
        )
      );

    // Update shipment with driver, price, and scheduled date from proposal
    const [result] = await db
      .update(shipments)
      .set({
        driverId,
        price,
        status: "ASSIGNED",
        // Use driver's estimated delivery as the scheduled date
        scheduledDate: estimatedDelivery || null,
        updatedAt: new Date(),
      })
      .where(eq(shipments.id, shipmentId))
      .returning();

    return result;
  },

  /**
   * Reject a proposal
   */
  async rejectProposal(proposalId: string) {
    const [result] = await db
      .update(shipmentProposals)
      .set({ status: "rejected" })
      .where(eq(shipmentProposals.id, proposalId))
      .returning();
    return result;
  },

  /**
   * Check if driver already has proposal for shipment
   */
  async hasExistingProposal(shipmentId: string, driverId: string) {
    const result = await db.query.shipmentProposals.findFirst({
      where: and(
        eq(shipmentProposals.shipmentId, shipmentId),
        eq(shipmentProposals.driverId, driverId)
      ),
    });
    return !!result;
  },

  // ========================================
  // Proof of Delivery
  // ========================================

  /**
   * Update proof of delivery
   */
  async updateProofOfDelivery(
    id: string,
    url: string,
    markDelivered: boolean = true
  ) {
    const updateData: Record<string, unknown> = {
      proofOfDeliveryUrl: url,
      updatedAt: new Date(),
    };

    if (markDelivered) {
      updateData.status = "DELIVERED";
      updateData.deliveredAt = new Date();
    }

    const [result] = await db
      .update(shipments)
      .set(updateData)
      .where(eq(shipments.id, id))
      .returning();
    return result;
  },

  // ========================================
  // Shipment Events (Real Timeline)
  // ========================================

  async createEvent(data: {
    shipmentId: string;
    status: ShipmentStatusType;
    previousStatus?: ShipmentStatusType;
    actorId?: string;
    actorRole: "system" | "driver" | "buyer" | "seller" | "admin";
    note?: string;
    metadata?: string; // JSON string
  }) {
    const id = nanoid();
    // Dynamically import shipmentEvents to avoid circular dependency issues if referencing top-level
    // But since it's in the same file/module usually we import at top.
    // For now, assuming you'll add the import at the top.
    const { shipmentEvents } = await import("@/db/schema/shipments");

    const [result] = await db
      .insert(shipmentEvents)
      .values({
        id,
        shipmentId: data.shipmentId,
        status: data.status,
        previousStatus: data.previousStatus,
        actorId: data.actorId,
        actorRole: data.actorRole,
        note: data.note,
        metadata: data.metadata,
      })
      .returning();
    return result;
  },

  async getEventsByShipmentId(shipmentId: string) {
    return await db.query.shipmentEvents.findMany({
      where: (events, { eq }) => eq(events.shipmentId, shipmentId),
      with: {
        actor: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: (events, { asc }) => [asc(events.createdAt)],
    });
  },
};
