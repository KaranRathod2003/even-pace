import type { Task } from "./types";

// Everything day-based runs on India time, regardless of server/device timezone.
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;
export const ROLLOVER_HOUR_IST = 20;

/** IST calendar day as YYYY-MM-DD. */
export function istDay(d: Date = new Date()) {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Most recent 8 PM IST at or before `now`. Today-tasks taken before this roll over. */
export function lastRollover(now: Date = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const boundary =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), ROLLOVER_HOUR_IST) -
    IST_OFFSET_MS;
  return new Date(boundary <= now.getTime() ? boundary : boundary - DAY_MS);
}

export function addDays(day: string, n: number) {
  return new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

export function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatLongDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function relativeDay(day: string, today: string) {
  const n = daysBetween(day, today);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  return `${n}d ago`;
}

/** Worked on before, still in progress, not touched today, and not snoozed for today. */
export function needsAttention(task: Task, today: string) {
  return (
    task.status === "in_progress" &&
    !!task.lastWorkedOn &&
    task.lastWorkedOn < today &&
    task.snoozedOn !== today
  );
}
