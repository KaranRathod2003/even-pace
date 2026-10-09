"use client";

import {
  BellSlashIcon,
  BellRingingIcon,
  FolderIcon,
  HourglassIcon,
  NotePencilIcon,
  PaperPlaneTiltIcon,
  TrashIcon,
  UserCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { deleteLog, getLogs } from "@/lib/actions";
import { formatDay, istDay, needsAttention, relativeDay } from "@/lib/day";
import { STATUS_LABEL, STATUS_ORDER, type Task, type WorkLog } from "@/lib/types";
import { daysInStatus } from "@/lib/history";
import { useBoard } from "./board-context";
import { Consistency, ConsistencyLegend } from "./consistency";
import { pendingFor } from "./task-card";
import { LabelPicker } from "./label-picker";
import { Button, DeleteButton, FieldLabel, STATUS_ICON, Sheet, cx } from "./ui";

export function TaskSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { tasks } = useBoard();
  const task = tasks.find((t) => t.id === taskId);
  return (
    <Sheet open={!!task} onClose={onClose} title={task ? STATUS_LABEL[task.status] : ""} wide>
      {task && <TaskDetail key={task.id} task={task} onClose={onClose} />}
    </Sheet>
  );
}

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const { updateTask, move, snooze, removeTask, addLog, today, notify } = useBoard();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [update, setUpdate] = useState("");
  const [logs, setLogs] = useState<WorkLog[] | null>(null);
  const [posting, setPosting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    getLogs(task.id)
      .then((l) => alive && setLogs(l))
      .catch(() => alive && setLogs([]));
    return () => {
      alive = false;
    };
  }, [task.id]);

  const saveTitle = () => {
    const t = title.trim();
    if (!t) return setTitle(task.title);
    if (t !== task.title) void updateTask(task.id, { title: t });
  };
  const saveNotes = () => {
    if (notes !== task.notes) void updateTask(task.id, { notes });
  };

  const postUpdate = async () => {
    const note = update.trim();
    if (!note || posting) return;
    setPosting(true);
    try {
      const { log } = await addLog(task.id, note);
      setLogs((l) => [log, ...(l ?? [])]);
      setUpdate("");
    } catch {
      notify("Couldn't save update");
    } finally {
      setPosting(false);
    }
  };

  const attention = needsAttention(task, today);
  const snoozedToday = task.status === "in_progress" && task.snoozedOn === today;

  return (
    <div className="space-y-5 pt-1">
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        rows={1}
        maxLength={200}
        className="field-sizing-content w-full resize-none bg-transparent text-xl leading-snug font-bold outline-none"
      />

      <div>
        <FieldLabel>Status</FieldLabel>
        <div className="scrollbar-none -mx-5 flex gap-1.5 overflow-x-auto px-5">
          {STATUS_ORDER.map((s) => {
            const Icon = STATUS_ICON[s];
            const active = task.status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => move(task.id, s)}
                className={cx(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition",
                  active ? "bg-blue text-on-blue" : "bg-card text-ink-2 ring-1 ring-line hover:ring-ink/20",
                )}
              >
                <Icon className="size-3.5" />
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel>Consistency · last 30 days</FieldLabel>
        <div className="space-y-2.5 rounded-2xl bg-card p-3.5 ring-1 ring-line">
          <Consistency taskId={task.id} span={30} large />
          <ConsistencyLegend />
          {task.status === "pending" && (
            <p className="text-xs font-semibold text-pending-ink">Pending for {pendingFor(daysInStatus(task, today))}</p>
          )}
        </div>
      </div>

      {(attention || snoozedToday) && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-blue-soft p-3 text-sm font-semibold text-sky">
          <span className="flex-1">
            Last worked {formatDay(task.lastWorkedOn!)} · {relativeDay(task.lastWorkedOn!, today)}
          </span>
          {attention ? (
            <Button size="sm" icon={BellSlashIcon} onClick={() => snooze(task.id, true)}>
              Snooze today
            </Button>
          ) : (
            <Button size="sm" icon={BellRingingIcon} onClick={() => snooze(task.id, false)}>
              Unsnooze
            </Button>
          )}
        </div>
      )}

      {task.status === "pending" && (
        <div>
          <FieldLabel>Pending on</FieldLabel>
          <LabelPicker
            kind="pending"
            value={task.pendingOnId}
            onChange={(id) => void updateTask(task.id, { pendingOnId: id })}
            icon={HourglassIcon}
            placeholder="Pending on"
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Category</FieldLabel>
          <LabelPicker
            kind="category"
            value={task.categoryId}
            onChange={(id) => void updateTask(task.id, { categoryId: id })}
            icon={FolderIcon}
            placeholder="Category"
          />
        </div>
        <div>
          <FieldLabel>Reporting to</FieldLabel>
          <LabelPicker
            kind="reporting"
            value={task.reportingToId}
            onChange={(id) => void updateTask(task.id, { reportingToId: id })}
            icon={UserCircleIcon}
            placeholder="Reporting to"
          />
        </div>
      </div>

      <div>
        <FieldLabel>Notes</FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Notes"
          className="field-sizing-content min-h-24 w-full resize-none rounded-2xl bg-card p-3.5 text-sm leading-relaxed ring-1 ring-line outline-none focus:ring-blue"
        />
      </div>

      <div>
        <FieldLabel>Work log</FieldLabel>
        <div className="rounded-2xl bg-card p-2 ring-1 ring-line focus-within:ring-blue">
          <textarea
            value={update}
            onChange={(e) => setUpdate(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void postUpdate();
            }}
            placeholder={`Update for ${formatDay(today)}`}
            className="field-sizing-content min-h-16 w-full resize-none bg-transparent p-1.5 text-sm outline-none"
          />
          <div className="flex justify-end">
            <Button size="sm" variant="primary" icon={PaperPlaneTiltIcon} disabled={!update.trim() || posting} onClick={postUpdate}>
              Add update
            </Button>
          </div>
        </div>

        <ol className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {(logs ?? []).map((l) => (
              <motion.li
                key={l.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-3"
              >
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 size-2 rounded-full bg-blue" />
                  <span className="w-px flex-1 bg-line" />
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-mute">{formatDay(l.day)}</span>
                    <DeleteButton
                      iconOnly
                      label="Delete update"
                      onConfirm={() => {
                        setLogs((ls) => (ls ?? []).filter((x) => x.id !== l.id));
                        deleteLog(l.id).catch(() => notify("Couldn't delete"));
                      }}
                    />
                  </div>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap text-ink-2">{l.note}</p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
          {logs === null && <li className="h-10 animate-pulse rounded-xl bg-line/50" />}
          {logs?.length === 0 && (
            <li className="flex items-center gap-2 text-xs text-mute">
              <NotePencilIcon className="size-3.5" /> No updates yet
            </li>
          )}
        </ol>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-4">
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="danger"
              icon={TrashIcon}
              className="bg-red-500/10"
              onClick={() => {
                onClose();
                void removeTask(task.id);
              }}
            >
              Confirm delete
            </Button>
            <Button size="sm" variant="ghost" icon={XIcon} onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="danger" icon={TrashIcon} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
        <span className="font-mono text-[11px] text-mute">
          Created {formatDay(istDay(new Date(task.createdAt)))}
        </span>
      </div>
    </div>
  );
}
