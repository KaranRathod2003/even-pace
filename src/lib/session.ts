import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isValidSession, passcodeEnabled } from "./passcode";

// Single-user for now. Every query is already scoped by owner, so adding
// Neon Auth later means only changing this function to return the signed-in
// user's id (and throwing when there is none).
export async function getOwnerId(): Promise<string> {
  // Second line of defence behind the proxy: every page render and server
  // action checks the passcode session too.
  if (passcodeEnabled()) {
    const value = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!(await isValidSession(value))) throw new Error("Unauthorized");
  }
  return process.env.OWNER_ID ?? "me";
}
