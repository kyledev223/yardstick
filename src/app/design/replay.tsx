"use client";
import { Fragment, useState, type ReactNode } from "react";

/** Dev-only: remounts its child so a play-once diagram can be watched again. */
export function Replay({ children, onPanel = false }: { children: ReactNode; onPanel?: boolean }) {
  const [n, setN] = useState(0);
  return (
    <div>
      <Fragment key={n}>{children}</Fragment>
      <button type="button" onClick={() => setN(n + 1)} className={`btn btn-sm mt-4 ${onPanel ? "btn-panel-ghost" : "btn-outline"}`}>
        Replay
      </button>
    </div>
  );
}
