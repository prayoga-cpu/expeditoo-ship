import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Create PostgreSQL connection
const connectionString = process.env.POSTGRES_URL!;

if (!connectionString) {
  throw new Error(
    "POSTGRES_URL environment variable is not defined. Please check your .env file."
  );
}

// Create postgres client
const client = postgres(connectionString, {
  prepare: false, // Required for Supabase connection pooler
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

// Export schema for type inference
export * from "./schema";
