"use server";

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { db, labels, pushSubscriptions, taskEvents, tasks, workLogs } from "@/db";
import { buildDigest, sendToOwner, type Slot } from "./push";
import { istDay } from "./day";
import { loadBoard, recordEvent, toLabel, toLog, toTask } from "./data";
import { getOwnerId } from "./session";
import type { Activity, LabelKind, Status } from "./types";

// Server actions are public POST endpoints: validate every input and scope
// every query to the owner.

const Id = z.uuid();
const OptionalId = z.uuid().nullable().optional();
const Title = z.string().trim().min(1).max(200);
const Notes = z.string().max(20_000);
const StatusSchema = z.enum(["todo", "today", "in_progress", "pending", "done"]);
const KindSchema = z.enum(["category", "reporting", "pending"]);
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

async function assertLabel(ownerId: string, id: string | null | undefined, kind: LabelKind) {
  if (!id) return;
  const [row] = await db()
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.id, id), eq(labels.ownerId, ownerId), eq(labels.kind, kind)));
  if (!row) throw new Error("Unknown label");
}

function own(ownerId: string, id: string) {
  return and(eq(tasks.id, id), eq(tasks.ownerId, ownerId));
}

function found<T>(row: T | undefined): T {
  if (!row) throw new Error("Not found");
  return row;
}

export async function syncBoard() {
  return loadBoard(await getOwnerId());
}

/** Activity (and the tasks it mentions) for a calendar range, inclusive. */
export async function getActivityRange(from: string, to: string) {
  const ownerId = await getOwnerId();
  const Day = z.iso.date();
  Day.parse(from);
  Day.parse(to);
  const [events, logDays] = await Promise.all([
    db()
      .select({ taskId: taskEvents.taskId, day: taskEvents.day, kind: taskEvents.status })
      .from(taskEvents)
      .where(and(eq(taskEvents.ownerId, ownerId), gte(taskEvents.day, from), lte(taskEvents.day, to)))
      .orderBy(asc(taskEvents.createdAt)),
    db()
      .selectDistinct({ taskId: workLogs.taskId, day: workLogs.day })
      .from(workLogs)
      .where(and(eq(workLogs.ownerId, ownerId), gte(workLogs.day, from), lte(workLogs.day, to))),
  ]);
  const activity: Activity[] = [...events, ...logDays.map((l) => ({ ...l, kind: "log" as const }))];
  const ids = [...new Set(activity.map((a) => a.taskId))];
  const rows = ids.length
    ? await db().select().from(tasks).where(and(eq(tasks.ownerId, ownerId), inArray(tasks.id, ids)))
    : [];
  return { activity, tasks: rows.map(toTask) };
}

/* ---------- tasks ---------- */

export async function createTask(input: {
  title: string;
  notes?: string;
  categoryId?: string | null;
  reportingToId?: string | null;
}) {
  const ownerId = await getOwnerId();
  const data = z
    .object({ title: Title, notes: Notes.optional(), categoryId: OptionalId, reportingToId: OptionalId })
    .parse(input);
  await assertLabel(ownerId, data.categoryId, "category");
  await assertLabel(ownerId, data.reportingToId, "reporting");
  const [row] = await db()
    .insert(tasks)
    .values({
      ownerId,
      title: data.title,
      notes: data.notes ?? "",
      categoryId: data.categoryId ?? null,
      reportingToId: data.reportingToId ?? null,
      status: "todo",
      statusSince: istDay(),
      position: Date.now(),
    })
    .returning();
  const task = found(row);
  await recordEvent(ownerId, task.id, "todo", istDay());
  return toTask(task);
}

export async function updateTask(
  id: string,
  input: { title?: string; notes?: string; categoryId?: string | null; reportingToId?: string | null; pendingOnId?: string | null },
) {
  const ownerId = await getOwnerId();
  Id.parse(id);
  const data = z
    .object({
      title: Title.optional(),
      notes: Notes.optional(),
      categoryId: OptionalId,
      reportingToId: OptionalId,
      pendingOnId: OptionalId,
    })
    .parse(input);
  await assertLabel(ownerId, data.categoryId, "category");
  await assertLabel(ownerId, data.reportingToId, "reporting");
  await assertLabel(ownerId, data.pendingOnId, "pending");
  const [row] = await db()
    .update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(own(ownerId, id))
    .returning();
  return toTask(found(row));
}

export async function moveTask(id: string, status: Status, pendingOnId?: string | null) {
  const ownerId = await getOwnerId();
  Id.parse(id);
  StatusSchema.parse(status);
  OptionalId.parse(pendingOnId);
  if (status === "pending") await assertLabel(ownerId, pendingOnId, "pending");

  const now = new Date();
  const day = istDay(now);
  const patch: Partial<typeof tasks.$inferInsert> = {
    status,
    statusSince: day,
    position: now.getTime(),
    updatedAt: now,
    pendingOnId: status === "pending" ? (pendingOnId ?? null) : null,
    completedAt: status === "done" ? now : null,
  };
  if (status === "today") {
    patch.takenAt = now;
    patch.lastWorkedOn = day;
    patch.snoozedOn = null;
  }
  const [row] = await db().update(tasks).set(patch).where(own(ownerId, id)).returning();
  const task = found(row);
  await recordEvent(ownerId, task.id, status, day);
  return toTask(task);
}

export async function setSnooze(id: string, snoozed: boolean) {
  const ownerId = await getOwnerId();
  Id.parse(id);
  const [row] = await db()
    .update(tasks)
    .set({ snoozedOn: snoozed ? istDay() : null, updatedAt: new Date() })
    .where(own(ownerId, id))
    .returning();
  return toTask(found(row));
}

export async function deleteTask(id: string) {
  const ownerId = await getOwnerId();
  Id.parse(id);
  await db().delete(tasks).where(own(ownerId, id));
}

/* ---------- work log ---------- */

export async function getLogs(taskId: string) {
  const ownerId = await getOwnerId();
  Id.parse(taskId);
  const rows = await db()
    .select()
    .from(workLogs)
    .where(and(eq(workLogs.taskId, taskId), eq(workLogs.ownerId, ownerId)))
    .orderBy(desc(workLogs.createdAt));
  return rows.map(toLog);
}

export async function addLog(taskId: string, note: string) {
  const ownerId = await getOwnerId();
  Id.parse(taskId);
  const text = z.string().trim().min(1).max(5_000).parse(note);
  const day = istDay();
  const [task] = await db()
    .update(tasks)
    .set({ lastWorkedOn: day, updatedAt: new Date() })
    .where(own(ownerId, taskId))
    .returning();
  const [log] = await db()
    .insert(workLogs)
    .values({ ownerId, taskId: found(task).id, day, note: text })
    .returning();
  return { task: toTask(found(task)), log: toLog(found(log)) };
}

export async function deleteLog(id: string) {
  const ownerId = await getOwnerId();
  Id.parse(id);
  await db()
    .delete(workLogs)
    .where(and(eq(workLogs.id, id), eq(workLogs.ownerId, ownerId)));
}

/* ---------- notifications ---------- */

const PushSub = z.object({
  endpoint: z.url().max(2_000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(200) }),
});

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const ownerId = await getOwnerId();
  const s = PushSub.parse(sub);
  await db()
    .insert(pushSubscriptions)
    .values({ ownerId, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { ownerId, p256dh: s.keys.p256dh, auth: s.keys.auth },
    });
}

export async function removePushSubscription(endpoint: string) {
  const ownerId = await getOwnerId();
  z.url().parse(endpoint);
  await db()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.ownerId, ownerId)));
}

export async function sendTestPush(slot: Slot) {
  const ownerId = await getOwnerId();
  z.enum(["morning", "evening"]).parse(slot);
  return sendToOwner(ownerId, await buildDigest(ownerId, slot));
}

/* ---------- lists ---------- */

export async function createLabel(kind: LabelKind, name: string, color?: string) {
  const ownerId = await getOwnerId();
  const data = z
    .object({ kind: KindSchema, name: z.string().trim().min(1).max(60), color: Color.optional() })
    .parse({ kind, name, color });
  const [row] = await db()
    .insert(labels)
    .values({ ownerId, kind: data.kind, name: data.name, ...(data.color && { color: data.color }) })
    .returning();
  return toLabel(found(row));
}

export async function updateLabel(id: string, input: { name?: string; color?: string }) {
  const ownerId = await getOwnerId();
  Id.parse(id);
  const data = z
    .object({ name: z.string().trim().min(1).max(60).optional(), color: Color.optional() })
    .parse(input);
  const [row] = await db()
    .update(labels)
    .set(data)
    .where(and(eq(labels.id, id), eq(labels.ownerId, ownerId)))
    .returning();
  return toLabel(found(row));
}

export async function deleteLabel(id: string) {
  const ownerId = await getOwnerId();
  Id.parse(id);
  await db()
    .delete(labels)
    .where(and(eq(labels.id, id), eq(labels.ownerId, ownerId)));
}
