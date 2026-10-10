// POST /api/session/demo { table } — DEMO ONLY (QR scanning deferred).
// Auto-provisions a table session without a signed QR. Gated by DEMO_OPEN_TABLES=1.
// Set DEMO_OPEN_TABLES=0 for judging — /t/:signedToken stays the production entry point.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { issueSession } from "@/lib/session";
import { bodyTooBig, j } from "@/lib/api";

export async function POST(req: Request) {
  if (process.env.DEMO_OPEN_TABLES !== "1") return j({ error: "demo mode off" }, 403);
  if (bodyTooBig(req)) return j({ error: "body too large" }, 413);
  const { table } = z.object({ table: z.number().int().min(1).max(10) })
    .safeParse(await req.json().catch(() => null)).data ?? {};
  if (!table) return j({ error: "table 1-10 required" }, 422);
  const ttlMin = Number(process.env.SESSION_TTL_MINUTES ?? 90);
  const row = await prisma.tableSession.create({
    data: { table, expiresAt: new Date(Date.now() + ttlMin * 60_000) },
  });
  const res = j({ table });
  res.cookies.set("tap_session", issueSession(row.id, table), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: ttlMin * 60, path: "/",
  });
  return res;
}
