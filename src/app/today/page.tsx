import type { Metadata } from "next";
import { PageHead } from "@/components/page-head";
import { TodayTable } from "./today-table";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <>
      <PageHead
        eyebrow="Today's board"
        title="Today on Yardstick."
        note="Coins launched through Yardstick, ranked by their standing against coins of the same age: the pump.fun baseline or other Yardstick launches. It's here for curiosity: there are no prizes and nothing is rewarded."
      />
      <div className="mx-auto mt-12 max-w-text px-gutter md:mt-16">
        <TodayTable />
      </div>
    </>
  );
}
