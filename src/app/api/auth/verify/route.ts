import { ok, toErrorResponse } from "@/lib/api";
import { signIn } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { wallet?: string; nonce?: string; issuedAt?: string; signature?: string };
    return ok(await signIn(String(b.wallet ?? ""), String(b.nonce ?? ""), String(b.issuedAt ?? ""), String(b.signature ?? "")));
  } catch (err) {
    return toErrorResponse(err);
  }
}
