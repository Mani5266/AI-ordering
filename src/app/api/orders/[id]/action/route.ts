// POST /api/orders/[id]/action — staff status transitions. Accept gate enforced (M6).
import { prisma } from "@/lib/db";
import { canTransition } from "@/lib/validate";
import { needStaff, bodyTooBig, j } from "@/lib/api";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = needStaff(req);
  if (deny) return deny;
  if (bodyTooBig(req)) return j({ error: "body too large" }, 413);
  const { to } = (await req.json().catch(() => ({}))) as { to?: string };
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return j({ error: "order not found" }, 404);
  if (typeof to !== "string" || !canTransition(order.status, to))
    return j({ error: `illegal transition ${order.status} -> ${to}` }, 422); // M5: no skip-ahead
  await prisma.order.update({ where: { id: order.id }, data: { status: to } });
  await prisma.orderEvent.create({ data: { orderId: order.id, from: order.status, to, actor: "staff" } });
  return j({ id: order.id, status: to });
}
