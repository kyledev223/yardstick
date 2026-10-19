// Run the background tick once against mainnet, locally.
// Usage: npm run tick            (reads .env.local / .env)
//        npm run tick -- 3       (run 3 ticks in a row)
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const { tick } = await import("@/lib/jobs/tick");
  const { db } = await import("@/lib/db");
  const runs = Number(process.argv[2] ?? 1);
  for (let i = 0; i < runs; i++) {
    const t = Date.now();
    const summary = await tick({ reason: "local-script" });
    console.log(`tick ${i + 1}/${runs} in ${Date.now() - t}ms`);
    console.log(JSON.stringify(summary, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  }
  const [coins, snaps, trades, usage] = await Promise.all([
    db().coin.groupBy({ by: ["source"], _count: true }),
    db().snapshot.groupBy({ by: ["ageBucket"], _count: true }),
    db().trade.count(),
    db().rpcUsage.findMany(),
  ]);
  console.log("coins:", coins.map((c) => `${c.source}=${c._count}`).join(" "));
  console.log("snapshots:", snaps.map((s) => `${s.ageBucket}=${s._count}`).join(" "));
  console.log("trades:", trades);
  console.log("rpc usage today:", usage.map((u) => `${u.day} ${u.host} credits=${u.credits} calls=${u.calls} errors=${u.errors}`).join("\n  "));
  await db().$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
