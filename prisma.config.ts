import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// `vercel env pull` writes .env.local; plain .env also works.
loadEnv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Migrations need a direct (unpooled) connection. Neon's Vercel
    // integration provides DATABASE_URL_UNPOOLED; fall back to DATABASE_URL.
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
});
