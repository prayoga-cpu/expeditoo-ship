import { defineConfig } from "drizzle-kit";

const isDev = process.env.NODE_ENV === "development";
const postgresUrl = isDev
  ? process.env.POSTGRES_URL_NON_POOLING
  : process.env.POSTGRES_URL;

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: postgresUrl!,
  },
  verbose: true,
  strict: true,
});
