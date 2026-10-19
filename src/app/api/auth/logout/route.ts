import { ok, toErrorResponse } from "@/lib/api";
import { signOut } from "@/lib/auth";

export async function POST() {
  try {
    await signOut();
    return ok({});
  } catch (err) {
    return toErrorResponse(err);
  }
}
