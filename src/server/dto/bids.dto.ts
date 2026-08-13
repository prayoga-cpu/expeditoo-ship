import { z } from "zod";

// Input schema for placing a bid
export const placeBidInput = z.object({
  amount: z.number().int().positive("Bid amount must be positive"),
});

export type PlaceBidInput = z.infer<typeof placeBidInput>;

// Output schema for bid response
export const bidOutput = z.object({
  id: z.string(),
  listingId: z.string(),
  bidderId: z.string(),
  amount: z.number(),
  createdAt: z.date(),
  bidder: z.object({
    id: z.string(),
    name: z.string().nullable(),
    image: z.string().nullable(),
  }),
});

export type BidOutput = z.infer<typeof bidOutput>;
