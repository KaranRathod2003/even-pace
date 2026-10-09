"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as actions from "@/lib/actions";
import { groupByTask } from "@/lib/history";
import type { Activity, BoardData, Label, LabelKind, Status, Task } from "@/lib/types";

type Board = {
  tasks: Task[];
  labels: Label[];
  activity: Activity[];
  activityByTask: Map<string, Activity[]>;
  today: string;
  label: (id: string | null) => Label | undefined;
  labelsOf: (kind: LabelKind) => Label[];
  createTask: typeof actions.createTask;
  updateTask: (id: string, patch: Parameters<typeof actions.updateTask>[1]) => Promise<void>;
  move: (id: string, status: Status, pendingOnId?: string | null) => void;
  snooze: (id: string, snoozed: boolean) => void;
  removeTask: (id: string) => Promise<void>;
  addLog: typeof actions.addLog;
  createLabel: typeof actions.createLabel;
  updateLabel: (id: string, patch: { name?: string; color?: string }) => Promise<void>;
  removeLabel: (id: string) => Promise<void>;
  /** Ask for a "pending on" reason before moving to Pending. */
  askPending: string | null;
  setAskPending: (id: string | null) => void;
  toast: string | null;
  notify: (msg: string) => void;
};

const Ctx = createContext<Board | null>(null);

export function useBoard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBoard outside BoardProvider");
  return ctx;
}

const SYNC_EVERY_MS = 5 * 60 * 1000;

export function BoardProvider({ initial, children }: { initial: BoardData; children: ReactNode }) {
  const [tasks, setTasks] = useState(initial.tasks);
  const [labels, setLabels] = useState(initial.labels);
  const [today, setToday] = useState(initial.today);
  const [activity, setActivity] = useState(initial.activity);
  const [askPending, setAskPending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const tasksRef = useRef(tasks);
  const todayRef = useRef(today);
  useEffect(() => {
    tasksRef.current = tasks;
    todayRef.current = today;
  }, [tasks, today]);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Pick up the 8 PM rollover and day change when the app is reopened or left open.
  useEffect(() => {
    const sync = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const data = await actions.syncBoard();
        setTasks(data.tasks);
        setLabels(data.labels);
        setActivity(data.activity);
        setToday(data.today);
      } catch {
        // offline: keep current state
      }
    };
    const id = setInterval(sync, SYNC_EVERY_MS);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const replace = (t: Task) => setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)));

  /** Apply locally first, then confirm with the server; roll back on failure. */
  const optimistic = useCallback(
    async (apply: (ts: Task[]) => Task[], run: () => Promise<Task | void>) => {
      const prev = tasksRef.current;
      setTasks(apply);
      try {
        const res = await run();
        if (res) replace(res);
      } catch {
        setTasks(prev);
        notify("Couldn't save. Try again");
      }
    },
    [notify],
  );

  const activityByTask = useMemo(() => groupByTask(activity), [activity]);
  const track = (taskId: string, kind: Activity["kind"]) =>
    setActivity((a) => [...a, { taskId, day: todayRef.current, kind }]);

  const value = useMemo<Board>(() => {
    const byId = new Map(labels.map((l) => [l.id, l]));
    return {
      tasks,
      labels,
      activity,
      activityByTask,
      today,
      askPending,
      setAskPending,
      toast,
      notify,
      label: (id) => (id ? byId.get(id) : undefined),
      labelsOf: (kind) => labels.filter((l) => l.kind === kind),

      createTask: async (input) => {
        const t = await actions.createTask(input);
        setTasks((ts) => [t, ...ts]);
        track(t.id, "todo");
        return t;
      },

      updateTask: (id, patch) =>
        optimistic(
          (ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          () => actions.updateTask(id, patch),
        ),

      move: (id, status, pendingOnId) => {
        const current = tasksRef.current.find((t) => t.id === id);
        if (!current) return;
        if (status === "pending" && pendingOnId === undefined) {
          setAskPending(id);
          return;
        }
        if (current.status === status && status !== "pending") return;
        track(id, status);
        void optimistic(
          (ts) =>
            ts.map((t) =>
              t.id === id
                ? {
                    ...t,
                    status,
                    position: Date.now(),
                    statusSince: today,
                    completedAt: status === "done" ? new Date().toISOString() : null,
                    pendingOnId: status === "pending" ? (pendingOnId ?? null) : null,
                    ...(status === "today" && { lastWorkedOn: today, snoozedOn: null }),
                  }
                : t,
            ),
          () => actions.moveTask(id, status, pendingOnId),
        );
      },

      snooze: (id, snoozed) =>
        void optimistic(
          (ts) => ts.map((t) => (t.id === id ? { ...t, snoozedOn: snoozed ? today : null } : t)),
          () => actions.setSnooze(id, snoozed),
        ),

      removeTask: async (id) => {
        await optimistic(
          (ts) => ts.filter((t) => t.id !== id),
          () => actions.deleteTask(id),
        );
        setActivity((a) => a.filter((x) => x.taskId !== id));
      },

      addLog: async (taskId, note) => {
        const res = await actions.addLog(taskId, note);
        replace(res.task);
        track(taskId, "log");
        return res;
      },

      createLabel: async (kind, name, color) => {
        const l = await actions.createLabel(kind, name, color);
        setLabels((ls) => [...ls, l]);
        return l;
      },

      updateLabel: async (id, patch) => {
        setLabels((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
        try {
          await actions.updateLabel(id, patch);
        } catch {
          notify("Couldn't save. Try again");
        }
      },

      removeLabel: async (id) => {
        await actions.deleteLabel(id);
        setLabels((ls) => ls.filter((l) => l.id !== id));
        setTasks((ts) =>
          ts.map((t) => ({
            ...t,
            categoryId: t.categoryId === id ? null : t.categoryId,
            reportingToId: t.reportingToId === id ? null : t.reportingToId,
            pendingOnId: t.pendingOnId === id ? null : t.pendingOnId,
          })),
        );
      },
    };
  }, [tasks, labels, activity, activityByTask, today, askPending, toast, notify, optimistic]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
