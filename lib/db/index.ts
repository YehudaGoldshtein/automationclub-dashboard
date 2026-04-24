import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required");
}

// Strip the Python driver prefix if present (postgresql+psycopg://... → postgres://...)
const normalized = url.replace(/^postgresql\+psycopg:\/\//, "postgres://");

const client = postgres(normalized, { prepare: false });

export const db = drizzle(client, { schema });
export * from "./schema";
