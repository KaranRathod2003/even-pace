"use client";

import {
  FolderIcon,
  HourglassIcon,
  PlusIcon,
  SkipForwardIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useBoard } from "./board-context";
import { LabelPicker } from "./label-picker";
import { Button, DeleteButton, FieldLabel, MenuItem, Sheet } from "./ui";

export function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="New task">
      {open && <CreateForm onDone={onClose} />}
    </Sheet>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const { createTask, notify } = useBoard();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [reportingToId, setReportingToId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await createTask({ title, notes, categoryId, reportingToId });
      notify("Added to To Do");
      onDone();
    } catch {
      notify("Couldn't create task");
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div>
        <FieldLabel>Task name</FieldLabel>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Task name"
          className="h-12 w-full rounded-xl bg-card px-3.5 text-base font-semibold ring-1 ring-line outline-none focus:ring-blue"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Category</FieldLabel>
          <LabelPicker kind="category" value={categoryId} onChange={setCategoryId} icon={FolderIcon} placeholder="Category" />
        </div>
        <div>
          <FieldLabel>Reporting to</FieldLabel>
          <LabelPicker
            kind="reporting"
            value={reportingToId}
            onChange={setReportingToId}
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
          placeholder="Notes"
          className="field-sizing-content min-h-28 w-full resize-none rounded-2xl bg-card p-3.5 text-sm leading-relaxed ring-1 ring-line outline-none focus:ring-blue"
        />
      </div>
      <Button type="submit" variant="primary" icon={PlusIcon} disabled={!title.trim() || busy} className="h-12 w-full text-base">
        Create task
      </Button>
    </form>
  );
}

/** Shown when a task is moved to Pending: pick who/what it's waiting on. */
export function PendingSheet() {
  const { askPending, setAskPending, labelsOf, move, removeLabel, notify } = useBoard();
  const [picked, setPicked] = useState<string | null>(null);
  const close = () => {
    setAskPending(null);
    setPicked(null);
  };
  const confirm = (id: string | null) => {
    if (askPending) move(askPending, "pending", id);
    close();
  };
  const options = labelsOf("pending");

  return (
    <Sheet open={!!askPending} onClose={close} title="Pending on">
      <div className="space-y-3 pt-1">
        {options.length > 0 && (
          <div className="rounded-2xl bg-card p-1.5 ring-1 ring-line">
            {options.map((o) => (
              <div key={o.id} className="flex items-center gap-0.5">
                <div className="min-w-0 flex-1">
                  <MenuItem color={o.color} onClick={() => confirm(o.id)}>
                    {o.name}
                  </MenuItem>
                </div>
                <DeleteButton iconOnly label={`Delete ${o.name}`} onConfirm={() => removeLabel(o.id).catch(() => notify("Couldn't delete"))} />
              </div>
            ))}
          </div>
        )}
        <LabelPicker kind="pending" value={picked} onChange={(id) => id && confirm(id)} icon={HourglassIcon} placeholder="Add new" />
        <Button variant="ghost" icon={SkipForwardIcon} className="w-full" onClick={() => confirm(null)}>
          Skip
        </Button>
      </div>
    </Sheet>
  );
}
