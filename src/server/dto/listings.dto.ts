import { z } from "zod";
import { listingConditionEnum, listingTypeEnum } from "@/db/schema/listings";

// Helper to calculate size based on dimensions
export function calculateSize(
  length: number,
  width: number,
  height: number
): "XS" | "S" | "M" | "L" | "XL" | "XXL" {
  // Calculate volume in cm3
  const volume = length * width * height;

  // Approximate volume thresholds (can be adjusted)
  // XS: Phone/Keys (< 1000 cm3) - e.g. 10x10x10
  if (volume < 1000) return "XS";

  // S: Shoebox (< 5000 cm3) - e.g. 30x20x15 = 9000
  if (volume < 10000) return "S";

  // M: Suitcase (< 60000 cm3) - e.g. 50x40x30 = 60000
  if (volume < 60000) return "M";

  // L: Bicycle/Large Box (< 200000 cm3) - e.g. 100x50x40 = 200000
  if (volume < 200000) return "L";

  // XL: Furniture (< 1000000 cm3) - e.g. 200x100x50 = 1000000
  if (volume < 1000000) return "XL";

  // XXL: Vehicle/Large Furniture
  return "XXL";
}

export const createListingSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10),
  categoryId: z.string(),
  condition: z.enum(listingConditionEnum.enumValues),
  type: z.enum(listingTypeEnum.enumValues),

  // Pricing
  startPrice: z.number().min(0).optional(),
  buyNowPrice: z.number().min(0).optional(),
  auctionDuration: z.string().optional(), // Days as string from select

  // Dimensions
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  weight: z.string(), // "0-5", "5-10", etc.

  // Images
  images: z.array(z.string().url()).min(1),

  // Location
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
    postalCode: z.string(),
  }),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

// Query schema for public listings
export const publicListingsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  category: z.string().optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  sortBy: z
    .enum(["ending_soon", "newest", "price_low", "price_high", "distance"])
    .optional(),
  sizes: z.string().optional(), // Comma-separated: "S,M,L"
  minRating: z.coerce.number().min(0).max(5).optional(),
  minReputation: z.coerce.number().min(0).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().optional(),
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PublicListingsQuery = z.infer<typeof publicListingsQuerySchema>;

// Paginated response schema
export const paginatedResponseSchema = z.object({
  data: z.array(z.any()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasMore: z.boolean(),
  }),
});

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
};

// Schema for updating listing status
export const updateListingStatusSchema = z.object({
  status: z.enum(["ended", "cancelled"]),
});

export type UpdateListingStatusInput = z.infer<
  typeof updateListingStatusSchema
>;

// Schema for reposting a listing
export const repostListingSchema = z.object({
  auctionDuration: z
    .string()
    .refine((val) => ["1", "3", "5", "7", "14", "30"].includes(val), {
      message: "Invalid auction duration",
    }),
});

export type RepostListingInput = z.infer<typeof repostListingSchema>;
