import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession, passcodeEnabled } from "@/lib/passcode";

// Passcode gate (only when APP_PASSWORD is set, i.e. on the deployed site).
// Unauthenticated page visits go to /unlock; other requests get 401.
export async function proxy(request: NextRequest) {
  if (!passcodeEnabled()) return NextResponse.next();
  if (request.nextUrl.pathname === "/unlock") return NextResponse.next();

  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const isPageVisit = request.method === "GET" && request.headers.get("accept")?.includes("text/html");
  if (isPageVisit) return NextResponse.redirect(new URL("/unlock", request.url));
  return new NextResponse("Unauthorized", { status: 401 });
}

export const config = {
  // The cron endpoint has its own secret; PWA files must load before unlocking.
  matcher: ["/((?!_next/static|_next/image|icon.png|apple-icon.png|icons/|sw.js|manifest.webmanifest|api/cron/).*)"],
};
