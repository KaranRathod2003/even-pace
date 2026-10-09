import "server-only";
import { and, asc, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db, labels, taskEvents, tasks, workLogs } from "@/db";
import { addDays, istDay, lastRollover } from "./day";
import { HISTORY_DAYS, type Activity, type BoardData, type Label, type Status, type Task, type WorkLog } from "./types";

type TaskRow = typeof tasks.$inferSelect;
type LabelRow = typeof labels.$inferSelect;
type LogRow = typeof workLogs.$inferSelect;

export const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  notes: r.notes,
  categoryId: r.categoryId,
  reportingToId: r.reportingToId,
  pendingOnId: r.pendingOnId,
  status: r.status,
  position: r.position,
  takenAt: r.takenAt?.toISOString() ?? null,
  lastWorkedOn: r.lastWorkedOn,
  snoozedOn: r.snoozedOn,
  statusSince: r.statusSince,
  completedAt: r.completedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

export const toLabel = (r: LabelRow): Label => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  color: r.color,
});

export const toLog = (r: LogRow): WorkLog => ({
  id: r.id,
  taskId: r.taskId,
  day: r.day,
  note: r.note,
  createdAt: r.createdAt.toISOString(),
});

export async function recordEvent(ownerId: string, taskId: string, status: Status, day: string) {
  await db().insert(taskEvents).values({ ownerId, taskId, status, day });
}

// IST day of the first 8 PM after the task was taken.
const rolloverDaySql = sql<string>`(CASE
  WHEN EXTRACT(HOUR FROM ${tasks.takenAt} AT TIME ZONE 'Asia/Kolkata') < 20
  THEN (${tasks.takenAt} AT TIME ZONE 'Asia/Kolkata')::date
  ELSE (${tasks.takenAt} AT TIME ZONE 'Asia/Kolkata')::date + 1 END)`;

/** Today-tasks picked before the last 8 PM IST move to In Progress. */
export async function rollover(ownerId: string) {
  const rolled = await db()
    .update(tasks)
    .set({ status: "in_progress", statusSince: rolloverDaySql, updatedAt: new Date() })
    .where(
      and(
        eq(tasks.ownerId, ownerId),
        eq(tasks.status, "today"),
        lt(tasks.takenAt, lastRollover()),
      ),
    )
    .returning({ id: tasks.id, day: tasks.statusSince });
  if (rolled.length) {
    await db()
      .insert(taskEvents)
      .values(rolled.map((r) => ({ ownerId, taskId: r.id, status: "in_progress" as const, day: r.day ?? istDay() })));
  }
}

const DONE_LIMIT = 300;

export async function loadBoard(ownerId: string): Promise<BoardData> {
  await rollover(ownerId);
  const today = istDay();
  const since = addDays(today, -HISTORY_DAYS);
  const [open, done, labelRows, events, logDays] = await Promise.all([
    db()
      .select()
      .from(tasks)
      .where(and(eq(tasks.ownerId, ownerId), ne(tasks.status, "done")))
      .orderBy(desc(tasks.position)),
    db()
      .select()
      .from(tasks)
      .where(and(eq(tasks.ownerId, ownerId), eq(tasks.status, "done")))
      .orderBy(desc(tasks.completedAt))
      .limit(DONE_LIMIT),
    db()
      .select()
      .from(labels)
      .where(eq(labels.ownerId, ownerId))
      .orderBy(asc(labels.createdAt)),
    db()
      .select({ taskId: taskEvents.taskId, day: taskEvents.day, kind: taskEvents.status })
      .from(taskEvents)
      .where(and(eq(taskEvents.ownerId, ownerId), gte(taskEvents.day, since)))
      .orderBy(asc(taskEvents.createdAt)),
    db()
      .selectDistinct({ taskId: workLogs.taskId, day: workLogs.day })
      .from(workLogs)
      .where(and(eq(workLogs.ownerId, ownerId), gte(workLogs.day, since))),
  ]);
  const activity: Activity[] = [...events, ...logDays.map((l) => ({ ...l, kind: "log" as const }))];
  return {
    tasks: [...open, ...done].map(toTask),
    labels: labelRows.map(toLabel),
    activity,
    today,
  };
}
