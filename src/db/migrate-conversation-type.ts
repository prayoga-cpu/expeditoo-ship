import { config } from "dotenv";
import postgres from "postgres";

// Load environment variables
config();

async function runSingleMigration() {
    const connectionString = process.env.POSTGRES_URL;

    if (!connectionString) {
        throw new Error("POSTGRES_URL environment variable is required");
    }

    console.log("🔄 Running single migration: Add conversation type...");

    const client = postgres(connectionString, { max: 1 });

    try {
        // Run the specific migration SQL
        await client`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'LISTING' NOT NULL`;

        console.log("✅ Migration completed successfully!");
        console.log("   - Added 'type' column to conversations table");
        console.log("   - Default value: 'LISTING'");
        console.log("   - All existing conversations are now LISTING type");
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runSingleMigration();
