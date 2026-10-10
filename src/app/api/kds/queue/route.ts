// GET /api/kds/queue — staff-only KDS feed: active orders + open waiter alerts (M6).
import { prisma } from "@/lib/db";
import { needStaff, j } from "@/lib/api";

export async function GET(req: Request) {
  const deny = needStaff(req);
  if (deny) return deny;
  const orders = await prisma.order.findMany({
    where: { status: { in: ["new", "accepted", "cooking", "ready"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const alerts = await prisma.waiterRequest.findMany({
    where: { done: false }, orderBy: { createdAt: "desc" },
  });
  return j({
    orders: orders.map((o) => ({
      id: o.id, table: o.table, source: o.source, items: JSON.parse(o.items),
      total_inr: o.totalInr, status: o.status, partialMatch: o.partialMatch,
      created_at: o.createdAt,
    })),
    alerts,
  });
}
