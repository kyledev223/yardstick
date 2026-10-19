import "server-only";
import { db } from "./db";
import { sha256 } from "./auth";

/**
 * Fixed-window limiter stored in Postgres (no Redis on the free plan).
 * Returns true if the call is allowed.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const id = sha256(key); // don't store raw IPs
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await db().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${id}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" = ${windowStart} THEN "RateLimit"."count" + 1 ELSE 1 END,
      "windowStart" = ${windowStart}
    RETURNING "count"`;
  return (rows[0]?.count ?? 0) <= limit;
}
