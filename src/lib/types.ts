export type Status = "todo" | "today" | "in_progress" | "pending" | "done";
export type LabelKind = "category" | "reporting" | "pending";

export type Label = {
  id: string;
  kind: LabelKind;
  name: string;
  color: string;
};

export type Task = {
  id: string;
  title: string;
  notes: string;
  categoryId: string | null;
  reportingToId: string | null;
  pendingOnId: string | null;
  status: Status;
  position: number;
  takenAt: string | null;
  lastWorkedOn: string | null;
  snoozedOn: string | null;
  statusSince: string | null;
  completedAt: string | null;
  createdAt: string;
};

/** A status change, or a day with a work-log update ("log"). */
export type Activity = {
  taskId: string;
  day: string;
  kind: Status | "log";
};

export type WorkLog = {
  id: string;
  taskId: string;
  day: string;
  note: string;
  createdAt: string;
};

export type BoardData = {
  tasks: Task[];
  labels: Label[];
  activity: Activity[];
  today: string;
};

export const HISTORY_DAYS = 45;

export const STATUS_ORDER: Status[] = ["today", "todo", "in_progress", "pending", "done"];

export const STATUS_LABEL: Record<Status, string> = {
  today: "Today",
  todo: "To Do",
  in_progress: "In Progress",
  pending: "Pending",
  done: "Done",
};

export const LABEL_KIND_TITLE: Record<LabelKind, string> = {
  category: "Categories",
  reporting: "Reporting to",
  pending: "Pending on",
};

export const COLORS = [
  "#FFE761", // Sunny Yellow
  "#B0D6F7", // Sky Blue
  "#FCB390", // Coral Orange
  "#91F8D3", // Mint Green
  "#D3BDFC", // Light Lavender
  "#FEA3E3", // Cotton Candy
  "#F2D3A2", // Caramel light
  "#E6E1D2", // Cloudy grey
];
