import { ok, toErrorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const s = await getSession();
    return ok({ wallet: s?.wallet ?? null });
  } catch (err) {
    return toErrorResponse(err);
  }
}
