/**
 * Dev-only landing preview: `/?preview=baseline` fills the landing page with sampled pump.fun coins, so the
 * design can be judged with real data before any Yardstick launches exist. Only ever on a development server:
 * any other NODE_ENV (production builds, Vercel previews, tests) gets the real page.
 */
export function landingPreviewEnabled(nodeEnv: string | undefined, param: string | string[] | undefined): boolean {
  return nodeEnv === "development" && param === "baseline";
}
