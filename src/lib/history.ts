import { addDays, daysBetween } from "./day";
import type { Activity, Status, Task } from "./types";

/** What happened to a task on one day. */
export type DayMark = "worked" | "done" | "pending" | "idle" | "open";

export function groupByTask(activity: Activity[]) {
  const map = new Map<string, Activity[]>();
  for (const a of activity) {
    const list = map.get(a.taskId);
    if (list) list.push(a);
    else map.set(a.taskId, [a]);
  }
  // Stable sort keeps same-day status changes in the order they happened.
  for (const list of map.values()) list.sort((a, b) => a.day.localeCompare(b.day));
  return map;
}

const isStatus = (k: Activity["kind"]): k is Status => k !== "log";

/**
 * One mark per day, from the first day the task was picked up (max `span` days back)
 * through today. Stops at the day it was completed.
 */
export function taskTimeline(acts: Activity[] | undefined, today: string, span = 14) {
  if (!acts?.length) return [];
  const first = acts.find((a) => a.kind !== "todo");
  if (!first) return [];
  const from = first.day > addDays(today, -(span - 1)) ? first.day : addDays(today, -(span - 1));

  let state: Status = "todo";
  let i = 0;
  for (; i < acts.length && acts[i].day < from; i++) {
    const k = acts[i].kind;
    if (isStatus(k)) state = k;
  }

  const out: { day: string; mark: DayMark }[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) {
    let worked = false;
    let done = false;
    for (; i < acts.length && acts[i].day === d; i++) {
      const k = acts[i].kind;
      if (k === "today" || k === "log") worked = true;
      if (k === "done") done = true;
      if (isStatus(k)) state = k;
    }
    if (done) {
      out.push({ day: d, mark: "done" });
      break;
    }
    if (state === "done") break;
    const mark: DayMark =
      worked || state === "today"
        ? "worked"
        : state === "pending"
          ? "pending"
          : d === today
            ? "open"
            : "idle";
    out.push({ day: d, mark });
  }
  return out;
}

export type DayOutcome = "done" | "pending" | "carried" | "today" | "worked";

export type DayEntry = { task: Task; picked: boolean; logged: boolean; outcome: DayOutcome };

/** Everything that happened on `day`: tasks picked, updated, completed or parked. */
export function dayReport(day: string, activity: Activity[], tasks: Map<string, Task>, today: string) {
  const touched = new Map<string, { picked: boolean; logged: boolean; last: Status | null }>();
  for (const a of activity) {
    if (a.day !== day) continue;
    const e = touched.get(a.taskId) ?? { picked: false, logged: false, last: null };
    if (a.kind === "today") e.picked = true;
    if (a.kind === "log") e.logged = true;
    if (isStatus(a.kind)) e.last = a.kind;
    touched.set(a.taskId, e);
  }

  const entries: DayEntry[] = [];
  for (const [id, e] of touched) {
    const task = tasks.get(id);
    if (!task) continue;
    // Plain "created" or "moved back to To Do" isn't work for that day.
    if (!e.picked && !e.logged && (e.last === "todo" || e.last === "in_progress")) continue;
    const outcome: DayOutcome =
      e.last === "done"
        ? "done"
        : e.last === "pending"
          ? "pending"
          : day === today && task.status === "today"
            ? "today"
            : e.picked
              ? "carried"
              : "worked";
    entries.push({ task, picked: e.picked, logged: e.logged, outcome });
  }

  const rank: Record<DayOutcome, number> = { today: 0, carried: 1, worked: 2, pending: 3, done: 4 };
  entries.sort((a, b) => rank[a.outcome] - rank[b.outcome]);

  return {
    entries,
    picked: entries.filter((e) => e.picked).length,
    done: entries.filter((e) => e.outcome === "done").length,
    pending: entries.filter((e) => e.outcome === "pending").length,
    carried: entries.filter((e) => e.outcome === "carried").length,
  };
}

export function daysInStatus(task: Task, today: string) {
  const since = task.statusSince ?? task.lastWorkedOn;
  return since ? Math.max(0, daysBetween(since, today)) : 0;
}
