import { config } from "dotenv";
import postgres from "postgres";

config();

async function verifyMigration() {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) throw new Error("POSTGRES_URL required");

    const client = postgres(connectionString, { max: 1 });

    try {
        console.log("🔍 Verifying migration...\n");

        // Check column exists
        const columnInfo = await client`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'conversations' AND column_name = 'type'
    `;

        if (columnInfo.length > 0) {
            console.log("✅ Column 'type' exists in conversations table:");
            console.log("   - Data type:", columnInfo[0].data_type);
            console.log("   - Default:", columnInfo[0].column_default);
            console.log("   - Nullable:", columnInfo[0].is_nullable);
        } else {
            console.log("❌ Column 'type' not found!");
        }

        // Check existing data
        const typeCount = await client`
      SELECT type, COUNT(*) as count
      FROM conversations 
      GROUP BY type
    `;

        console.log("\n📊 Conversation types in database:");
        if (typeCount.length > 0) {
            typeCount.forEach((row) => {
                console.log(`   - ${row["type"]}: ${row["count"]} conversations`);
            });
        } else {
            console.log("   - No conversations in database yet");
        }

        console.log("\n✅ Migration verification complete!");
    } catch (error) {
        console.error("❌ Verification failed:", error);
    } finally {
        await client.end();
    }
}

verifyMigration();
