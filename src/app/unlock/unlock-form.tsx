"use client";

import { LockKeyIcon, LockKeyOpenIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useActionState } from "react";
import { unlock } from "./actions";

export function UnlockForm() {
  const [state, action, pending] = useActionState(unlock, { error: false });

  return (
    // Visible without JS: this page must never render blank.
    <form action={action} className="w-full max-w-sm rounded-[32px] bg-sun p-6 text-ink shadow-lift sm:p-8">
      <div className="flex items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-[13px] bg-ink text-xl font-bold text-sun">f</span>
        <span className="text-2xl font-bold tracking-tight">flow</span>
      </div>

      <label htmlFor="passcode" className="mt-8 block text-sm font-semibold text-ink/80">
        Passcode
      </label>
      <motion.input
        id="passcode"
        name="passcode"
        type="password"
        autoFocus
        autoComplete="current-password"
        required
        animate={state.error ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        key={state.error ? "err" : "ok"}
        className="mt-1.5 h-13 w-full rounded-2xl bg-card px-4 text-lg font-semibold tracking-widest ring-1 ring-ink/20 outline-none focus:ring-2 focus:ring-ink"
      />
      {state.error && <p className="mt-2 text-sm font-semibold text-red-700">Wrong passcode</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-base font-bold text-sun transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? <LockKeyOpenIcon className="size-5" /> : <LockKeyIcon className="size-5" />}
        Unlock
      </button>
    </form>
  );
}
