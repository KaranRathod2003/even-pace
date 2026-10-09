import {
  date,
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const taskStatus = pgEnum("task_status", [
  "todo",
  "today",
  "in_progress",
  "pending",
  "done",
]);

// One table for every user-managed list: categories, "reporting to" people,
// and "pending on" reasons/people.
export const labelKind = pgEnum("label_kind", ["category", "reporting", "pending"]);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    kind: labelKind("kind").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#FFE761"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("labels_owner_kind_idx").on(t.ownerId, t.kind)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    categoryId: uuid("category_id").references(() => labels.id, { onDelete: "set null" }),
    reportingToId: uuid("reporting_to_id").references(() => labels.id, { onDelete: "set null" }),
    pendingOnId: uuid("pending_on_id").references(() => labels.id, { onDelete: "set null" }),
    status: taskStatus("status").notNull().default("todo"),
    position: doublePrecision("position").notNull().default(0),
    // When the task was last pulled into Today (drives the 8 PM rollover).
    takenAt: timestamp("taken_at", { withTimezone: true }),
    // IST calendar days.
    lastWorkedOn: date("last_worked_on", { mode: "string" }),
    snoozedOn: date("snoozed_on", { mode: "string" }),
    // IST day the task entered its current status (e.g. "pending for 3 days").
    statusSince: date("status_since", { mode: "string" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tasks_owner_status_idx").on(t.ownerId, t.status)],
);

// Every status change, stamped with its IST day. Powers the calendar and the
// per-card consistency line.
export const taskEvents = pgTable(
  "task_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    status: taskStatus("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("task_events_owner_day_idx").on(t.ownerId, t.day)],
);

// One row per browser/device that turned on notifications.
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_owner_idx").on(t.ownerId)],
);

export const workLogs = pgTable(
  "work_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("work_logs_task_idx").on(t.taskId)],
);
