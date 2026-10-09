"use client";

import {
  ArrowBendDownRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  DotsThreeIcon,
  HourglassIcon,
  NotePencilIcon,
  SunIcon,
  type Icon as PhIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { getActivityRange } from "@/lib/actions";
import { addDays, formatLongDay } from "@/lib/day";
import { dayReport, type DayEntry, type DayOutcome } from "@/lib/history";
import { HISTORY_DAYS, type Activity, type Task } from "@/lib/types";
import { useBoard } from "./board-context";
import { Consistency } from "./consistency";
import { Sheet, cx } from "./ui";

type Mode = "month" | "week";
type Report = ReturnType<typeof dayReport>;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MAX_IN_CELL = 3;

const OUTCOME: Record<DayOutcome, { label: string; tint: string; dot: string; icon: PhIcon }> = {
  done: { label: "Done", tint: "text-done-ink", dot: "bg-done", icon: CheckCircleIcon },
  carried: { label: "Carried", tint: "text-carried-ink", dot: "bg-carried", icon: ArrowBendDownRightIcon },
  pending: { label: "Pending", tint: "text-pending-ink", dot: "bg-pending", icon: HourglassIcon },
  worked: { label: "Updated", tint: "text-today-ink", dot: "bg-today", icon: NotePencilIcon },
  today: { label: "Today", tint: "text-ink", dot: "bg-sun", icon: SunIcon },
};

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const mondayOf = (day: string) => addDays(day, -((utc(day).getUTCDay() + 6) % 7));
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const shiftMonth = (day: string, n: number) => {
  const d = utc(monthStart(day));
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const endOfMonth = (day: string) => addDays(shiftMonth(day, 1), -1);

export function CalendarView({ onOpen }: { onOpen: (id: string) => void }) {
  const { today, activity, tasks } = useBoard();
  const [mode, setMode] = useState<Mode>("month");
  const [anchor, setAnchor] = useState(today);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ key: string; activity: Activity[]; tasks: Task[] } | null>(null);

  const from = mode === "month" ? mondayOf(monthStart(anchor)) : mondayOf(anchor);
  const to = mode === "month" ? addDays(mondayOf(endOfMonth(anchor)), 6) : addDays(mondayOf(anchor), 6);
  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
  }, [from, to]);

  // The board only carries recent history; older ranges are fetched on demand.
  const loadedSince = addDays(today, -HISTORY_DAYS);
  const needsFetch = from < loadedSince;
  const key = `${from}:${to}`;
  useEffect(() => {
    if (!needsFetch) return;
    let alive = true;
    getActivityRange(from, to)
      .then((r) => alive && setRemote({ key, ...r }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [needsFetch, from, to, key]);
  const loading = needsFetch && remote?.key !== key;

  const reports = useMemo(() => {
    const older = remote?.key === key ? remote : null;
    const all = [...(older?.activity.filter((a) => a.day < loadedSince) ?? []), ...activity];
    const taskMap = new Map([...(older?.tasks ?? []), ...tasks].map((t) => [t.id, t]));
    return new Map(days.map((d) => [d, dayReport(d, all, taskMap, today)]));
  }, [remote, key, activity, tasks, days, today, loadedSince]);

  const shift = (n: number) => setAnchor((a) => (mode === "month" ? shiftMonth(a, n) : addDays(a, n * 7)));
  const title = utc(mode === "month" ? monthStart(anchor) : mondayOf(anchor));

  return (
    <div className="overflow-hidden rounded-[28px] bg-card/60 ring-1 ring-line">
      <header className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <h1 className="text-lg font-bold sm:text-xl">
          {title.toLocaleDateString("en-IN", { month: "long", timeZone: "UTC" })}{" "}
          <span className="font-normal text-mute">{title.getUTCFullYear()}</span>
        </h1>
        {loading && <span className="size-2 animate-pulse rounded-full bg-blue" />}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex rounded-xl bg-paper p-1 ring-1 ring-line">
            {(["month", "week"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cx(
                  "relative h-8 rounded-lg px-3 text-xs font-semibold capitalize transition-colors",
                  mode === m ? "text-ink" : "text-mute hover:text-ink-2",
                )}
              >
                {mode === m && (
                  <motion.span layoutId="cal-mode" className="absolute inset-0 rounded-lg bg-raised ring-1 ring-line" />
                )}
                <span className="relative">{m}</span>
              </button>
            ))}
          </div>
          <NavButton icon={CaretLeftIcon} label="Previous" onClick={() => shift(-1)} />
          <button
            type="button"
            onClick={() => setAnchor(today)}
            className="h-9 rounded-xl px-3 text-xs font-semibold text-ink-2 ring-1 ring-line transition hover:bg-ink/5"
          >
            Today
          </button>
          <NavButton icon={CaretRightIcon} label="Next" onClick={() => shift(1)} />
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${mode}:${key}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {mode === "month" ? (
            <MonthGrid days={days} month={anchor.slice(0, 7)} reports={reports} onPick={setOpenDay} />
          ) : (
            <WeekList days={days} reports={reports} onPick={setOpenDay} onOpen={onOpen} />
          )}
        </motion.div>
      </AnimatePresence>

      <DaySheet
        day={openDay}
        report={openDay ? reports.get(openDay) : undefined}
        onClose={() => setOpenDay(null)}
        onOpen={(id) => {
          setOpenDay(null);
          onOpen(id);
        }}
      />
    </div>
  );
}

function NavButton({ icon: Icon, label, onClick }: { icon: PhIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-xl text-ink-2 ring-1 ring-line transition hover:bg-ink/5"
    >
      <Icon className="size-4" />
    </button>
  );
}

/* ---------- month ---------- */

function MonthGrid({
  days,
  month,
  reports,
  onPick,
}: {
  days: string[];
  month: string;
  reports: Map<string, Report>;
  onPick: (day: string) => void;
}) {
  const { today } = useBoard();
  return (
    <div>
      <div className="grid grid-cols-7 border-t border-line">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2 text-center text-[10px] font-medium tracking-wide text-mute sm:text-xs">
            <span className="sm:hidden">{w.slice(0, 1)}</span>
            <span className="hidden sm:inline lg:hidden">{w.slice(0, 3)}</span>
            <span className="hidden lg:inline">{w}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-t border-line">
        {days.map((d, i) => {
          const r = reports.get(d);
          const entries = r?.entries ?? [];
          const isToday = d === today;
          const inMonth = d.startsWith(month);
          const future = d > today;
          const date = utc(d);
          const label = isToday
            ? `Today, ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}`
            : date.getUTCDate() === 1
              ? date.toLocaleDateString("en-IN", { month: "long", day: "numeric", timeZone: "UTC" })
              : String(date.getUTCDate());
          return (
            <motion.button
              key={d}
              type="button"
              disabled={future}
              onClick={() => onPick(d)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.008, 0.3) }}
              className={cx(
                "relative flex min-h-16 flex-col border-line p-1.5 text-left transition sm:min-h-32 sm:p-2",
                i % 7 !== 6 && "border-r",
                i < days.length - 7 && "border-b",
                isToday
                  ? "z-10 bg-raised shadow-lift ring-2 ring-sun sm:rounded-xl"
                  : "hover:bg-ink/[0.03]",
                !inMonth && "opacity-40",
                future && "pointer-events-none",
              )}
            >
              <span
                className={cx(
                  "mb-1.5 truncate text-[11px] font-semibold sm:text-xs",
                  isToday ? "text-ink" : "text-ink-2",
                )}
              >
                <span className="sm:hidden">{date.getUTCDate()}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>

              {/* Phone: colored dots only */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {entries.slice(0, 6).map((e) => (
                  <span key={e.task.id} className={cx("size-1.5 rounded-full", OUTCOME[e.outcome].dot)} />
                ))}
              </span>

              {/* Larger screens: task rows */}
              <span className="hidden flex-col gap-1 sm:flex">
                {entries.slice(0, MAX_IN_CELL).map((e) => (
                  <CellRow key={e.task.id} entry={e} />
                ))}
                {entries.length > MAX_IN_CELL && (
                  <span className="flex items-center gap-1.5 px-1.5 text-[11px] text-mute">
                    <DotsThreeIcon className="size-4" />
                    {entries.length - MAX_IN_CELL} more
                  </span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function CellRow({ entry }: { entry: DayEntry }) {
  const { label } = useBoard();
  const category = label(entry.task.categoryId);
  const o = OUTCOME[entry.outcome];
  return (
    <span className="flex items-center gap-1.5 rounded-md bg-ink/[0.04] px-1.5 py-1 text-[11px]">
      <span
        className="size-2 shrink-0 rounded-[3px]"
        style={{ background: category?.color ?? "rgb(86 47 0 / 0.2)" }}
      />
      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{entry.task.title}</span>
      <span className={cx("hidden shrink-0 font-medium xl:inline", o.tint)}>{o.label}</span>
      <o.icon className={cx("size-3.5 shrink-0 xl:hidden", o.tint)} />
    </span>
  );
}

/* ---------- week ---------- */

function WeekList({
  days,
  reports,
  onPick,
  onOpen,
}: {
  days: string[];
  reports: Map<string, Report>;
  onPick: (day: string) => void;
  onOpen: (id: string) => void;
}) {
  const { today } = useBoard();
  return (
    <div className="divide-y divide-line border-t border-line">
      {days.map((d) => {
        const entries = reports.get(d)?.entries ?? [];
        const isToday = d === today;
        const date = utc(d);
        return (
          <div key={d} className={cx("flex gap-4 px-4 py-3.5 sm:px-6", isToday && "bg-raised", d > today && "opacity-40")}>
            <button type="button" onClick={() => onPick(d)} disabled={d > today} className="w-12 shrink-0 text-left">
              <div className="text-[10px] font-medium tracking-wide text-mute uppercase">
                {date.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}
              </div>
              <div className={cx("text-2xl leading-tight font-bold", isToday && "text-blue")}>{date.getUTCDate()}</div>
            </button>
            <div className="min-w-0 flex-1 space-y-1.5">
              {entries.length === 0 && <div className="pt-2 text-xs text-mute">—</div>}
              {entries.map((e) => (
                <button key={e.task.id} type="button" onClick={() => onOpen(e.task.id)} className="block w-full text-left">
                  <CellRow entry={e} />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- day detail ---------- */

const GROUPS: DayOutcome[] = ["today", "done", "carried", "worked", "pending"];

function DaySheet({
  day,
  report,
  onClose,
  onOpen,
}: {
  day: string | null;
  report: Report | undefined;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <Sheet open={!!day} onClose={onClose} title={day ? formatLongDay(day) : ""} wide>
      {report && (
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Picked", value: report.picked },
              { label: "Done", value: report.done },
              { label: "Carried", value: report.carried },
              { label: "Pending", value: report.pending },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-card px-3 py-2.5 ring-1 ring-line">
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-[10px] font-semibold text-mute uppercase">{s.label}</div>
              </div>
            ))}
          </div>

          {report.entries.length === 0 && (
            <div className="flex h-28 flex-col items-center justify-center gap-2 text-mute">
              <SunIcon className="size-8" weight="thin" />
              <span className="text-sm">Nothing picked this day</span>
            </div>
          )}

          {GROUPS.map((g) => {
            const list = report.entries.filter((e) => e.outcome === g);
            if (!list.length) return null;
            const o = OUTCOME[g];
            return (
              <section key={g}>
                <header className="mb-2 flex items-center gap-2">
                  <o.icon className={cx("size-4", o.tint)} />
                  <h3 className="text-sm font-semibold">{o.label}</h3>
                  <span className="font-mono text-[11px] text-mute">{list.length}</span>
                </header>
                <div className="space-y-2">
                  {list.map((e) => (
                    <button
                      key={e.task.id}
                      type="button"
                      onClick={() => onOpen(e.task.id)}
                      className="w-full rounded-2xl bg-card p-3 text-left ring-1 ring-line transition hover:ring-ink/15"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate text-sm font-semibold">{e.task.title}</span>
                        {e.picked && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky uppercase">
                            <SunIcon className="size-3.5" /> Picked
                          </span>
                        )}
                        {e.logged && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-mute uppercase">
                            <NotePencilIcon className="size-3.5" /> Note
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5">
                        <Consistency taskId={e.task.id} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
