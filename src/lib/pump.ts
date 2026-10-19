import "server-only";
import { createRequire } from "node:module";

// The SDK's ESM build breaks in Node (an @coral-xyz/anchor "BN" export error),
// so always load the CommonJS build through createRequire, from this one module.
const require = createRequire(import.meta.url);

type PumpModule = typeof import("@pump-fun/pump-sdk");

let cached: PumpModule | null = null;
export function pumpSdk(): PumpModule {
  if (!cached) cached = require("@pump-fun/pump-sdk") as PumpModule;
  return cached;
}
