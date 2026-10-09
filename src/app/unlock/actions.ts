"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, safeEqual, sessionToken } from "@/lib/passcode";

export async function unlock(_prev: { error: boolean }, formData: FormData) {
  const secret = process.env.APP_PASSWORD;
  if (!secret) redirect("/");

  const given = String(formData.get("passcode") ?? "");
  if (!safeEqual(given, secret)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 800));
    return { error: true };
  }

  (await cookies()).set(SESSION_COOKIE, await sessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}
