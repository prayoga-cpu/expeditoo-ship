import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { listings, listingImages } from "./schema/listings";
import { bids } from "./schema/auctions";
import { user } from "./schema/users";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { addDays, subDays } from "date-fns";

config();

async function seedAuctionStatuses() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("POSTGRES_URL is required");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("🌱 Seeding test auction statuses...");

  try {
    // Find the user by email
    const targetEmail = "prayogadevelopment@gmail.com";
    const users = await db
      .select()
      .from(user)
      .where(eq(user.email, targetEmail));

    if (users.length === 0) {
      console.error(`❌ User with email ${targetEmail} not found!`);
      await client.end();
      return;
    }

    const seller = users[0];
    console.log(`✅ Found user: ${seller.name} (${seller.id})`);

    // Create 4 test listings with different statuses
    const testListings = [
      {
        id: nanoid(),
        title: "🟢 Active Auction - iPhone 15 Pro",
        description:
          "Brand new iPhone 15 Pro Max 256GB in excellent condition. This is an active auction you can bid on. Testing the live bidding feature.",
        status: "active" as const,
        startPrice: 500,
        currentPrice: 550,
        endsAt: addDays(new Date(), 3), // Ends in 3 days
        imageUrl:
          "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800",
      },
      {
        id: nanoid(),
        title: "🔵 Sold Auction - MacBook Pro M3",
        description:
          "MacBook Pro 14-inch M3 Pro chip. This auction was successfully sold to the highest bidder.",
        status: "sold" as const,
        startPrice: 1500,
        currentPrice: 1850, // Final winning bid
        endsAt: subDays(new Date(), 2), // Ended 2 days ago
        imageUrl:
          "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800",
      },
      {
        id: nanoid(),
        title: "⚫ Ended Auction - Vintage Camera",
        description:
          "Vintage Leica M6 film camera. Unfortunately, this auction ended without any bids.",
        status: "ended" as const,
        startPrice: 2000,
        currentPrice: 2000, // No bids, stayed at starting price
        endsAt: subDays(new Date(), 5), // Ended 5 days ago
        imageUrl:
          "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800",
      },
      {
        id: nanoid(),
        title: "🔴 Cancelled Auction - Gaming Console",
        description:
          "PlayStation 5 with extra controller. This auction was cancelled by the seller.",
        status: "cancelled" as const,
        startPrice: 400,
        currentPrice: 400,
        endsAt: subDays(new Date(), 1), // Was supposed to end yesterday
        imageUrl:
          "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800",
      },
    ];

    // Insert listings
    for (const listing of testListings) {
      console.log(`  📦 Creating: ${listing.title}`);

      await db
        .insert(listings)
        .values({
          id: listing.id,
          sellerId: seller.id,
          title: listing.title,
          description: listing.description,
          categoryId: "electronics",
          condition: "used_like_new",
          type: "auction",
          status: listing.status,
          startPrice: listing.startPrice,
          currentPrice: listing.currentPrice,
          length: 30,
          width: 20,
          height: 10,
          weight: "0-5",
          size: "S",
          lat: 48.8566,
          lng: 2.3522,
          address: "123 Test Street",
          city: "Paris",
          endsAt: listing.endsAt,
        })
        .onConflictDoNothing();

      // Add image
      await db
        .insert(listingImages)
        .values({
          id: nanoid(),
          listingId: listing.id,
          url: listing.imageUrl,
          order: 0,
        })
        .onConflictDoNothing();
    }

    // Add bids only to "sold" listing
    const soldListing = testListings.find((l) => l.status === "sold");
    if (soldListing) {
      console.log(`  🎯 Adding bids to sold auction...`);

      // Create mock bidder data
      const mockBids = [
        { amount: 1850, time: subDays(new Date(), 2) }, // Winning bid
        { amount: 1750, time: subDays(new Date(), 3) },
        { amount: 1600, time: subDays(new Date(), 4) },
        { amount: 1550, time: subDays(new Date(), 5) },
      ];

      for (const bid of mockBids) {
        await db
          .insert(bids)
          .values({
            id: nanoid(),
            listingId: soldListing.id,
            bidderId: seller.id, // Using same user for simplicity
            amount: bid.amount,
            createdAt: bid.time,
          })
          .onConflictDoNothing();
      }
    }

    console.log("\n✅ Seed complete! Created 4 test listings:");
    console.log("  - 🟢 Active auction (can bid)");
    console.log("  - 🔵 Sold auction (with winner)");
    console.log("  - ⚫ Ended auction (no bids)");
    console.log("  - 🔴 Cancelled auction");
    console.log("\n📍 Navigate to /listing/<id> to view each status.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await client.end();
  }
}

seedAuctionStatuses();
