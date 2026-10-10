// POST /api/session { token } — verify signed QR token -> short-lived table session (M1).
import { verifyTable } from "@/lib/tokens";
import { issueSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { bodyTooBig, j } from "@/lib/api";

export async function POST(req: Request) {
  if (bodyTooBig(req)) return j({ error: "body too large" }, 413);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`sess:${ip}`, LIMITS.sessionPerIp.max, LIMITS.sessionPerIp.windowMs))
    return j({ error: "too many scans — try again shortly" }, 429);
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  const table = verifyTable(String(token ?? ""), process.env.RESTAURANT_ID ?? "cafe-demo");
  if (!table) return j({ error: "invalid QR — ask staff for the table code" }, 403); // T1/T3

  const ttlMin = Number(process.env.SESSION_TTL_MINUTES ?? 90);
  const row = await prisma.tableSession.create({
    data: { table, expiresAt: new Date(Date.now() + ttlMin * 60_000) },
  });
  const jwt = issueSession(row.id, table);
  const res = j({ session: jwt, table, restaurant: process.env.RESTAURANT_NAME ?? "Cafe" });
  res.cookies.set("tap_session", jwt, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: ttlMin * 60, path: "/",
  });
  return res;
}
