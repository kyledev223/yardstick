import { ok, toErrorResponse } from "@/lib/api";
import { flushRpcUsage } from "@/lib/data/budget";
import { launchTableAddresses, lookupTableStatus } from "@/lib/launch/lookup-table";

/** Addresses the launch lookup table should hold, and the status of the configured one. Local only (404 in production). */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  try {
    const [addresses, status] = await Promise.all([launchTableAddresses(), lookupTableStatus()]);
    return ok({ addresses, status });
  } catch (err) {
    return toErrorResponse(err);
  } finally {
    await flushRpcUsage().catch(() => {});
  }
}
