import { db } from "./index";
import { sql } from "drizzle-orm";
import {
  listings,
  orders,
  shipments,
  bids,
  payments,
  reviews,
  notifications,
  messages,
  conversations,
  shipmentProposals,
  earnings,
} from "./schema";

async function main() {
  console.log("🧹 Cleaning up transactional data...");

  try {
    // Delete in order of dependency (child tables first)

    // 1. Payments & Reviews (Leaf nodes)
    await db.delete(payments);
    console.log("✓ Deleted payments");

    await db.delete(reviews);
    console.log("✓ Deleted reviews");

    await db.delete(notifications);
    console.log("✓ Deleted notifications");

    // 2. Messages
    await db.delete(messages);
    await db.delete(conversations);
    console.log("✓ Deleted messages & conversations");

    // 3. Orders (Depends on Listings, Shipments)
    await db.delete(orders);
    console.log("✓ Deleted orders");

    // 4. Bids (Depends on Listings, Users)
    await db.delete(bids);
    console.log("✓ Deleted bids");

    // 5. Shipment Proposals (Depends on Shipments)
    await db.delete(shipmentProposals);
    console.log("✓ Deleted shipment proposals");

    // 6. Shipments (Depends on Listings, Users)
    await db.delete(shipments);
    console.log("✓ Deleted shipments");

    // 7. Listings (Root of transaction graph)
    await db.delete(listings);
    console.log("✓ Deleted listings");

    // 8. Earnings
    await db.delete(earnings);
    console.log("✓ Deleted earnings");

    console.log("✨ Database cleanup complete! (Users preserved)");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error cleaning database:", error);
    process.exit(1);
  }
}

main();
