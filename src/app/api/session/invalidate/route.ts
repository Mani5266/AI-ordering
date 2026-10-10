// POST /api/session/invalidate — staff resets a table's sessions (new seating, PRD M1/T2).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { needStaff, bodyTooBig, j } from "@/lib/api";

export async function POST(req: Request) {
  const deny = needStaff(req);
  if (deny) return deny;
  if (bodyTooBig(req)) return j({ error: "body too large" }, 413);
  const { table } = z.object({ table: z.number().int().min(1).max(10) })
    .safeParse(await req.json().catch(() => null)).data ?? {};
  if (!table) return j({ error: "table 1-10 required" }, 422);
  const r = await prisma.tableSession.updateMany({
    where: { table, invalidated: false }, data: { invalidated: true },
  });
  return j({ table, invalidated: r.count });
}
