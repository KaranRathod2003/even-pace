import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import webpush from "web-push";
import { db, pushSubscriptions, tasks } from "@/db";
import { istDay } from "./day";

export type PushPayload = { title: string; body: string; tag: string; url?: string };
export type Slot = "morning" | "evening";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("VAPID keys are not set");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:flow@example.com", pub, priv);
  configured = true;
}

/** Sends to every device of the owner; drops subscriptions the push service says are gone. */
export async function sendToOwner(ownerId: string, payload: PushPayload) {
  configure();
  const subs = await db().select().from(pushSubscriptions).where(eq(pushSubscriptions.ownerId, ownerId));
  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 4, urgency: "normal" },
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
      }
    }),
  );
  if (dead.length) await db().delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
  return { sent, removed: dead.length };
}

/** Very short daily nudges. */
export async function buildDigest(ownerId: string, slot: Slot): Promise<PushPayload> {
  const open = await db()
    .select({ status: tasks.status, lastWorkedOn: tasks.lastWorkedOn, snoozedOn: tasks.snoozedOn })
    .from(tasks)
    .where(and(eq(tasks.ownerId, ownerId), ne(tasks.status, "done")));
  const today = istDay();
  const count = (fn: (t: (typeof open)[number]) => boolean) => open.filter(fn).length;

  if (slot === "morning") {
    const midway = count((t) => t.status === "in_progress" && !!t.lastWorkedOn && t.lastWorkedOn < today && t.snoozedOn !== today);
    const pending = count((t) => t.status === "pending");
    const bits = [midway && `${midway} left midway`, pending && `${pending} pending`].filter(Boolean);
    return {
      title: "Add today's tasks",
      body: bits.length ? bits.join(" · ") : "Pick what you'll work on today",
      tag: "morning",
    };
  }

  const inToday = count((t) => t.status === "today");
  return {
    title: "Update today's tasks",
    body: inToday ? `${inToday} task${inToday > 1 ? "s" : ""} in Today` : "Nothing picked today",
    tag: "evening",
  };
}

export async function ownersWithPush() {
  const rows = await db().selectDistinct({ ownerId: pushSubscriptions.ownerId }).from(pushSubscriptions);
  return rows.map((r) => r.ownerId);
}
