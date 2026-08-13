import { z } from "zod";

// ========================================
// Create Review DTO
// ========================================

/**
 * A review is always about a completed delivery, so it hangs off the shipment.
 * The listing is derived from it server-side rather than supplied, which keeps
 * the two from ever disagreeing.
 */
export const createReviewSchema = z.object({
  shipmentId: z.string().min(1, "Shipment ID is required"),
  rating: z
    .number()
    .int()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z.string().max(1000).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

// ========================================
// Query DTOs
// ========================================

export const reviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  type: z.enum(["all", "shipper", "carrier"]).optional().default("all"),
});

export type ReviewsQuery = z.infer<typeof reviewsQuerySchema>;

// ========================================
// Output DTOs
// ========================================

export const reviewOutputSchema = z.object({
  id: z.string(),
  rating: z.number(),
  comment: z.string().nullable(), // Optional per API spec
  createdAt: z.date(),
  author: z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  }),
  targetUser: z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  }),
  role: z.enum(["buyer", "seller", "driver", "client"]),
  listing: z
    .object({
      id: z.string(),
      title: z.string(),
    })
    .nullable(),
  shipment: z
    .object({
      id: z.string(),
      code: z.string(), // Assuming shipments have a readable code/ID, using ID for now
    })
    .nullable(),
});

export type ReviewOutput = z.infer<typeof reviewOutputSchema>;

export const reviewStatsSchema = z.object({
  average: z.number(),
  total: z.number(),
  distribution: z.object({
    5: z.number(),
    4: z.number(),
    3: z.number(),
    2: z.number(),
    1: z.number(),
  }),
});

export type ReviewStats = z.infer<typeof reviewStatsSchema>;

// ========================================
// Paginated Response
// ========================================

export const paginatedReviewsSchema = z.object({
  items: z.array(reviewOutputSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export type PaginatedReviews = z.infer<typeof paginatedReviewsSchema>;
