// GET /api/orders/mine — this table's orders only. Never another table's (M5/T8).
import { prisma } from "@/lib/db";
import { needSession, j } from "@/lib/api";

export async function GET(req: Request) {
  const s = needSession(req);
  if (s instanceof Response) return s;
  const orders = await prisma.order.findMany({
    where: { sessionId: s.sid },
    orderBy: { createdAt: "desc" },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  return j({
    orders: orders.map((o) => ({
      id: o.id, table: o.table, source: o.source,
      items: JSON.parse(o.items), total_inr: o.totalInr,
      status: o.status, partialMatch: o.partialMatch, created_at: o.createdAt,
      events: o.events,
    })),
  });
}
