/**
 * Ably Types for Expeditoo
 * Provides proper typing for Ably real-time channels and messages
 */

// Generic Ably message structure matched with SDK InboundMessage
export interface AblyMessage<T = unknown> {
    id?: string;
    name?: string;
    data?: T;
    timestamp?: number;
    clientId?: string;
    connectionId?: string;
    encoding?: string;
    extras?: Record<string, unknown>;
}

// Callback type for message handlers
export type AblyMessageCallback<T = unknown> = (message: AblyMessage<T>) => void;

// Ably channel interface (compatible wrapper)
// Using function signatures that match Ably SDK patterns
export interface AblyRealtimeChannel {
    name: string;
    subscribe(callback: AblyMessageCallback): void;
    subscribe(event: string, callback: AblyMessageCallback): void;
    unsubscribe(callback?: AblyMessageCallback): void;
    unsubscribe(event?: string, callback?: AblyMessageCallback): void;
    publish(event: string, data: unknown): Promise<void>;
    // Allow dynamic access for SDK compatibility
    [key: string]: unknown;
}

// Subscription reference for hooks
export interface AblySubscriptionRef {
    channel: AblyRealtimeChannel | null;
    handler?: (message: AblyMessage) => void;
    handlers?: Array<{ event: string; handler: (message: AblyMessage) => void }>;
}

export interface AblyMultiSubscriptionRef {
    channel: AblyRealtimeChannel | null;
    handlers: Array<{ event: string; handler: (message: AblyMessage) => void }>;
}

// Specific message data types for different features

// Messages feature
export interface NewMessageData {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    createdAt: string;
    senderName?: string;
    senderImage?: string;
}

// Notifications feature
export interface NewNotificationData {
    id: string;
    type: string;
    title: string;
    message: string;
    createdAt?: string;
}

// Auction outbid notification
export interface OutbidData {
    listingId: string;
    newAmount: number;
    bidderId: string;
    bidderName?: string;
}

// New bid notification
export interface NewBidData {
    listingId: string;
    amount: number;
    bidderId: string;
    bidderName?: string;
}

// Order/Shipment status update
export interface OrderStatusData {
    orderId: string;
    status: string;
    shipmentId?: string;
    driverId?: string;
}

// Message badge context type
export interface MessageBadgeHandler {
    (message: AblyMessage<NewMessageData>): void;
}
