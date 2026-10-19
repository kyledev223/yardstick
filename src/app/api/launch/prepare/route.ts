import { clientIp, fail, ok, toErrorResponse } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { LAUNCH } from "@/lib/config";
import { db } from "@/lib/db";
import { uploadMetadata, normaliseImage } from "@/lib/launch/metadata";
import { containsBannedWord, launchFormSchema, validateImage } from "@/lib/launch/validate";
import { allow } from "@/lib/ratelimit";

export const maxDuration = 60;

/** Validate the form, upload image + metadata to IPFS, store a pending launch. */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const form = await req.formData();
    const parsed = launchFormSchema.safeParse({
      name: form.get("name") ?? "",
      symbol: form.get("symbol") ?? "",
      description: form.get("description") ?? "",
      twitter: form.get("twitter") ?? undefined,
      telegram: form.get("telegram") ?? undefined,
      website: form.get("website") ?? undefined,
      devBuySol: form.get("devBuySol") ?? 0,
    });
    if (!parsed.success) {
      return fail("validation-failed", 400, undefined, Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
    }
    const f = parsed.data;
    const file = form.get("image");
    const imageError = validateImage(file instanceof File ? file : null);
    if (imageError) return fail("validation-failed", 400, undefined, { image: imageError });
    if (containsBannedWord(f.name, f.symbol, f.description)) return fail("banned-word", 400);

    const ip = clientIp(req);
    const [walletOk, ipOk] = await Promise.all([
      allow(`prepare:w:${session.wallet}`, LAUNCH.prepareLimitPerHourWallet, 3600),
      allow(`prepare:ip:${ip}`, LAUNCH.prepareLimitPerHourIp, 3600),
    ]);
    if (!walletOk || !ipOk) return fail("rate-limited", 429);

    const image = await normaliseImage(Buffer.from(await (file as File).arrayBuffer()));
    const { metadataUri, imageUri } = await uploadMetadata(image, f);

    const launch = await db().launch.create({
      data: {
        userId: session.userId,
        wallet: session.wallet,
        name: f.name,
        symbol: f.symbol,
        description: f.description,
        twitter: f.twitter ?? null,
        telegram: f.telegram ?? null,
        website: f.website ?? null,
        imageUri: imageUri ?? null,
        metadataUri,
        devBuyLamports: BigInt(Math.round(f.devBuySol * 1e9)),
      },
    });
    return ok({ launchId: launch.id, metadataUri });
  } catch (err) {
    return toErrorResponse(err);
  }
}
