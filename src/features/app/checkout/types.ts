/**
 * Checkout feature types
 * Following SOLID principle - centralized type definitions
 */

export type PaymentMethod = "card" | "paypal" | "bank_transfer";

export interface CheckoutItem {
  id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
}

export interface CheckoutSummary {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}

export interface CheckoutFormData {
  // Shipping address
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  
  // Payment
  paymentMethod: PaymentMethod;
  
  // Card details (if payment method is card)
  cardNumber?: string;
  cardExpiry?: string;
  cardCVC?: string;
  cardName?: string;
}
