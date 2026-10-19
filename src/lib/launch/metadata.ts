import "server-only";
import sharp from "sharp";
import { PUMP_IPFS_URL } from "../config";
import { env } from "../env";
import { AppError } from "../errors";
import { redact } from "../rpc";

export type MetadataFields = {
  name: string;
  symbol: string;
  description: string;
  twitter?: string;
  telegram?: string;
  website?: string;
};

/** Re-encode any accepted image to a square-capped PNG; strips EXIF and odd formats. */
export async function normaliseImage(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input, { animated: false })
      .rotate()
      .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    throw new AppError("image-invalid");
  }
}

async function uploadToPump(image: Buffer, f: MetadataFields): Promise<{ metadataUri: string; imageUri?: string }> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(image)], { type: "image/png" }), "image.png");
  form.append("name", f.name);
  form.append("symbol", f.symbol);
  form.append("description", f.description);
  form.append("twitter", f.twitter ?? "");
  form.append("telegram", f.telegram ?? "");
  form.append("website", f.website ?? "");
  form.append("showName", "true");
  const res = await fetch(PUMP_IPFS_URL, { method: "POST", body: form, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`pump ipfs HTTP ${res.status}`);
  const body = (await res.json()) as { metadataUri?: string; metadata?: { image?: string } };
  if (!body.metadataUri) throw new Error("pump ipfs: no metadataUri");
  return { metadataUri: body.metadataUri, imageUri: body.metadata?.image };
}

async function pinataUpload(blob: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("network", "public");
  const res = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.pinataJwt}` },
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`pinata HTTP ${res.status}`);
  const body = (await res.json()) as { data?: { cid?: string } };
  if (!body.data?.cid) throw new Error("pinata: no cid");
  return `https://ipfs.io/ipfs/${body.data.cid}`;
}

async function uploadToPinata(image: Buffer, f: MetadataFields): Promise<{ metadataUri: string; imageUri: string }> {
  const imageUri = await pinataUpload(new Blob([new Uint8Array(image)], { type: "image/png" }), "image.png");
  const json = {
    name: f.name,
    symbol: f.symbol,
    description: f.description,
    image: imageUri,
    showName: true,
    ...(f.twitter ? { twitter: f.twitter } : {}),
    ...(f.telegram ? { telegram: f.telegram } : {}),
    ...(f.website ? { website: f.website } : {}),
  };
  const metadataUri = await pinataUpload(new Blob([JSON.stringify(json)], { type: "application/json" }), "metadata.json");
  return { metadataUri, imageUri };
}

/** Upload image + metadata. pump.fun's IPFS endpoint first, Pinata as fallback. URIs are used exactly as returned. */
export async function uploadMetadata(image: Buffer, f: MetadataFields) {
  try {
    return await uploadToPump(image, f);
  } catch (err) {
    console.warn("[metadata] pump.fun IPFS failed:", redact(String(err)));
    if (!env.pinataJwt) throw new AppError("metadata-upload-failed", undefined, 502);
  }
  try {
    return await uploadToPinata(image, f);
  } catch (err) {
    console.warn("[metadata] Pinata failed:", redact(String(err)));
    throw new AppError("metadata-upload-failed", undefined, 502);
  }
}
