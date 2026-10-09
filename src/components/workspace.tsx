"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  CalendarDotsIcon,
  IconContext,
  KanbanIcon,
  ListChecksIcon,
  PlusCircleIcon,
  PlusIcon,
  SunIcon,
  TagIcon,
  type Icon as PhIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { formatDay, needsAttention } from "@/lib/day";
import { STATUS_ORDER, type BoardData, type Status, type Task } from "@/lib/types";
import { AlertsButton } from "./alerts";
import { BoardProvider, useBoard } from "./board-context";
import { CalendarView } from "./calendar-view";
import { Column } from "./column";
import { CreateSheet, PendingSheet } from "./create-sheet";
import { ListsView } from "./lists-view";
import { TaskCard } from "./task-card";
import { TaskSheet } from "./task-sheet";
import { TodayView } from "./today-view";
import { cx } from "./ui";

type View = "today" | "todo" | "board" | "lists" | "calendar";

const NAV: { id: View; label: string; icon: PhIcon }[] = [
  { id: "today", label: "Today", icon: SunIcon },
  { id: "todo", label: "To Do", icon: ListChecksIcon },
  { id: "board", label: "Board", icon: KanbanIcon },
  { id: "lists", label: "Lists", icon: TagIcon },
  { id: "calendar", label: "Calendar", icon: CalendarDotsIcon },
];

const ICONS = { weight: "light" as const, size: "1em", mirrored: false, color: "currentColor" };

export function Workspace({ initial }: { initial: BoardData }) {
  return (
    <IconContext.Provider value={ICONS}>
      <BoardProvider initial={initial}>
        <Shell />
      </BoardProvider>
    </IconContext.Provider>
  );
}

function sortTasks(list: Task[], status: Status) {
  return status === "done"
    ? [...list].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    : [...list].sort((a, b) => b.position - a.position);
}

function Shell() {
  const { tasks, today, move, toast } = useBoard();
  const [view, setView] = useState<View>("today");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const lastDragEnd = useRef(0);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(STATUS_ORDER.map((s) => [s, [] as Task[]])) as Record<Status, Task[]>;
    for (const t of tasks) map[t.status].push(t);
    for (const s of STATUS_ORDER) map[s] = sortTasks(map[s], s);
    return map;
  }, [tasks]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    lastDragEnd.current = Date.now();
    if (e.over) move(String(e.active.id), e.over.id as Status);
  };

  // A drag ends with a click on the card; don't treat that as "open".
  const open = useCallback((id: string) => {
    if (Date.now() - lastDragEnd.current > 250) setOpenId(id);
  }, []);

  const dragged = dragId ? tasks.find((t) => t.id === dragId) : undefined;
  const midway = byStatus.in_progress.filter((t) => needsAttention(t, today));

  return (
    <DndContext id="flow-board" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
      <div className="mx-auto flex min-h-dvh max-w-[1500px] flex-col px-4 pb-32 sm:px-6 md:pb-12">
        <header className="sticky top-0 z-30 -mx-4 flex items-center gap-4 bg-paper/80 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <Logo />
          <nav className="mx-auto hidden md:flex">
            <TabBar view={view} setView={setView} id="desktop" />
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <span className="font-mono text-xs font-semibold text-mute md:hidden">{formatDay(today)}</span>
            <AlertsButton />
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="hidden h-10 items-center gap-2 rounded-xl bg-blue px-4 text-sm font-bold text-on-blue shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--color-blue)_80%,transparent)] transition hover:bg-blue-deep active:scale-95 md:flex"
            >
              <PlusIcon className="size-4" weight="bold" /> New task
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.main
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="pt-3"
          >
            {view === "today" && <TodayView byStatus={byStatus} midway={midway} onOpen={open} />}
            {view === "todo" && <TodoView tasks={byStatus.todo} onOpen={open} />}
            {view === "board" && (
              <div className="scrollbar-none -mx-4 grid snap-x snap-mandatory auto-cols-[85%] grid-flow-col gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:auto-cols-[300px] sm:px-6 2xl:auto-cols-fr">
                {STATUS_ORDER.map((s) => (
                  <Column key={s} status={s} tasks={byStatus[s]} onOpen={open} className="snap-start" />
                ))}
              </div>
            )}
            {view === "lists" && <ListsView />}
            {view === "calendar" && <CalendarView onOpen={open} />}
          </motion.main>
        </AnimatePresence>
      </div>

      <MobileNav view={view} setView={setView} onNew={() => setCreating(true)} />

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}>
        {dragged && (
          <div className="w-[min(320px,80vw)]">
            <TaskCard task={dragged} overlay />
          </div>
        )}
      </DragOverlay>

      <CreateSheet open={creating} onClose={() => setCreating(false)} />
      <TaskSheet taskId={openId} onClose={() => setOpenId(null)} />
      <PendingSheet />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed inset-x-0 bottom-28 z-[70] mx-auto w-fit rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-sun shadow-lift md:bottom-8"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </DndContext>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-9 items-center justify-center rounded-[12px] bg-ink text-lg font-bold text-sun">f</span>
      <span className="text-2xl font-bold tracking-tight">flow</span>
    </div>
  );
}

function TodoView({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  const { labelsOf } = useBoard();
  const [filter, setFilter] = useState<string | null>(null);
  const categories = labelsOf("category");
  const shown = filter ? tasks.filter((t) => t.categoryId === filter) : tasks;

  return (
    <div className="space-y-3">
      {categories.length > 0 && (
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          <FilterChip active={!filter} onClick={() => setFilter(null)}>
            All
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c.id} active={filter === c.id} color={c.color} onClick={() => setFilter(c.id)}>
              {c.name}
            </FilterChip>
          ))}
        </div>
      )}
      <Column status="todo" tasks={shown} onOpen={onOpen} grid />
    </div>
  );
}

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm transition",
        active ? "bg-blue text-on-blue" : "text-ink-2 ring-1 ring-line hover:ring-ink/25",
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

/** Background-free tabs: hover tints, active tab gets a soft yellow glow and a caramel underline. */
function TabBar({
  view,
  setView,
  id,
  onNew,
}: {
  view: View;
  setView: (v: View) => void;
  id: string;
  onNew?: () => void;
}) {
  const tab = (n: (typeof NAV)[number]) => {
    const active = view === n.id;
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => setView(n.id)}
        className={cx(
          "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 transition-colors md:min-w-[80px] md:flex-none md:px-4",
          active ? "text-ink" : "text-mute hover:bg-ink/[0.06] hover:text-ink",
        )}
      >
        {active && (
          <motion.span
            layoutId={`${id}-tab`}
            className="absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-sun/70"
            transition={{ type: "spring", damping: 32, stiffness: 400 }}
          >
            <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-ink" />
          </motion.span>
        )}
        <n.icon className="relative size-[22px]" weight={active ? "regular" : "light"} />
        <span className={cx("relative truncate text-[10px] md:text-xs", active ? "font-semibold" : "font-medium")}>
          {n.label}
        </span>
      </button>
    );
  };

  return (
    <div className="flex w-full items-stretch gap-1 md:w-auto">
      {onNew ? (
        <>
          {NAV.slice(0, 2).map(tab)}
          <button
            type="button"
            onClick={onNew}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-ink transition hover:bg-ink/[0.06]"
          >
            <PlusCircleIcon className="size-[26px]" weight="fill" />
            <span className="text-[10px] font-semibold">New</span>
          </button>
          {NAV.slice(2).map(tab)}
        </>
      ) : (
        NAV.map(tab)
      )}
    </div>
  );
}

function MobileNav({ view, setView, onNew }: { view: View; setView: (v: View) => void; onNew: () => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
      <TabBar view={view} setView={setView} id="mobile" onNew={onNew} />
    </nav>
  );
}