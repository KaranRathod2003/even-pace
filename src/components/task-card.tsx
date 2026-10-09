"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  ArrowsLeftRightIcon,
  BellSlashIcon,
  BellRingingIcon,
  ClockCounterClockwiseIcon,
  CheckIcon,
  HourglassIcon,
  SunIcon,
  TrashIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { formatDay, needsAttention, relativeDay } from "@/lib/day";
import { STATUS_LABEL, STATUS_ORDER, type Task } from "@/lib/types";
import { daysInStatus } from "@/lib/history";
import { useBoard } from "./board-context";
import { Consistency } from "./consistency";
import { MenuItem, Popover, STATUS_ICON, cx } from "./ui";

export function TaskMenu({ task, compact }: { task: Task; compact?: boolean }) {
  const { move, removeTask, notify } = useBoard();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    setConfirm(false);
  };
  return (
    <>
      <button
        ref={anchor}
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
          setConfirm(false);
        }}
        className={cx(
          "flex items-center gap-1 rounded-lg font-semibold text-mute transition hover:bg-ink/5 hover:text-ink",
          compact ? "h-7 px-1.5 text-[11px]" : "h-8 px-2 text-xs",
        )}
      >
        <ArrowsLeftRightIcon className="size-3.5" />
        Move
      </button>
      <Popover open={open} onClose={close} anchor={anchor} width={200}>
        <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-bold tracking-wider text-mute uppercase">Move to</div>
        {STATUS_ORDER.map((s) => (
          <MenuItem
            key={s}
            icon={STATUS_ICON[s]}
            active={task.status === s}
            onClick={() => {
              close();
              move(task.id, s);
            }}
          >
            {STATUS_LABEL[s]}
          </MenuItem>
        ))}
        <div className="my-1 border-t border-line" />
        <MenuItem
          icon={TrashIcon}
          danger
          onClick={() => {
            if (!confirm) return setConfirm(true);
            close();
            void removeTask(task.id).then(() => notify("Task deleted"));
          }}
        >
          {confirm ? "Tap again to delete" : "Delete task"}
        </MenuItem>
      </Popover>
    </>
  );
}

export function TaskCard({ task, onOpen, overlay }: { task: Task; onOpen?: (id: string) => void; overlay?: boolean }) {
  const { label, today, move, snooze } = useBoard();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: overlay });

  const category = label(task.categoryId);
  const reporting = label(task.reportingToId);
  const pendingOn = label(task.pendingOnId);
  const attention = needsAttention(task, today);
  const snoozedToday = task.status === "in_progress" && task.snoozedOn === today;
  const done = task.status === "done";

  return (
    <motion.div
      layout={!overlay}
      layoutId={overlay ? undefined : task.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.35 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        role="button"
        tabIndex={0}
        onClick={() => onOpen?.(task.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onOpen?.(task.id);
        }}
        className={cx(
          "group relative cursor-pointer touch-manipulation rounded-2xl bg-card p-3.5 text-left outline-none select-none",
          "transition-shadow focus-visible:ring-2 focus-visible:ring-blue",
          attention ? "glow-ring" : "shadow-card ring-1 ring-line hover:ring-ink/25",
          overlay && "rotate-[1.5deg] shadow-lift ring-blue/40",
          done && "opacity-70",
        )}
        // Soft wash of the category colour so cards group visually at a glance.
        style={category ? { background: `color-mix(in srgb, ${category.color} 32%, var(--color-card))` } : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          {category ? (
            <span
              className="inline-flex max-w-[65%] items-center gap-1.5 truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-ink ring-1 ring-ink/15"
              style={{ background: category.color }}
            >
              <span className="size-1.5 shrink-0 rounded-full bg-ink/60" />
              <span className="truncate">{category.name}</span>
            </span>
          ) : (
            <span />
          )}
          {!overlay && <TaskMenu task={task} compact />}
        </div>

        <div className="mt-2 flex items-start gap-2.5">
          <button
            type="button"
            aria-label={done ? "Mark not done" : "Mark done"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              move(task.id, done ? "todo" : "done");
            }}
            className={cx(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-[1.5px] transition",
              done ? "bg-done text-done-ink ring-done-ink/40" : "text-transparent ring-ink/25 hover:text-ink/40 hover:ring-ink/50",
            )}
          >
            <CheckIcon className="size-3" />
          </button>
          <h3 className={cx("text-[15px] leading-snug font-semibold text-ink", done && "text-mute line-through")}>
            {task.title}
          </h3>
        </div>

        {(reporting || task.lastWorkedOn) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-7.5 text-xs text-mute">
            {reporting && (
              <span className="inline-flex items-center gap-1">
                <UserCircleIcon className="size-3.5" />
                {reporting.name}
              </span>
            )}
            {task.lastWorkedOn && !done && (
              <span className={cx("inline-flex items-center gap-1", attention && "font-semibold text-sky")}>
                <ClockCounterClockwiseIcon className="size-3.5" />
                {formatDay(task.lastWorkedOn)} · {relativeDay(task.lastWorkedOn, today)}
              </span>
            )}
          </div>
        )}

        {task.status === "pending" && (
          <div className="mt-2.5 ml-7.5 inline-flex items-center gap-1.5 rounded-lg bg-pending/60 px-2 py-1 text-xs font-semibold text-pending-ink">
            <HourglassIcon className="size-3.5" />
            {pendingOn ? `Waiting on ${pendingOn.name}` : "Pending"}
            <span className="font-mono text-[10px] opacity-80">· {pendingFor(daysInStatus(task, today))}</span>
          </div>
        )}

        {!overlay && (
          <div className="mt-3 pl-7.5">
            <Consistency taskId={task.id} />
          </div>
        )}

        {attention && !overlay && (
          <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 pl-7.5">
            <CardAction icon={SunIcon} primary onClick={() => move(task.id, "today")}>
              Take today
            </CardAction>
            <CardAction icon={BellSlashIcon} onClick={() => snooze(task.id, true)}>
              Snooze today
            </CardAction>
          </div>
        )}

        {snoozedToday && !overlay && (
          <div className="mt-2.5 flex items-center gap-1.5 pl-7.5">
            <span className="inline-flex items-center gap-1 text-xs text-mute">
              <BellSlashIcon className="size-3.5" /> Snoozed
            </span>
            <CardAction icon={BellRingingIcon} onClick={() => snooze(task.id, false)}>
              Undo
            </CardAction>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function pendingFor(days: number) {
  if (days <= 0) return "<1 day";
  return days === 1 ? "1 day" : `${days} days`;
}

function CardAction({
  icon: Icon,
  children,
  onClick,
  primary,
}: {
  icon: typeof SunIcon;
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cx(
        "inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-bold transition active:scale-95",
        primary ? "bg-blue text-on-blue hover:bg-blue-deep" : "text-ink-2 ring-1 ring-line hover:bg-paper",
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}
