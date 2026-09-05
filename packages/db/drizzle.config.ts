import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Neon connection string, see .env.example at the repo root
    url: process.env.DATABASE_URL ?? "",
  },
});
