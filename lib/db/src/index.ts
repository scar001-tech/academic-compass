import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const connection = new Database(process.env.DATABASE_URL.replace(/^sqlite:/, ""));
export const db = drizzle(connection, { schema });

export * from "./schema";
