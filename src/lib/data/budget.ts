import "server-only";
import { db } from "../db";
import { env } from "../env";
import { creditsSpent, drainRpcUsage } from "../rpc";

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

/** Write accumulated RPC counters to the RpcUsage table. Safe to call often. */
export async function flushRpcUsage() {
  const rows = drainRpcUsage();
  const day = utcDay();
  for (const r of rows) {
    await db().$executeRaw`
      INSERT INTO "RpcUsage" ("day", "host", "credits", "calls", "errors") VALUES (${day}, ${r.host}, ${r.credits}, ${r.calls}, ${r.errors})
      ON CONFLICT ("day", "host") DO UPDATE SET
        "credits" = "RpcUsage"."credits" + EXCLUDED."credits",
        "calls" = "RpcUsage"."calls" + EXCLUDED."calls",
        "errors" = "RpcUsage"."errors" + EXCLUDED."errors"`;
  }
}

export async function creditsUsedToday(): Promise<number> {
  const agg = await db().rpcUsage.aggregate({ where: { day: utcDay() }, _sum: { credits: true } });
  return agg._sum.credits ?? 0;
}

/** Time + credit budget for one unit of background work. */
export class Budget {
  private start = creditsSpent();
  constructor(
    private deadline: number,
    private creditLimit: number,
    /** Credits already used today before this budget started. */
    public usedToday: number,
    public dailyLimit: number,
  ) {}

  static async create(ms: number, credits: number): Promise<Budget> {
    const used = await creditsUsedToday().catch(() => 0);
    return new Budget(Date.now() + ms, credits, used, env.rpcDailyBudget);
  }

  spent() {
    return creditsSpent() - this.start;
  }
  msLeft() {
    return this.deadline - Date.now();
  }
  dailyFraction() {
    return (this.usedToday + this.spent()) / this.dailyLimit;
  }
  /** Room for more work costing about `credits`? */
  ok(credits = 1) {
    return this.msLeft() > 0 && this.spent() + credits <= this.creditLimit && this.usedToday + this.spent() + credits <= this.dailyLimit;
  }
  /**
   * How much baseline sampling to allow (0–1). Slows down when today's spend runs ahead
   * of the clock, and stops at 90% so Yardstick coins always have room.
   */
  baselineFactor() {
    const f = this.dailyFraction();
    if (f >= 0.9) return 0;
    const now = new Date();
    const dayElapsed = (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) / 86400;
    const ahead = f - dayElapsed;
    if (ahead <= 0.05) return 1;
    return Math.max(0, 1 - ahead * 4);
  }
}
