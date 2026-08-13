import { z } from "zod";

export const PlaceBidSchema = z.object({
  amount: z.number().positive("Bid amount must be positive"),
});

export type PlaceBidInput = z.infer<typeof PlaceBidSchema>;

export const AuctionBidSchema = z.object({
  id: z.string(),
  amount: z.number(),
  createdAt: z.date(),
  bidder: z.object({
    id: z.string(),
    name: z.string().nullable(),
    image: z.string().nullable(),
  }),
});

export type AuctionBid = z.infer<typeof AuctionBidSchema>;
