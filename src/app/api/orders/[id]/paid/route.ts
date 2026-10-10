// POST /api/orders/[id]/paid — staff marks the bill settled (cash/UPI at table).
// Razorpay plugs into this same flag later via its webhook (sets paid=true).
import { prisma } from "@/lib/db";
import { needStaff, bodyTooBig, j } from "@/lib/api";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = needStaff(req);
  if (deny) return deny;
  if (bodyTooBig(req)) return j({ error: "body too large" }, 413);
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return j({ error: "order not found" }, 404);
  if (!["ready", "served"].includes(order.status))
    return j({ error: "only ready/served orders can be marked paid" }, 422);
  await prisma.order.update({ where: { id: order.id }, data: { paid: true } });
  await prisma.orderEvent.create({ data: { orderId: order.id, from: order.status, to: order.status, actor: "staff" } });
  return j({ id: order.id, paid: true });
}
