"use client";

import {
  CheckCircleIcon,
  CircleDashedIcon,
  HourglassIcon,
  ListChecksIcon,
  SunIcon,
  TrashIcon,
  XIcon,
  type Icon as PhIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Status } from "@/lib/types";

export const STATUS_ICON: Record<Status, PhIcon> = {
  today: SunIcon,
  todo: ListChecksIcon,
  in_progress: CircleDashedIcon,
  pending: HourglassIcon,
  done: CheckCircleIcon,
};

export const STATUS_TINT: Record<Status, string> = {
  today: "text-today-ink bg-today",
  todo: "text-ink-2 bg-line",
  in_progress: "text-carried-ink bg-carried",
  pending: "text-pending-ink bg-pending",
  done: "text-done-ink bg-done",
};

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: PhIcon;
  variant?: "primary" | "soft" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ icon: Icon, variant = "soft", size = "md", className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-10 px-3.5 text-sm",
        variant === "primary" && "bg-blue text-on-blue shadow-lift hover:bg-blue-deep",
        variant === "soft" && "bg-card text-ink-2 ring-1 ring-line hover:ring-ink/20",
        variant === "ghost" && "text-ink-2 hover:bg-ink/5",
        variant === "danger" && "text-red-600 hover:bg-red-500/10",
        className,
      )}
    >
      {Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} />}
      {children}
    </button>
  );
}

export function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const desktop = useIsDesktop();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <motion.div
            className="absolute inset-0 bg-ink/25 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cx(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-paper shadow-lift",
              "rounded-t-[28px] md:rounded-[28px]",
              wide ? "md:max-w-2xl" : "md:max-w-lg",
            )}
            initial={desktop ? { opacity: 0, scale: 0.96, y: 12 } : { y: "100%" }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 340 }}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-ink/15 md:hidden" />
            <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2 md:pt-5">
              <div className="min-w-0 text-base font-bold">{title}</div>
              <Button variant="ghost" size="sm" icon={XIcon} onClick={onClose}>
                Close
              </Button>
            </div>
            <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Floating menu anchored to a trigger, rendered in a portal so scroll containers don't clip it. */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  width = 220,
}: {
  open: boolean;
  onClose: () => void;
  anchor: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  width?: number;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current!.getBoundingClientRect();
      const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
      const up = r.bottom + 280 > window.innerHeight && r.top > 280;
      setPos({ top: up ? window.innerHeight - r.top + 6 : r.bottom + 6, left, up });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchor]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={panel}
          className="fixed z-[60] overflow-hidden rounded-2xl bg-card p-1.5 shadow-lift ring-1 ring-line"
          style={{
            ...(pos.up ? { bottom: pos.top } : { top: pos.top }),
            left: pos.left,
            width,
            transformOrigin: pos.up ? "bottom right" : "top right",
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.14 }}
          // Portals still bubble React events; keep menu clicks from reaching the card/drag handle behind.
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function MenuItem({
  icon: Icon,
  children,
  onClick,
  active,
  color,
  danger,
}: {
  icon?: PhIcon;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  color?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition",
        danger
          ? "text-red-600 hover:bg-red-500/10"
          : active
            ? "bg-blue-soft text-sky"
            : "text-ink-2 hover:bg-ink/5",
      )}
    >
      {color && <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />}
      {Icon && <Icon className="size-4 shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** Two-tap delete: first tap arms it, second tap within a few seconds deletes. */
export function DeleteButton({
  onConfirm,
  label = "Delete",
  iconOnly,
}: {
  onConfirm: () => void;
  label?: string;
  iconOnly?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      className={cx(
        "flex h-7 shrink-0 items-center gap-1 rounded-lg px-1.5 text-[11px] font-semibold transition",
        armed ? "bg-red-500/15 text-red-600" : "text-mute hover:text-red-600",
      )}
    >
      <TrashIcon className="size-3.5" />
      {armed ? "Confirm" : !iconOnly && label}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-bold tracking-wider text-mute uppercase">{children}</div>;
}
