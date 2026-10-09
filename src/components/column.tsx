"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence } from "motion/react";
import type { ReactNode } from "react";
import { STATUS_LABEL, type Status, type Task } from "@/lib/types";
import { TaskCard } from "./task-card";
import { STATUS_ICON, STATUS_TINT, cx } from "./ui";

export function Column({
  status,
  tasks,
  onOpen,
  title,
  className,
  grid,
  extra,
}: {
  status: Status;
  tasks: Task[];
  onOpen: (id: string) => void;
  title?: string;
  className?: string;
  grid?: boolean;
  extra?: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const Icon = STATUS_ICON[status];

  return (
    <section
      ref={setNodeRef}
      className={cx(
        "flex min-h-40 flex-col rounded-3xl p-2.5 transition-colors",
        isOver ? "bg-blue-soft ring-2 ring-blue/40" : "bg-ink/[0.025]",
        className,
      )}
    >
      <header className="flex items-center justify-between px-1.5 pt-1 pb-3">
        <div className="flex items-center gap-2">
          <span className={cx("flex size-7 items-center justify-center rounded-lg", STATUS_TINT[status])}>
            <Icon className="size-4" />
          </span>
          <h2 className="text-sm font-bold">{title ?? STATUS_LABEL[status]}</h2>
          <span className="rounded-md bg-card px-1.5 font-mono text-[11px] font-semibold text-mute ring-1 ring-line">
            {tasks.length}
          </span>
        </div>
        {extra}
      </header>
      <div className={cx("flex-1", grid ? "grid content-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-2.5")}>
        <AnimatePresence initial={false}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={onOpen} />
          ))}
        </AnimatePresence>
        {tasks.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-2xl border-[1.5px] border-dashed border-ink/10 text-xs font-medium text-mute">
            Empty
          </div>
        )}
      </div>
    </section>
  );
}
