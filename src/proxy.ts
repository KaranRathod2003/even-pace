import { NextResponse, type NextRequest } from "next/server";

// Until real login exists: if APP_PASSWORD is set (e.g. on the deployed site),
// the browser asks for it once. Any username works. Locally it's off.
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (given === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="flow"' },
  });
}

export const config = {
  // The cron endpoint has its own secret; PWA files must load without a password prompt.
  matcher: ["/((?!_next/static|_next/image|icon.png|apple-icon.png|icons/|sw.js|manifest.webmanifest|api/cron/).*)"],
};
