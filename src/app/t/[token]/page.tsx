import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyTable } from "@/lib/tokens";
import { issueSession } from "@/lib/session";
import { prisma } from "@/lib/db";

// QR landing: signed token in, server session + cookie out, redirect to /table/N (M1).
export default async function ScanRedirect({ params }: { params: { token: string } }) {
  const table = verifyTable(decodeURIComponent(params.token), process.env.RESTAURANT_ID ?? "cafe-demo");
  if (!table)
    return (
      <main className="p-8 text-center">
        <h1 className="text-xl font-bold">TapOrder AI</h1>
        <p className="mt-4 text-red-600">Invalid QR — ask staff for the table code.</p>
      </main>
    );
  const ttlMin = Number(process.env.SESSION_TTL_MINUTES ?? 90);
  const row = await prisma.tableSession.create({
    data: { table, expiresAt: new Date(Date.now() + ttlMin * 60_000) },
  });
  cookies().set("tap_session", issueSession(row.id, table), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: ttlMin * 60, path: "/",
  });
  redirect(`/table/${table}`);
}
