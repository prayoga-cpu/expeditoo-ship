import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { categories } from "./schema/listings";

config();

async function seed() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("POSTGRES_URL is required");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("🌱 Seeding categories...");

  // What is being moved, not what is being sold. A shipper picks one of
  // these when posting a job, and drivers filter the board by them.
  const categoryData = [
    { id: "furniture_moving", name: "Furniture & moving", slug: "furniture-moving" },
    { id: "appliances", name: "Appliances", slug: "appliances" },
    { id: "pallets_freight", name: "Pallets & freight", slug: "pallets-freight" },
    { id: "construction", name: "Construction materials", slug: "construction-materials" },
    { id: "vehicles", name: "Vehicles", slug: "vehicles" },
    { id: "machinery", name: "Machinery & equipment", slug: "machinery" },
    { id: "fragile_artwork", name: "Fragile & artwork", slug: "fragile-artwork" },
    { id: "documents_parcels", name: "Documents & parcels", slug: "documents-parcels" },
    { id: "refrigerated", name: "Refrigerated", slug: "refrigerated" },
    { id: "bulk_goods", name: "Bulk goods", slug: "bulk-goods" },
    { id: "animals", name: "Animals", slug: "animals" },
    { id: "other", name: "Other", slug: "other" },
  ];

  try {
    await db.insert(categories).values(categoryData).onConflictDoNothing();
    console.log("✅ Categories seeded!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await client.end();
  }
}

seed();
