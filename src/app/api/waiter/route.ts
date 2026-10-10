// POST /api/waiter { kind: waiter|bill } — customer escalation -> KDS alert card (M7).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { needSession, bodyTooBig, j } from "@/lib/api";

export async function POST(req: Request) {
  if (bodyTooBig(req)) return j({ error: "body too large" }, 413);
  const s = needSession(req);
  if (s instanceof Response) return s;
  const { kind } = z.object({ kind: z.enum(["waiter", "bill"]) }).safeParse(await req.json().catch(() => null)).data ?? {};
  if (!kind) return j({ error: "kind must be waiter|bill" }, 422);
  const alert = await prisma.waiterRequest.create({ data: { table: s.table, kind } });
  return j({ id: alert.id, kind, table: s.table }, 201);
}

// PATCH /api/waiter { id } — staff marks alert done.
export async function PATCH(req: Request) {
  const { staffAuthed } = await import("@/lib/api");
  if (!staffAuthed(req)) return j({ error: "staff login required" }, 401);
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return j({ error: "id required" }, 422);
  await prisma.waiterRequest.update({ where: { id }, data: { done: true } });
  return j({ ok: true });
}
