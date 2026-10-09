"use client";

import {
  BellRingingIcon,
  BellSimpleIcon,
  BellSlashIcon,
  MoonStarsIcon,
  PaperPlaneTiltIcon,
  SunHorizonIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/lib/actions";
import { useBoard } from "./board-context";
import { Popover, cx } from "./ui";

type State = "loading" | "unsupported" | "install" | "off" | "on" | "blocked";

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches;

export function AlertsButton() {
  const { notify } = useBoard();
  const [state, setState] = useState<State>("loading");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const check = async (): Promise<State> => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return isIOS() && !isStandalone() ? "install" : "unsupported";
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const sub = await reg.pushManager.getSubscription();
      if (Notification.permission === "denied") return "blocked";
      return sub ? "on" : "off";
    };
    check()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        }));
      await savePushSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setState("on");
      notify("Alerts on · 9:00 AM & 6:30 PM");
    } catch {
      notify("Couldn't turn on alerts");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setOpen(false);
      notify("Alerts off");
    } catch {
      notify("Couldn't turn off alerts");
    } finally {
      setBusy(false);
    }
  };

  const test = async (slot: "morning" | "evening") => {
    try {
      const r = await sendTestPush(slot);
      if (!r.sent) notify("No device received it");
    } catch {
      notify("Couldn't send");
    }
  };

  if (state === "loading" || state === "unsupported") return null;

  const on = state === "on";
  const Icon = on ? BellRingingIcon : state === "blocked" ? BellSlashIcon : BellSimpleIcon;

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => (state === "off" ? void enable() : setOpen((o) => !o))}
        disabled={busy}
        className={cx(
          "flex items-center gap-1.5 rounded-xl font-semibold transition disabled:opacity-50",
          "h-9 px-2.5 text-xs md:h-10 md:px-3.5 md:text-sm",
          on ? "text-sky ring-1 ring-blue/40 hover:bg-blue-soft" : "text-ink-2 ring-1 ring-line hover:ring-ink/20",
        )}
      >
        <Icon className="size-[18px] md:size-5" weight={on ? "regular" : "light"} />
        Alerts
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} width={250}>
        {state === "on" && (
          <div className="space-y-1">
            <SlotRow icon={SunHorizonIcon} time="9:00 AM" label="Add today's tasks" onTest={() => test("morning")} />
            <SlotRow icon={MoonStarsIcon} time="6:30 PM" label="Update today's tasks" onTest={() => test("evening")} />
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              onClick={disable}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10"
            >
              <BellSlashIcon className="size-4" /> Turn off
            </button>
          </div>
        )}
        {state === "blocked" && (
          <p className="p-2 text-sm text-ink-2">Notifications are blocked for this site in browser settings.</p>
        )}
        {state === "install" && (
          <p className="p-2 text-sm text-ink-2">On iPhone: Share → Add to Home Screen, then open flow from there.</p>
        )}
      </Popover>
    </>
  );
}

function SlotRow({
  icon: Icon,
  time,
  label,
  onTest,
}: {
  icon: typeof SunHorizonIcon;
  time: string;
  label: string;
  onTest: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2">
      <Icon className="size-5 shrink-0 text-sky" />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11px] text-mute">{time}</div>
        <div className="truncate text-sm font-medium">{label}</div>
      </div>
      <button
        type="button"
        onClick={onTest}
        className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-ink-2 ring-1 ring-line hover:bg-ink/5"
      >
        <PaperPlaneTiltIcon className="size-3.5" /> Test
      </button>
    </div>
  );
}
