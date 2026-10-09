"use client";

import { CheckIcon, SunIcon, UserCircleIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { formatLongDay, istDay } from "@/lib/day";
import type { Status, Task } from "@/lib/types";
import { useBoard } from "./board-context";
import { Column } from "./column";
import { cx } from "./ui";

export function TodayView({
  byStatus,
  midway,
  onOpen,
}: {
  byStatus: Record<Status, Task[]>;
  midway: Task[];
  onOpen: (id: string) => void;
}) {
  const { today } = useBoard();
  const doneToday = byStatus.done.filter((t) => t.completedAt && istDay(new Date(t.completedAt)) === today);
  const stats = [
    { label: "Today", value: byStatus.today.length },
    { label: "Left midway", value: midway.length },
    { label: "Pending", value: byStatus.pending.length },
    { label: "Done", value: doneToday.length },
  ];

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[32px] bg-sun p-4 text-ink sm:p-6">
        <div className="pointer-events-none absolute -top-20 -right-10 size-56 rounded-full bg-coral/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 size-48 rounded-full bg-mint/60 blur-3xl" />
        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-ink/75">Today</p>
            <h1 className="mt-0.5 text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{formatLongDay(today)}</h1>
            <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className={cx(
                    "min-w-0 rounded-[20px] px-3 py-3 sm:px-4",
                    ["bg-sky-pastel", "bg-lavender", "bg-coral", "bg-mint"][i],
                  )}
                >
                  <div className="text-2xl leading-none font-bold sm:text-3xl">{s.value}</div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-ink/85 sm:text-xs">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <TodayList tasks={byStatus.today} done={doneToday} onOpen={onOpen} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Column status="today" tasks={byStatus.today} onOpen={onOpen} className="bg-blue-soft/40" />
        <div className="space-y-4">
          {midway.length > 0 && <Column status="in_progress" title="Left midway" tasks={midway} onOpen={onOpen} />}
          <Column status="todo" tasks={byStatus.todo} onOpen={onOpen} />
        </div>
      </div>
    </div>
  );
}

/** Today's picks by title, right in the hero. Tap a row to open the task. */
function TodayList({ tasks, done, onOpen }: { tasks: Task[]; done: Task[]; onOpen: (id: string) => void }) {
  const { label, move } = useBoard();

  return (
    <div className="flex min-w-0 flex-col rounded-[24px] bg-card/75 p-2 ring-1 ring-ink/10 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-2">
        <SunIcon className="size-[18px]" />
        <h2 className="text-sm font-bold">Today&apos;s tasks</h2>
        <span className="font-mono text-[11px] font-semibold text-mute">
          {done.length}/{tasks.length + done.length}
        </span>
      </div>

      <ul className="max-h-64 space-y-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {tasks.map((t, i) => {
            const category = label(t.categoryId);
            const reporting = label(t.reportingToId);
            return (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
              >
                <div className="group flex items-center gap-2.5 rounded-2xl px-2.5 py-2 transition hover:bg-sun/40">
                  <button
                    type="button"
                    aria-label="Mark done"
                    onClick={() => move(t.id, "done")}
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-transparent ring-[1.5px] ring-ink/35 transition hover:bg-done hover:text-done-ink hover:ring-done-ink/50"
                  >
                    <CheckIcon className="size-3" weight="bold" />
                  </button>
                  <button type="button" onClick={() => onOpen(t.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    {category && (
                      <span
                        className="size-2.5 shrink-0 rounded-full ring-1 ring-ink/20"
                        style={{ background: category.color }}
                      />
                    )}
                    <span className="truncate text-[15px] font-semibold">{t.title}</span>
                    {reporting && (
                      <span className="ml-auto hidden shrink-0 items-center gap-1 text-xs text-mute sm:inline-flex">
                        <UserCircleIcon className="size-3.5" />
                        {reporting.name}
                      </span>
                    )}
                  </button>
                </div>
              </motion.li>
            );
          })}
          {done.map((t) => (
            <motion.li key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button
                type="button"
                onClick={() => onOpen(t.id)}
                className="flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-1.5 text-left transition hover:bg-sun/30"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-done text-done-ink">
                  <CheckIcon className="size-3" weight="bold" />
                </span>
                <span className="truncate text-sm text-mute line-through">{t.title}</span>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {tasks.length === 0 && done.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-3 py-6 text-center text-mute">
          <SunIcon className="size-7" weight="thin" />
          <span className="text-sm font-medium">No tasks picked for today</span>
        </div>
      )}
    </div>
  );
}
