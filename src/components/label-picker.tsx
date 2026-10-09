"use client";

import {
  CaretDownIcon,
  PlusIcon,
  XIcon,
  type Icon as PhIcon,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { COLORS, type LabelKind } from "@/lib/types";
import { useBoard } from "./board-context";
import { DeleteButton, MenuItem, Popover, cx } from "./ui";

export function LabelPicker({
  kind,
  value,
  onChange,
  icon: Icon,
  placeholder,
}: {
  kind: LabelKind;
  value: string | null;
  onChange: (id: string | null) => void;
  icon: PhIcon;
  placeholder: string;
}) {
  const { labelsOf, label, createLabel, removeLabel, notify } = useBoard();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const options = labelsOf(kind);
  const selected = label(value);

  const add = async () => {
    const name = draft.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const l = await createLabel(kind, name, COLORS[options.length % COLORS.length]);
      onChange(l.id);
      setDraft("");
      setOpen(false);
    } catch {
      notify("Couldn't add");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "flex h-11 w-full items-center gap-2 rounded-xl bg-card px-3 text-left text-sm ring-1 transition",
          open ? "ring-blue" : "ring-line hover:ring-ink/20",
        )}
      >
        {selected ? (
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: selected.color }} />
        ) : (
          <Icon className="size-4 shrink-0 text-mute" />
        )}
        <span className={cx("flex-1 truncate font-medium", !selected && "text-mute")}>
          {selected?.name ?? placeholder}
        </span>
        <CaretDownIcon className="size-4 text-mute" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} width={260}>
        <div className="max-h-56 overflow-y-auto">
          {value && (
            <MenuItem
              icon={XIcon}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear
            </MenuItem>
          )}
          {options.map((o) => (
            <div key={o.id} className="flex items-center gap-0.5">
              <div className="min-w-0 flex-1">
                <MenuItem
                  color={o.color}
                  active={o.id === value}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  {o.name}
                </MenuItem>
              </div>
              <DeleteButton
                iconOnly
                label={`Delete ${o.name}`}
                onConfirm={() => {
                  removeLabel(o.id).catch(() => notify("Couldn't delete"));
                  if (o.id === value) onChange(null);
                }}
              />
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
          className="mt-1 flex items-center gap-1 border-t border-line pt-1.5"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add new"
            maxLength={60}
            className="h-9 min-w-0 flex-1 rounded-lg bg-paper px-2.5 text-sm outline-none focus:ring-1 focus:ring-blue"
          />
          <button
            type="submit"
            disabled={!draft.trim() || busy}
            className="flex h-9 items-center gap-1 rounded-lg bg-blue px-2.5 text-xs font-semibold text-on-blue disabled:opacity-40"
          >
            <PlusIcon className="size-3.5" /> Add
          </button>
        </form>
      </Popover>
    </>
  );
}
