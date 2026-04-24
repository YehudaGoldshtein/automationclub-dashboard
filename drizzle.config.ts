import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = (process.env.DATABASE_URL || "").replace(
  /^postgresql\+psycopg:\/\//,
  "postgres://",
);
if (!url) throw new Error("DATABASE_URL required");

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
