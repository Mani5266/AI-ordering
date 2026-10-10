import { NextResponse } from "next/server";
import { verifyTable } from "@/lib/tokens";
import { issueSession } from "@/lib/session";
import { prisma } from "@/lib/db";

// QR landing (route handler — pages cannot set cookies in Next 14):
// signed token in -> server session + cookie out -> redirect to /table/N (M1).
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const base = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const table = verifyTable(decodeURIComponent(params.token), process.env.RESTAURANT_ID ?? "cafe-demo");
  if (!table)
    return new NextResponse("<h1>TapOrder AI</h1><p>Invalid QR — ask staff for the table code.</p>", {
      status: 403, headers: { "Content-Type": "text/html" },
    });
  const ttlMin = Number(process.env.SESSION_TTL_MINUTES ?? 90);
  const row = await prisma.tableSession.create({
    data: { table, expiresAt: new Date(Date.now() + ttlMin * 60_000) },
  });
  const res = NextResponse.redirect(`${base}/table/${table}`);
  res.cookies.set("tap_session", issueSession(row.id, table), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: ttlMin * 60, path: "/",
  });
  return res;
}
