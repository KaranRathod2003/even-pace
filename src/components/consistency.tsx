"use client";

import { motion } from "motion/react";
import { formatDay } from "@/lib/day";
import { taskTimeline, type DayMark } from "@/lib/history";
import { useBoard } from "./board-context";
import { cx } from "./ui";

const MARK_STYLE: Record<DayMark, string> = {
  worked: "bg-[#3ED9A2]",
  done: "bg-[#3ED9A2] ring-2 ring-mint",
  pending: "bg-[#F99A6B]",
  idle: "bg-ink/10",
  open: "bg-transparent ring-1 ring-inset ring-ink/25",
};

const MARK_LABEL: Record<DayMark, string> = {
  worked: "Worked",
  done: "Completed",
  pending: "Pending",
  idle: "Not picked",
  open: "Not yet today",
};

/** One segment per day: green = worked, gap = skipped, amber = pending. */
export function Consistency({ taskId, span = 14, large }: { taskId: string; span?: number; large?: boolean }) {
  const { activityByTask, today } = useBoard();
  const days = taskTimeline(activityByTask.get(taskId), today, span);
  if (days.length === 0) return null;
  const worked = days.filter((d) => d.mark === "worked" || d.mark === "done").length;

  return (
    <div className="flex items-center gap-2.5">
      <div className={cx("flex flex-1 items-center", large ? "gap-1" : "gap-[3px]")}>
        {days.map((d, i) => {
          const on = (m?: DayMark) => m === "worked" || m === "done";
          const joined = on(d.mark) && on(days[i - 1]?.mark);
          const joinsNext = on(d.mark) && on(days[i + 1]?.mark);
          return (
            <motion.span
              key={d.day}
              title={`${formatDay(d.day)} · ${MARK_LABEL[d.mark]}`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.02 }}
              className={cx(
                "block flex-1 rounded-full",
                large ? "h-2 max-w-6" : "h-1.5 max-w-4",
                MARK_STYLE[d.mark],
                // Consecutive worked days read as one continuous line.
                joined && (large ? "-ml-1 rounded-l-none" : "-ml-[3px] rounded-l-none"),
                joinsNext && "rounded-r-none",
              )}
            />
          );
        })}
      </div>
      <span className="shrink-0 font-mono text-[10px] font-semibold text-mute">
        {worked}/{days.length}d
      </span>
    </div>
  );
}

export function ConsistencyLegend() {
  const items: DayMark[] = ["worked", "idle", "pending", "done"];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map((m) => (
        <span key={m} className="inline-flex items-center gap-1.5 text-[11px] text-mute">
          <span className={cx("h-1.5 w-3 rounded-full", MARK_STYLE[m])} />
          {MARK_LABEL[m]}
        </span>
      ))}
    </div>
  );
}
