/**
 * Messages feature types
 * Following SOLID principle - centralized type definitions
 */

export interface Message {
  id: string;
  name: string;
  avatar?: string;
  listing: string;
  snippet: string;
  timestamp: string;
  unread: boolean;
  type?: "LISTING" | "SUPPORT"; // Chat type for badge display
}



export interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  sentByMe: boolean;
  readByOther?: boolean; // Read receipt: true if the other person has seen this message
}

export interface Conversation {
  id: string;
  recipient: {
    name: string;
    avatar?: string;
    rating?: number;
    reviewsCount?: number;
  };
  listing: string;
  listingImage?: string;
  messages: ChatMessage[];
}
