// POST /api/orders — tap order creation. Same M4 validation as voice (one pipeline).
import { prisma } from "@/lib/db";
import { validateOrder } from "@/lib/validate";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { needSession, bodyTooBig, j } from "@/lib/api";

export async function POST(req: Request) {
  if (bodyTooBig(req)) return j({ error: "body too large" }, 413);
  const s = needSession(req);
  if (s instanceof Response) return s;
  if (!rateLimit(`order:${s.sid}`, LIMITS.orderPerSession.max, LIMITS.orderPerSession.windowMs))
    return j({ error: "too many orders — wait a moment" }, 429);

  // session must be live and un-invalidated (T2)
  const sess = await prisma.tableSession.findUnique({ where: { id: s.sid } });
  if (!sess || sess.invalidated || sess.expiresAt < new Date())
    return j({ error: "session expired — please scan again" }, 401);

  const body = await req.json().catch(() => null);
  const v = await validateOrder(body, { sessionTable: s.table, source: "tap" });
  if (!v.ok) return j({ error: v.error }, 422);

  const order = await prisma.order.create({
    data: {
      table: s.table, source: "tap", items: JSON.stringify(v.lines),
      totalInr: v.total!, confirmed: true, status: "new",
      sessionId: s.sid, partialMatch: v.partialMatch ?? false,
    },
  });
  await prisma.orderEvent.create({
    data: { orderId: order.id, from: "—", to: "new", actor: "customer" },
  });
  return j({ id: order.id, table: order.table, items: v.lines, total_inr: v.total, status: "new" }, 201);
}
