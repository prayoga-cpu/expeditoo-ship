/**
 * Client API for Shipments
 * Typed wrapper for REST API calls
 */

// ========================================
// Types
// ========================================

export interface ShipmentListItem {
  id: string;
  status: string;
  originAddress: string;
  destinationAddress: string;
  scheduledDate: string | null;
  price: number | null;
  packageDescription: string | null;
  listing: {
    id: string;
    title: string;
    image: string | null;
  } | null;
  driver: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  createdAt: string;
}

export interface ShipmentDetail {
  id: string;
  status: string;
  originLat: number;
  originLng: number;
  originAddress: string;
  destinationLat: number;
  destinationLng: number;
  destinationAddress: string;
  packageWeight: number | null;
  packageDimensions: string | null;
  packageDescription: string | null;
  scheduledDate: string | null;
  price: number | null;
  listing: {
    id: string;
    title: string;
    image: string | null;
  } | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  driver: {
    id: string;
    name: string | null;
    image: string | null;
    phone: string | null;
  } | null;
  timeline: Array<{
    status: string;
    timestamp: string;
    description: string;
  }>;
  createdAt: string;
  updatedAt: string;
  isPaymentConfirmed: boolean;
  hasReviewed: boolean;
}

export interface FetchShipmentsParams {
  type?: "incoming" | "outgoing" | "driver" | "available" | "proposals";
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ShipmentsApiResponse {
  success: boolean;
  data: ShipmentListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  error?: string;
}

export interface ShipmentDetailApiResponse {
  success: boolean;
  data: ShipmentDetail;
  error?: string;
}

// ========================================
// API Functions
// ========================================

/**
 * Fetch user's shipments (incoming/outgoing/driver)
 */
export async function fetchShipments(
  params?: FetchShipmentsParams
): Promise<{ data: ShipmentListItem[]; pagination: { total: number } }> {
  const queryParams = new URLSearchParams();

  if (params?.type) {
    // Map frontend type to backend role
    if (params.type === "available") {
      queryParams.set("role", "available");
    } else if (params.type === "driver") {
      queryParams.set("role", "driver");
    } else if (params.type === "proposals") {
      queryParams.set("role", "proposals");
    } else if (params.type === "incoming") {
      queryParams.set("role", "buyer");
    } else if (params.type === "outgoing") {
      queryParams.set("role", "seller");
    } else {
      queryParams.set("role", "sender");
    }
  }

  if (params?.status) queryParams.set("status", params.status);
  if (params?.limit) queryParams.set("limit", params.limit.toString());
  if (params?.offset) queryParams.set("offset", params.offset.toString());

  const url = `/api/shipments${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Please sign in to view shipments");
    }
    throw new Error(`Failed to fetch shipments: ${response.statusText}`);
  }

  const result: ShipmentsApiResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Failed to fetch shipments");
  }

  return {
    data: result.data,
    pagination: result.pagination,
  };
}

/**
 * Fetch single shipment detail
 */
export async function fetchShipmentDetail(id: string): Promise<ShipmentDetail> {
  const response = await fetch(`/api/shipments/${id}`);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Please sign in to view shipment details");
    }
    if (response.status === 403) {
      throw new Error("You don't have permission to view this shipment");
    }
    if (response.status === 404) {
      throw new Error("Shipment not found");
    }
    throw new Error(`Failed to fetch shipment: ${response.statusText}`);
  }

  const result: ShipmentDetailApiResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Failed to fetch shipment");
  }

  return result.data;
}

/**
 * Update shipment status
 */
export async function updateShipmentStatus(
  id: string,
  status: string,
  note?: string
): Promise<ShipmentListItem> {
  const response = await fetch(`/api/shipments/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status, note }),
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || "Failed to update shipment status");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Cancel shipment
 */
export async function cancelShipment(
  id: string,
  reason: string
): Promise<ShipmentListItem> {
  const response = await fetch(`/api/shipments/${id}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || "Failed to cancel shipment");
  }

  const result = await response.json();
  return result.data;
}
