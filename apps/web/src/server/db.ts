import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { cache } from "react";

/** True when running on Cloudflare Workers (the deployed demo site), false on Node.js. */
const onCloudflare = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

/**
 * Cloudflare Workers cannot share a database connection between requests, so there we open
 * one client per request (through the `pg` driver) and reuse it for the rest of that request.
 */
const requestClient = cache(
  () => new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) }),
);

function cloudflareDb(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, property) {
      const client = requestClient();
      const value = Reflect.get(client, property, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

// On Node.js, reuse one client (and one across development hot reloads).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = onCloudflare ? cloudflareDb() : (globalForPrisma.prisma ?? new PrismaClient());

if (!onCloudflare && process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
