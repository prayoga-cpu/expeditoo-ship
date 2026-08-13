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

  const categoryData = [
    { id: "electronics", name: "Electronics", slug: "electronics" },
    { id: "furniture", name: "Furniture", slug: "furniture" },
    { id: "clothing", name: "Clothing", slug: "clothing" },
    { id: "vehicles", name: "Vehicles", slug: "vehicles" },
    { id: "others", name: "Others", slug: "others" },
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
