// GET /api/owner/summary — staff-only real aggregates, zeros when empty (M8).
import { prisma } from "@/lib/db";
import { needStaff, j } from "@/lib/api";

export async function GET(req: Request) {
  const deny = needStaff(req);
  if (deny) return deny;
  const range = new URL(req.url).searchParams.get("range") ?? "day";
  const start = new Date();
  if (range === "month") { start.setDate(start.getDate() - 30); }
  else if (range === "week") { start.setDate(start.getDate() - 7); }
  else { start.setHours(0, 0, 0, 0); }
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start } },
    include: { session: true },
  });
  const voice = orders.filter((o) => o.source === "voice");
  const tap = orders.filter((o) => o.source === "tap");
  const revenue = orders.reduce((s, o) => s + o.totalInr, 0);
  const avg = (xs: typeof orders) =>
    xs.length ? Math.round(xs.reduce((s, o) => s + (o.createdAt.getTime() - o.session.issuedAt.getTime()), 0) / xs.length / 1000) : 0;
  const dishCount = new Map<string, number>();
  for (const o of orders)
    for (const it of JSON.parse(o.items) as { name: string; qty: number }[])
      dishCount.set(it.name, (dishCount.get(it.name) ?? 0) + it.qty);
  const top = Array.from(dishCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([name, qty]) => ({ name, qty }));
  // footfall: one scanned session that ordered = one customer visit (PRD M8)
  const customers = new Set(orders.map((o) => o.sessionId)).size;
  const paid = orders.filter((o) => o.paid).reduce((s, o) => s + o.totalInr, 0);
  return j({
    range, orders: orders.length, revenue_inr: revenue, customers_today: customers,
    paid_inr: paid,
    voice: voice.length, tap: tap.length,
    voice_share: orders.length ? Math.round((voice.length / orders.length) * 100) : 0,
    completion_rate: undefined, // computed client-side from voice test log (M8) — never estimated here
    avg_order_seconds: { voice: avg(voice), tap: avg(tap) },
    top_dishes: top,
  });
}
