// GET /api/kds/queue — staff-only KDS feed: active orders + open waiter alerts (M6).
import { prisma } from "@/lib/db";
import { needStaff, j } from "@/lib/api";

export async function GET(req: Request) {
  const deny = needStaff(req);
  if (deny) return deny;
  const orders = await prisma.order.findMany({
    where: { status: { in: ["new", "accepted", "cooking", "ready"] } },
  });
  // M6: NEW orders first (FCFS — whoever ordered first gets cooked first),
  // then in-progress; newest-first within a state.
  const rank: Record<string, number> = { new: 0, accepted: 1, cooking: 2, ready: 3 };
  orders.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || b.createdAt.getTime() - a.createdAt.getTime());
  const alerts = await prisma.waiterRequest.findMany({
    where: { done: false }, orderBy: { createdAt: "desc" },
  });
  return j({
    orders: orders.map((o) => ({
      id: o.id, table: o.table, source: o.source, items: JSON.parse(o.items),
      total_inr: o.totalInr, status: o.status, paid: o.paid, partialMatch: o.partialMatch,
      created_at: o.createdAt,
    })),
    alerts,
  });
}
