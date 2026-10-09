"use client";

import {
  FolderIcon,
  HourglassIcon,
  PlusIcon,
  UserCircleIcon,
  type Icon as PhIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { COLORS, LABEL_KIND_TITLE, type Label, type LabelKind } from "@/lib/types";
import { useBoard } from "./board-context";
import { DeleteButton, Popover, cx } from "./ui";

const KINDS: { kind: LabelKind; icon: PhIcon }[] = [
  { kind: "category", icon: FolderIcon },
  { kind: "reporting", icon: UserCircleIcon },
  { kind: "pending", icon: HourglassIcon },
];

export function ListsView() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {KINDS.map((k) => (
        <ListCard key={k.kind} kind={k.kind} icon={k.icon} />
      ))}
    </div>
  );
}

function ListCard({ kind, icon: Icon }: { kind: LabelKind; icon: PhIcon }) {
  const { labelsOf, createLabel, tasks, notify } = useBoard();
  const [draft, setDraft] = useState("");
  const items = labelsOf(kind);
  const field = kind === "category" ? "categoryId" : kind === "reporting" ? "reportingToId" : "pendingOnId";

  const add = async () => {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    try {
      await createLabel(kind, name, COLORS[items.length % COLORS.length]);
    } catch {
      notify("Couldn't add");
    }
  };

  return (
    <section className="rounded-3xl bg-card p-4 shadow-card ring-1 ring-line">
      <header className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-blue-soft text-sky">
          <Icon className="size-4" />
        </span>
        <h2 className="font-bold">{LABEL_KIND_TITLE[kind]}</h2>
        <span className="ml-auto font-mono text-xs text-mute">{items.length}</span>
      </header>

      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {items.map((l) => (
            <motion.li
              key={l.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <LabelRow label={l} uses={tasks.filter((t) => t[field] === l.id).length} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <form
        className="mt-3 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={60}
          placeholder={`Add ${LABEL_KIND_TITLE[kind].toLowerCase()}`}
          className="h-10 min-w-0 flex-1 rounded-xl bg-paper px-3 text-sm outline-none focus:ring-1 focus:ring-blue"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex h-10 items-center gap-1 rounded-xl bg-blue px-3 text-sm font-semibold text-on-blue transition active:scale-95 disabled:opacity-40"
        >
          <PlusIcon className="size-4" /> Add
        </button>
      </form>
    </section>
  );
}

function LabelRow({ label, uses }: { label: Label; uses: number }) {
  const { updateLabel, removeLabel, notify } = useBoard();
  const [name, setName] = useState(label.name);
  const [colorOpen, setColorOpen] = useState(false);
  const dot = useRef<HTMLButtonElement>(null);

  return (
    <div className="group flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-ink/[0.03]">
      <button
        ref={dot}
        type="button"
        aria-label="Color"
        onClick={() => setColorOpen((o) => !o)}
        className="flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-card"
      >
        <span className="size-3 rounded-full" style={{ background: label.color }} />
      </button>
      <Popover open={colorOpen} onClose={() => setColorOpen(false)} anchor={dot} width={196}>
        <div className="grid grid-cols-4 gap-1.5 p-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => {
                setColorOpen(false);
                void updateLabel(label.id, { color: c });
              }}
              className={cx(
                "size-9 rounded-xl transition hover:scale-105",
                c === label.color && "ring-2 ring-ink ring-offset-2 ring-offset-card",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </Popover>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const n = name.trim();
          if (!n) return setName(label.name);
          if (n !== label.name) void updateLabel(label.id, { name: n });
        }}
        maxLength={60}
        className="h-8 min-w-0 flex-1 rounded-lg bg-transparent px-1.5 text-sm font-medium outline-none focus:bg-card focus:ring-1 focus:ring-blue"
      />
      <span className="font-mono text-[11px] text-mute">{uses}</span>
      <DeleteButton onConfirm={() => removeLabel(label.id).catch(() => notify("Couldn't delete"))} />
    </div>
  );
}
