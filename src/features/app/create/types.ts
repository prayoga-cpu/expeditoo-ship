/**
 * Create feature types
 * Following SOLID principle - centralized type definitions
 */

export interface CreateFormData {
  // Item details
  quantity: string;
  designation: string;
  categoryId: string;
  condition: string;
  knowDimensions: boolean;
  length: string;
  width: string;
  height: string;
  size: string;
  weight: string;

  // Pickup details
  departStreet: string;
  departCity: string;
  departPostalCode: string;
  departCountry: string;
  departLatitude: number | null;
  departLongitude: number | null;

  // Delivery details
  arriveeStreet: string;
  arriveeCity: string;
  arriveePostalCode: string;
  arriveeCountry: string;
  arriveeLatitude: number | null;
  arriveeLongitude: number | null;
  excludeDays: string;
  timeWindow: string;

  // Price details
  price: string;
  travelWithItem: boolean;
  publicInfo: string;

  // Auction details
  isAuction: boolean;
  auctionDuration: string;
  startingBid: string;
  buyNowPrice: string;
}

export type CreateStep = "Item" | "Pickup" | "Price";

export interface CreateFormState {
  currentStep: number;
  photos: string[];
  formData: CreateFormData;
}
