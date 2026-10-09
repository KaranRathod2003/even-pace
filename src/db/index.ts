import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const create = (url: string) => drizzle({ client: neon(url), schema });

let instance: ReturnType<typeof create> | undefined;

// Created lazily so builds don't need DATABASE_URL.
export function db() {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local");
    instance = create(url);
  }
  return instance;
}

export * from "./schema";
