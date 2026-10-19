import { ok, toErrorResponse } from "@/lib/api";
import { issueNonce } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { wallet } = (await req.json()) as { wallet?: string };
    return ok(await issueNonce(String(wallet ?? "")));
  } catch (err) {
    return toErrorResponse(err);
  }
}
