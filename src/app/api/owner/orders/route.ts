// GET /api/owner/orders — staff-only day-book: today's orders incl. served, newest first.
import { prisma } from "@/lib/db";
import { needStaff, j } from "@/lib/api";

export async function GET(req: Request) {
  const deny = needStaff(req);
  if (deny) return deny;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const billed_inr = orders.filter((o) => o.status === "served").reduce((s, o) => s + o.totalInr, 0);
  const paid_inr = orders.filter((o) => o.paid).reduce((s, o) => s + o.totalInr, 0);
  return j({
    billed_inr, paid_inr,
    orders: orders.map((o) => ({
      id: o.id, table: o.table, source: o.source, items: JSON.parse(o.items),
      total_inr: o.totalInr, status: o.status, paid: o.paid, partialMatch: o.partialMatch,
      created_at: o.createdAt,
    })),
  });
}
