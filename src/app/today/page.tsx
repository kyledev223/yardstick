import type { Metadata } from "next";
import { TodayTable } from "./today-table";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <div className="mx-auto max-w-page px-gutter pt-6 md:pt-10">
      <h1 className="text-display">
        <span className="pill pill-yellow">Today</span> on Yardstick
      </h1>
      <p className="mt-6 max-w-measure text-lead text-muted">
        Coins launched through Yardstick, ranked by their standing against coins of the same age: the pump.fun baseline or other Yardstick launches. It&apos;s here for curiosity: there are no prizes and nothing is rewarded.
      </p>
      <div className="mt-10">
        <TodayTable />
      </div>
    </div>
  );
}
