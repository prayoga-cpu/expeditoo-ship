import "dotenv/config";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔧 Fixing database schema...");

  try {
    // Check if column exists
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='conversation_participants' AND column_name='deleted_at';
    `);

    if (checkResult.length === 0) {
      console.log("  → Adding missing column 'deleted_at'...");
      await db.execute(sql`
        ALTER TABLE "conversation_participants" 
        ADD COLUMN "deleted_at" timestamp;
      `);
      console.log("  ✅ Column added successfully.");
    } else {
      console.log("  ℹ️ Column 'deleted_at' already exists.");
    }
    
    console.log("✨ database fix complete.");
  } catch (error) {
    console.error("❌ Error fixing database:", error);
  }
  
  process.exit(0);
}

main();
