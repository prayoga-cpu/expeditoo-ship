import "dotenv/config";
import { db } from "../src/db";
import { listings } from "../src/db/schema";
import { gt } from "drizzle-orm";

async function main() {
    console.log("🧹 Starting cleanup of recent test data...");

    // Calculate cutoff time (3 hours ago)
    const hoursAgo = 3;
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    console.log(`⏰ Deleting listings created after: ${cutoffTime.toISOString()}`);

    try {
        // Delete listings created after cutoffTime
        // Note: Bids and Images will be deleted automatically via CASCADE
        const result = await db
            .delete(listings)
            .where(gt(listings.createdAt, cutoffTime))
            .returning({ id: listings.id, title: listings.title });

        console.log(`✨ Deleted ${result.length} listings:`);
        result.forEach((l) => console.log(`   - [${l.id}] ${l.title}`));

        console.log("✅ Cleanup complete!");
    } catch (error) {
        console.error("❌ Error running cleanup:", error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

main();
