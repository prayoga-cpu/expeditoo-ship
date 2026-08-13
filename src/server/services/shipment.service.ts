import { shipmentsDal } from "@/server/dal/shipments.dal";
import { notificationsService } from "@/server/services/notifications.service";
import { ordersDal } from "@/server/dal/orders.dal";
import * as usersDal from "@/server/dal/users.dal";
import { reviewsDal } from "@/server/dal/reviews.dal";
import { ablyServer } from "@/lib/ably-server";
import {
  type CreateShipmentInternal,
  type ShipmentStatusType,
  type GetShipmentsQuery,
  isValidStatusTransition,
  canCancelShipment,
  getStatusLabel,
} from "@/server/dto/shipment.dto";

// ========================================
// Service Errors
// ========================================

export class ShipmentNotFoundError extends Error {
  constructor(id: string) {
    super(`Shipment not found: ${id}`);
    this.name = "ShipmentNotFoundError";
  }
}

export class ShipmentAccessDeniedError extends Error {
  constructor() {
    super("You do not have permission to access this shipment");
    this.name = "ShipmentAccessDeniedError";
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(current: string, next: string) {
    super(`Invalid status transition: ${current} → ${next}`);
    this.name = "InvalidStatusTransitionError";
  }
}

export class CannotCancelShipmentError extends Error {
  constructor(status: string) {
    super(`Cannot cancel shipment: already ${status.toLowerCase()}`);
    this.name = "CannotCancelShipmentError";
  }
}

export class ProposalNotFoundError extends Error {
  constructor(id: string) {
    super(`Proposal not found: ${id}`);
    this.name = "ProposalNotFoundError";
  }
}

export class ProposalAlreadyExistsError extends Error {
  constructor() {
    super("You have already submitted a proposal for this shipment");
    this.name = "ProposalAlreadyExistsError";
  }
}

export class CannotUploadPODError extends Error {
  constructor(status: string) {
    super(
      `Cannot upload proof of delivery: shipment status is ${status.toLowerCase()}`
    );
    this.name = "CannotUploadPODError";
  }
}

export class PaymentRequiredError extends Error {
  constructor() {
    super("Cannot pick up: payment has not been confirmed yet");
    this.name = "PaymentRequiredError";
  }
}

// ========================================
// Service Implementation
// ========================================

export const shipmentService = {
  /**
   * Create a new shipment
   * Note: Input should already be transformed from API format to internal format
   */
  async createShipment(userId: string, data: CreateShipmentInternal) {
    const shipment = await shipmentsDal.create({
      userId,
      listingId: data.listingId || null,
      status: "PENDING",

      // Locations
      originLat: data.originLat,
      originLng: data.originLng,
      originAddress: data.originAddress,
      destinationLat: data.destinationLat,
      destinationLng: data.destinationLng,
      destinationAddress: data.destinationAddress,

      // Package details
      packageWeight: data.packageWeight || null,
      packageDimensions: data.packageDimensions || null,
      packageDescription: data.packageDescription || null,

      // Scheduling
      scheduledDate: data.scheduledDate || null,
    });

    // Create initial event
    await shipmentsDal.createEvent({
      shipmentId: shipment.id,
      status: "PENDING",
      actorId: userId,
      actorRole: "buyer", // Or system if auto-created? Assume buyer for now.
      note: "Shipment created",
    });

    return shipment;
  },

  /**
   * Get shipment detail with authorization check
   */
  async getShipmentDetail(shipmentId: string, userId: string) {
    // Check ownership first
    const ownership = await shipmentsDal.getShipmentOwnership(shipmentId);

    if (!ownership) {
      throw new ShipmentNotFoundError(shipmentId);
    }

    // User must be buyer, seller, or assigned driver
    let isAuthorized =
      ownership.buyerId === userId ||
      ownership.sellerId === userId ||
      ownership.driverId === userId;

    // If not authorized by ownership, check if it's a pending shipment and user is a transporter
    // This allows drivers to view details to make a proposal
    if (!isAuthorized && ownership.status === "PENDING") {
      const isTransporter = await usersDal.userHasRole(userId, "transporter");
      if (isTransporter) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new ShipmentAccessDeniedError();
    }

    // Get full shipment detail
    const shipment = await shipmentsDal.getById(shipmentId);

    if (!shipment) {
      throw new ShipmentNotFoundError(shipmentId);
    }

    // Build timeline from shipment status history
    // For now, we'll create a simple timeline based on current status
    const timeline = await buildTimelineFromEvents(shipmentId, shipment);

    // Check payment status from order
    const order = await ordersDal.getByShipmentId(shipmentId);
    const isPaymentConfirmed =
      order?.status === "paid" ||
      order?.status === "shipped" ||
      order?.status === "delivered";

    // Check if user has already reviewed for this shipment
    let hasReviewed = false;
    if (shipment.status === "DELIVERED") {
      hasReviewed = await reviewsDal.checkExists(userId, undefined, shipmentId);
    }

    return {
      ...shipment,
      isPaymentConfirmed,
      timeline,
      hasReviewed,
    };
  },

  /**
   * Get user's shipments based on role
   * Per API spec: role can be "driver" or "sender"
   */
  async getUserShipments(userId: string, query: GetShipmentsQuery) {
    const { role, status, limit, offset } = query;

    // Handle driver role - get shipments where user is the driver
    if (role === "driver") {
      const { data, total } = await shipmentsDal.getByDriverId(userId, {
        status,
        limit,
        offset,
      });

      return {
        data,
        pagination: { total, limit, offset },
      };
    }

    // Handle available role - get pending shipments for drivers to pick up
    if (role === "available") {
      const { data, total } = await shipmentsDal.getAvailableShipments({
        limit,
        offset,
      });

      return {
        data,
        pagination: { total, limit, offset },
      };
    }

    // Handle proposals role - get shipments where driver has submitted a proposal
    if (role === "proposals") {
      const data = await shipmentsDal.getShipmentsByDriverProposals(userId);
      return {
        data,
        pagination: { total: data.length, limit, offset },
      };
    }

    // Handle seller role - get shipments for items sold by user
    if (role === "seller") {
      const { data, total } = await shipmentsDal.getBySellerId(userId, {
        status,
        limit,
        offset,
      });

      return {
        data,
        pagination: { total, limit, offset },
      };
    }

    // Handle buyer role - get shipments for items bought by user
    if (role === "buyer") {
      const { data, total } = await shipmentsDal.getByBuyerId(userId, {
        status,
        limit,
        offset,
      });

      return {
        data,
        pagination: { total, limit, offset },
      };
    }

    // Default: Get user shipments as sender (where user created/owns the shipment)
    const { data, total } = await shipmentsDal.getByUserId(userId, {
      status,
      limit,
      offset,
    });

    return {
      data,
      pagination: { total, limit, offset },
    };
  },

  /**
   * Update shipment status with validation
   */
  async updateStatus(
    shipmentId: string,
    userId: string,
    newStatus: ShipmentStatusType,
    isAdmin: boolean = false
  ) {
    // Get current shipment
    const ownership = await shipmentsDal.getShipmentOwnership(shipmentId);

    if (!ownership) {
      throw new ShipmentNotFoundError(shipmentId);
    }

    const currentStatus = ownership.status;

    // Check authorization (driver or admin only for status updates)
    const isDriver = ownership.driverId === userId;

    if (!isDriver && !isAdmin) {
      throw new ShipmentAccessDeniedError();
    }

    // Validate status transition
    if (!isValidStatusTransition(currentStatus, newStatus)) {
      throw new InvalidStatusTransitionError(currentStatus, newStatus);
    }

    // CRITICAL: Check payment status before allowing pickup
    // CRITICAL: Check payment status before allowing pickup
    // Driver cannot pick up if buyer hasn't paid
    if (newStatus === "PICKED_UP" || newStatus === "IN_TRANSIT") {
      const order = await ordersDal.getByShipmentId(shipmentId);
      if (
        order &&
        order.status !== "paid" &&
        order.status !== "shipped" &&
        order.status !== "delivered"
      ) {
        throw new PaymentRequiredError();
      }
    }

    // Update status
    const updated = await shipmentsDal.updateStatus(shipmentId, newStatus);

    // If marking as picked up, also update order status to shipped
    if (newStatus === "PICKED_UP") {
      const order = await ordersDal.getByShipmentId(shipmentId);
      if (order && order.status === "paid") {
        await ordersDal.markShipped(order.id);
      }
    }

    // If marking as delivered, also update order status to delivered
    if (newStatus === "DELIVERED") {
      const order = await ordersDal.getByShipmentId(shipmentId);
      if (order && (order.status === "paid" || order.status === "shipped")) {
        await ordersDal.markDelivered(order.id);
      }
    }

    // Record Event
    await shipmentsDal.createEvent({
      shipmentId,
      status: newStatus,
      previousStatus: currentStatus,
      actorId: userId,
      actorRole: isDriver ? "driver" : isAdmin ? "admin" : "buyer", // Simplification
    });

    return updated;
  },

  /**
   * Assign driver to shipment
   */
  async assignDriver(
    shipmentId: string,
    driverId: string,
    price: number,
    userId: string,
    isAdmin: boolean = false
  ) {
    // Get current shipment
    const ownership = await shipmentsDal.getShipmentOwnership(shipmentId);

    if (!ownership) {
      throw new ShipmentNotFoundError(shipmentId);
    }

    // Only admin or system can assign driver
    if (!isAdmin) {
      throw new ShipmentAccessDeniedError();
    }

    // Can only assign if status is PENDING or PRICE_PROPOSED
    if (!["PENDING", "PRICE_PROPOSED"].includes(ownership.status)) {
      throw new InvalidStatusTransitionError(ownership.status, "ASSIGNED");
    }

    // Assign driver
    const updated = await shipmentsDal.assignDriver(
      shipmentId,
      driverId,
      price
    );

    // Record Event
    await shipmentsDal.createEvent({
      shipmentId,
      status: "ASSIGNED",
      previousStatus: ownership.status,
      actorId: userId,
      actorRole: isAdmin ? "admin" : "system",
      note: `Assigned to driver ${driverId} (manual assignment)`,
    });

    return updated;
  },

  /**
   * Cancel shipment
   */
  async cancelShipment(
    shipmentId: string,
    userId: string,
    reason: string,
    isAdmin: boolean = false
  ) {
    // Get current shipment
    const ownership = await shipmentsDal.getShipmentOwnership(shipmentId);

    if (!ownership) {
      throw new ShipmentNotFoundError(shipmentId);
    }

    // Check authorization (buyer, seller, or admin)
    const isOwner =
      ownership.buyerId === userId || ownership.sellerId === userId;

    if (!isOwner && !isAdmin) {
      throw new ShipmentAccessDeniedError();
    }

    // Check if can cancel
    if (!canCancelShipment(ownership.status)) {
      throw new CannotCancelShipmentError(ownership.status);
    }

    // Cancel shipment
    const updated = await shipmentsDal.cancel(shipmentId);

    // Record Event
    await shipmentsDal.createEvent({
      shipmentId,
      status: "CANCELLED",
      previousStatus: ownership.status,
      actorId: userId,
      actorRole: isAdmin
        ? "admin"
        : ownership.sellerId === userId
          ? "seller"
          : "buyer",
      note: reason,
    });

    // Send notifications to affected parties
    const isBuyerCancelling = ownership.buyerId === userId;
    const isSellerCancelling = ownership.sellerId === userId;

    // Notify driver if assigned
    if (ownership.driverId) {
      try {
        await notificationsService.createNotification({
          userId: ownership.driverId,
          type: "delivery",
          title: "Shipment Cancelled",
          message: "A shipment you were assigned to has been cancelled.",
          data: { resourceId: shipmentId, resourceType: "shipment" },
        });
      } catch (error) {
        console.error("Failed to send notification to driver:", error);
      }
    }

    // Notify buyer if seller cancelled
    if (isSellerCancelling && ownership.buyerId) {
      try {
        await notificationsService.createNotification({
          userId: ownership.buyerId,
          type: "delivery",
          title: "Shipment Cancelled",
          message: "The seller has cancelled the shipment.",
          data: { resourceId: shipmentId, resourceType: "shipment" },
        });
      } catch (error) {
        console.error("Failed to send notification to buyer:", error);
      }
    }

    // Notify seller if buyer cancelled
    if (isBuyerCancelling && ownership.sellerId) {
      try {
        await notificationsService.createNotification({
          userId: ownership.sellerId,
          type: "delivery",
          title: "Shipment Cancelled",
          message: "The buyer has cancelled the shipment.",
          data: { resourceId: shipmentId, resourceType: "shipment" },
        });
      } catch (error) {
        console.error("Failed to send notification to seller:", error);
      }
    }

    return updated;
  },

  // ========================================
  // Proposal Methods
  // ========================================

  /**
   * Create a proposal (driver submits price)
   */
  async createProposal(
    shipmentId: string,
    driverId: string,
    data: {
      price: number;
      estimatedPickup?: Date;
      estimatedDelivery?: Date;
      message?: string;
    }
  ) {
    // Get current shipment
    const ownership = await shipmentsDal.getShipmentOwnership(shipmentId);

    if (!ownership) {
      throw new ShipmentNotFoundError(shipmentId);
    }

    // Can only create proposal for PENDING shipments
    if (ownership.status !== "PENDING") {
      throw new InvalidStatusTransitionError(ownership.status, "proposal");
    }

    // Check if driver already has a proposal
    const hasProposal = await shipmentsDal.hasExistingProposal(
      shipmentId,
      driverId
    );
    if (hasProposal) {
      throw new ProposalAlreadyExistsError();
    }

    // Create proposal
    const proposal = await shipmentsDal.createProposal({
      shipmentId,
      driverId,
      price: data.price,
      estimatedPickup: data.estimatedPickup,
      estimatedDelivery: data.estimatedDelivery,
      message: data.message,
    });

    // NOTE: We do NOT notify buyer/seller about new proposals
    // because only Admin can accept proposals (per docs/overview.md).
    // Buyer/Seller will receive notification when Admin accepts a proposal.
    // This prevents unnecessary notification spam.

    return proposal;
  },

  /**
   * Get shipments where driver has submitted proposals
   */
  async getDriverProposals(userId: string) {
    const shipments = await shipmentsDal.getShipmentsByDriverProposals(userId);
    return shipments;
  },

  /**
   * Get proposals for a shipment
   */
  async getProposals(shipmentId: string, userId: string, isAdmin: boolean = false) {
    // Get current shipment to check authorization
    const ownership = await shipmentsDal.getShipmentOwnership(shipmentId);

    if (!ownership) {
      throw new ShipmentNotFoundError(shipmentId);
    }

    // Only shipment owner or admin can see proposals
    const isOwner =
      ownership.buyerId === userId || ownership.sellerId === userId;
    if (!isOwner && !isAdmin) {
      throw new ShipmentAccessDeniedError();
    }

    const proposals = await shipmentsDal.getProposalsByShipmentId(shipmentId);
    return proposals;
  },

  /**
   * Accept a proposal (ADMIN ONLY)
   * Per docs/overview.md: "Admin/Operator selects the best proposal"
   * Buyer/Seller cannot accept proposals directly - admin decides
   *
   * This function handles ALL logic for accepting a proposal:
   * 1. Update shipment status to ASSIGNED
   * 2. Update order with shipping price and status to pending_payment
   * 3. Record event in shipment timeline
   * 4. Notify all parties (driver, buyer, seller)
   */
  async acceptProposal(proposalId: string, adminId: string) {
    // Get proposal with shipment
    const proposal = await shipmentsDal.getProposalById(proposalId);

    if (!proposal) {
      throw new ProposalNotFoundError(proposalId);
    }

    // Get shipment ownership (for notifications later)
    const ownership = await shipmentsDal.getShipmentOwnership(
      proposal.shipmentId
    );

    if (!ownership) {
      throw new ShipmentNotFoundError(proposal.shipmentId);
    }

    // Can only accept if shipment is still PENDING
    if (ownership.status !== "PENDING") {
      throw new InvalidStatusTransitionError(ownership.status, "ASSIGNED");
    }

    // Accept proposal and use driver's estimatedDelivery as scheduled date
    const shipment = await shipmentsDal.acceptProposal(
      proposalId,
      proposal.shipmentId,
      proposal.driverId,
      proposal.price,
      proposal.estimatedDelivery
    );

    // Update order with shipping price and change status to pending_payment
    if (shipment.listingId) {
      const order = await ordersDal.getByListingId(shipment.listingId);
      if (order) {
        await ordersDal.updateShippingPrice(order.id, proposal.price);
      }
    }

    // Record Event - always admin since only admin can accept
    await shipmentsDal.createEvent({
      shipmentId: proposal.shipmentId,
      status: "ASSIGNED",
      previousStatus: ownership.status,
      actorId: adminId,
      actorRole: "admin",
      note: `Admin accepted proposal from driver. Price: €${(proposal.price / 100).toFixed(2)}`,
    });

    // Notify the accepted driver
    try {
      // 1. Data Update (Refresh Dashboard)
      await ablyServer.publishDataUpdate(proposal.driverId, {
        type: "shipment",
        resourceId: proposal.shipmentId,
      });

      // 2. Notification
      await notificationsService.createNotification({
        userId: proposal.driverId,
        type: "delivery",
        title: "Proposal Accepted! 🎉",
        message: "Your proposal has been accepted. Please proceed with pickup.",
        data: { resourceId: proposal.shipmentId, resourceType: "shipment" },
      });
    } catch (error) {
      console.error(
        "Failed to send notification/data to accepted driver:",
        error
      );
    }

    // Notify other drivers with rejected proposals
    try {
      const allProposals = await shipmentsDal.getProposalsByShipmentId(
        proposal.shipmentId
      );
      const rejectedProposals = allProposals.filter(
        (p) => p.id !== proposalId && p.status === "rejected"
      );

      for (const rejected of rejectedProposals) {
        try {
          // 1. Data Update (Refresh Proposal List)
          await ablyServer.publishDataUpdate(rejected.driverId, {
            type: "proposal",
          });

          // 2. Notification
          await notificationsService.createNotification({
            userId: rejected.driverId,
            type: "delivery",
            title: "Proposal Not Selected",
            message: "Another driver was selected for this shipment.",
            data: { resourceId: proposal.shipmentId, resourceType: "shipment" },
          });
        } catch (error) {
          console.error(
            "Failed to send notification to rejected driver:",
            error
          );
        }
      }
    } catch (error) {
      console.error("Failed to notify rejected drivers:", error);
    }

    // Notify buyer that driver has been assigned
    if (ownership.buyerId) {
      try {
        // 1. Data Update
        await ablyServer.publishDataUpdate(ownership.buyerId, {
          type: "shipment",
          resourceId: proposal.shipmentId,
        });
        await ablyServer.publishDataUpdate(ownership.buyerId, {
          type: "order",
        }); // Also update order status

        // 2. Notification
        await notificationsService.createNotification({
          userId: ownership.buyerId,
          type: "delivery",
          title: "Driver Assigned! 🚚",
          message: `A driver has been assigned to your shipment. Price: €${(proposal.price / 100).toFixed(2)}. Please proceed to payment.`,
          data: { resourceId: proposal.shipmentId, resourceType: "shipment" },
        });
      } catch (error) {
        console.error("Failed to send notification to buyer:", error);
      }
    }

    // Notify seller that driver has been assigned
    if (ownership.sellerId && ownership.sellerId !== ownership.buyerId) {
      try {
        // 1. Data Update
        await ablyServer.publishDataUpdate(ownership.sellerId, {
          type: "shipment",
          resourceId: proposal.shipmentId,
        });

        // 2. Notification
        await notificationsService.createNotification({
          userId: ownership.sellerId,
          type: "delivery",
          title: "Driver Assigned for Your Item",
          message: `A driver has been assigned to pick up your item. Price: €${(proposal.price / 100).toFixed(2)}.`,
          data: { resourceId: proposal.shipmentId, resourceType: "shipment" },
        });
      } catch (error) {
        console.error("Failed to send notification to seller:", error);
      }
    }

    return shipment;
  },

  /**
   * Upload proof of delivery
   */
  async uploadProofOfDelivery(
    shipmentId: string,
    driverId: string,
    proofUrl: string,
    markDelivered: boolean = true
  ) {
    // Get current shipment
    const ownership = await shipmentsDal.getShipmentOwnership(shipmentId);

    if (!ownership) {
      throw new ShipmentNotFoundError(shipmentId);
    }

    // Only assigned driver can upload POD
    if (ownership.driverId !== driverId) {
      throw new ShipmentAccessDeniedError();
    }

    // Can only upload POD if status is IN_TRANSIT or DELIVERED
    if (!["IN_TRANSIT", "DELIVERED", "PICKED_UP"].includes(ownership.status)) {
      throw new CannotUploadPODError(ownership.status);
    }

    // Update with proof of delivery
    const updated = await shipmentsDal.updateProofOfDelivery(
      shipmentId,
      proofUrl,
      markDelivered
    );

    // If marking as delivered, also update order status
    if (markDelivered) {
      const order = await ordersDal.getByShipmentId(shipmentId);
      if (order && (order.status === "paid" || order.status === "shipped")) {
        await ordersDal.markDelivered(order.id);
      }
    }

    // Record Event
    await shipmentsDal.createEvent({
      shipmentId,
      status: markDelivered ? "DELIVERED" : ownership.status, // Might just be update POD
      previousStatus: ownership.status,
      actorId: driverId,
      actorRole: "driver",
      note: "Proof of delivery uploaded",
      metadata: JSON.stringify({ proofUrl }),
    });

    // Notify buyer
    if (ownership.buyerId) {
      try {
        await notificationsService.createNotification({
          userId: ownership.buyerId,
          type: "delivery",
          title: "Delivery Confirmed! ✅",
          message:
            "Your package has been delivered. Review the proof of delivery.",
          data: { resourceId: shipmentId, resourceType: "shipment" },
        });
      } catch (error) {
        console.error("Failed to send notification to buyer:", error);
      }
    }

    // Notify seller
    if (ownership.sellerId) {
      try {
        await notificationsService.createNotification({
          userId: ownership.sellerId,
          type: "delivery",
          title: "Delivery Confirmed! ✅",
          message: "The package has been delivered successfully.",
          data: { resourceId: shipmentId, resourceType: "shipment" },
        });
      } catch (error) {
        console.error("Failed to send notification to seller:", error);
      }
    }

    return updated;
  },
};

// ========================================
// Helper Functions
// ========================================

/**
 * Build timeline from actual database events
 * Falls back to legacy mock timeline if no events exist
 */
async function buildTimelineFromEvents(
  shipmentId: string,
  shipmentSnapshot: { status: ShipmentStatusType; createdAt: Date }
) {
  const events = await shipmentsDal.getEventsByShipmentId(shipmentId);

  // Fallback for legacy shipments (no events yet)
  if (events.length === 0) {
    return buildLegacyTimeline(
      shipmentSnapshot.status,
      shipmentSnapshot.createdAt
    );
  }

  return events.map((event) => ({
    status: event.status,
    timestamp: event.createdAt,
    description: getStatusLabel(event.status),
    actor: event.actor
      ? {
        id: event.actor.id,
        name: event.actor.name,
        image: event.actor.image,
        role: event.actorRole,
      }
      : undefined,
    note: event.note || undefined,
    metadata: event.metadata
      ? (JSON.parse(event.metadata) as Record<string, unknown>)
      : undefined,
  }));
}

/**
 * Legacy mocked timeline for backward compatibility
 */
function buildLegacyTimeline(
  currentStatus: ShipmentStatusType,
  createdAt: Date
): Array<{
  status: ShipmentStatusType;
  timestamp: Date;
  description: string;
}> {
  const statusOrder: ShipmentStatusType[] = [
    "PENDING",
    "PRICE_PROPOSED",
    "ASSIGNED",
    "PICKED_UP",
    "IN_TRANSIT",
    "DELIVERED",
  ];

  // Handle cancelled separately
  if (currentStatus === "CANCELLED") {
    return [
      {
        status: "PENDING",
        timestamp: createdAt,
        description: getStatusLabel("PENDING"),
      },
      {
        status: "CANCELLED",
        timestamp: new Date(),
        description: getStatusLabel("CANCELLED"),
      },
    ];
  }

  const currentIndex = statusOrder.indexOf(currentStatus);
  const timeline: Array<{
    status: ShipmentStatusType;
    timestamp: Date;
    description: string;
  }> = [];

  // Add all statuses up to current
  for (let i = 0; i <= currentIndex; i++) {
    const status = statusOrder[i];
    // For simplicity, use createdAt for first, and approximate dates for others
    const timestamp = new Date(createdAt);
    timestamp.setHours(timestamp.getHours() + i); // Add 1 hour per status as placeholder

    timeline.push({
      status,
      timestamp,
      description: getStatusLabel(status),
    });
  }

  return timeline;
}
