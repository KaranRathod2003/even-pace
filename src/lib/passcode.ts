// Shared by the proxy and server code: a session cookie holding an HMAC of
// APP_PASSWORD. Changing the passcode invalidates every existing session.

export const SESSION_COOKIE = "flow_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

export function passcodeEnabled() {
  return !!process.env.APP_PASSWORD;
}

export async function sessionToken(secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("flow-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(cookieValue: string | undefined) {
  const secret = process.env.APP_PASSWORD;
  if (!secret) return true;
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await sessionToken(secret));
}
