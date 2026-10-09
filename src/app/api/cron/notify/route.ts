import { timingSafeEqual } from "node:crypto";
import { buildDigest, ownersWithPush, sendToOwner, type Slot } from "@/lib/push";

// Called by a scheduler at 9:00 AM and 6:30 PM IST.
//   GET /api/cron/notify?slot=morning|evening
//   Authorization: Bearer <CRON_SECRET>   (Vercel Cron sends this automatically)

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const slotParam = new URL(request.url).searchParams.get("slot");
  // Default by IST hour so a scheduler without query params still works.
  const istHour = new Date(Date.now() + 330 * 60 * 1000).getUTCHours();
  const slot: Slot = slotParam === "morning" || slotParam === "evening" ? slotParam : istHour < 14 ? "morning" : "evening";

  const results = [];
  for (const ownerId of await ownersWithPush()) {
    const payload = await buildDigest(ownerId, slot);
    results.push({ ownerId, ...(await sendToOwner(ownerId, payload)) });
  }
  return Response.json({ slot, results });
}
