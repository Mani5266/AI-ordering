// POST /api/webhooks/omnidim/[secret] — voice order receiver (PRD 7.4, 9/T4).
// Auth: path secret AND x-webhook-secret header must BOTH match (OmniDim signs nothing).
import { prisma } from "@/lib/db";
import { validateOrder } from "@/lib/validate";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { bodyTooBig, j } from "@/lib/api";

type EV = {
  items_json?: unknown; items?: unknown; order_items?: unknown;
  table?: number; table_number?: number;
  session_id?: string; sessionId?: string;
  confirmed?: boolean; confirmation?: unknown;
  notes?: string; call_id?: string;
};

function extract(raw: unknown): { ev: EV; callId: string | null } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const report = (r.call_report ?? {}) as Record<string, unknown>;
  // OmniDim nests vars under call_report.extracted_variables; accept top-level too.
  const nested = (report.extracted_variables ?? {}) as Record<string, unknown>;
  const flat = (r.extracted_variables ?? {}) as Record<string, unknown>;
  const ev = { ...flat, ...nested } as EV;
  const idstr = (v: unknown) =>
    typeof v === "string" && v ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null;
  const callId =
    idstr(ev.call_id) || idstr(report.call_id) || idstr(report.callId) || idstr(r.call_id) ||
    idstr(r.callId) || idstr(report.id) || idstr(r.id) || idstr(r.call_sid) || idstr(report.call_sid) ||
    null;
  return { ev, callId };
}

// Table fallback: the agent always speaks the table number ("table 7").
// Custom vars are NOT echoed in this payload, so mine the summary/conversation text.
function tableFromText(report: Record<string, unknown>): number | null {
  for (const k of ["summary", "full_conversation", "fullConversation"]) {
    const t = report[k];
    if (typeof t === "string") {
      const m = t.match(/table\s+(\d{1,2})/i);
      if (m) { const n = Number(m[1]); if (n >= 1 && n <= 10) return n; }
    }
  }
  return null;
}

// items_json may arrive as a JSON string — parse defensively (PRD 7.4).
function toItems(v: unknown): { menu_item_id?: string; name?: string; qty: number; modifiers: string[] }[] | null {
  try {
    const arr = typeof v === "string" ? JSON.parse(v) : v;
    if (!Array.isArray(arr)) return null;
    return arr.map((it) => ({
      menu_item_id: typeof it.menu_item_id === "string" ? it.menu_item_id : undefined,
      name: typeof it.name === "string" ? it.name : undefined,
      qty: Number(it.qty ?? it.quantity ?? 1),
      modifiers: Array.isArray(it.modifiers) ? it.modifiers.map(String) : [],
    }));
  } catch { return null; }
}

export async function POST(req: Request, { params }: { params: { secret: string } }) {
  if (bodyTooBig(req)) return j({ error: "body too large" }, 413);
  const want = process.env.WEBHOOK_SECRET ?? "";
  const pathOk = params.secret.length === want.length && params.secret === want;
  // Defense in depth: if the provider can send x-webhook-secret, it must match.
  // OmniDim's dashboard webhook sends no custom headers, so the unguessable path
  // secret is the credential; idempotency + schema + rate limit stand behind it (T4).
  const header = req.headers.get("x-webhook-secret");
  if (!pathOk || (header !== null && header !== want)) {
    console.warn("[webhook] rejected: bad secret");
    return j({ error: "forbidden" }, 403); // T4: no order, logged
  }
  if (!rateLimit("webhook:omnidim", LIMITS.webhook.max, LIMITS.webhook.windowMs))
    return j({ error: "rate limited" }, 429);

  const raw = await req.json().catch(() => null);
  const { ev, callId } = extract(raw);
  if (!callId) { console.warn("[webhook] rejected: missing call id"); return j({ error: "missing call id" }, 422); }

  // idempotency: one call ID -> at most one order (T4)
  const dup = await prisma.order.findUnique({ where: { providerCallId: callId } });
  if (dup) return j({ id: dup.id, duplicate: true });

  const items = toItems(ev.items_json ?? ev.items ?? ev.order_items);
  if (!items) { console.warn("[webhook] rejected: unparseable items", { callId }); return j({ error: "unparseable items" }, 422); }
  const rawTable = Number(ev.table ?? ev.table_number);
  const table = Number.isInteger(rawTable) && rawTable >= 1 && rawTable <= 10
    ? rawTable
    : tableFromText((raw as Record<string, unknown>).call_report as Record<string, unknown> ?? {});
  if (!Number.isInteger(table) || table < 1 || table > 10) {
    console.warn("[webhook] rejected: bad table", { callId }); return j({ error: "bad table" }, 422);
  }

  // bind to a live session for that table (injected at call start from Screen 1, PRD 7.1)
  let sessionId = typeof ev.session_id === "string" ? ev.session_id : typeof ev.sessionId === "string" ? ev.sessionId : null;
  if (sessionId) {
    const s = await prisma.tableSession.findUnique({ where: { id: sessionId } });
    if (!s || s.invalidated || s.expiresAt < new Date() || s.table !== table) sessionId = null;
  }
  if (!sessionId) {
    const s = await prisma.tableSession.findFirst({
      where: { table, invalidated: false, expiresAt: { gt: new Date() } },
      orderBy: { issuedAt: "desc" },
    });
    sessionId = s?.id ?? null;
  }
  if (!sessionId) { console.warn("[webhook] rejected: no live session", { callId, table }); return j({ error: "no live session for table" }, 422); }

  const confRaw = ev.confirmed ?? ev.confirmation;
  const agreed = confRaw === true || (typeof confRaw === "string" && /^\s*(yes|y|confirmed|confirm)\b/i.test(confRaw));
  const v = await validateOrder(
    { table, items: items.map((i) => ({ ...i, note: typeof ev.notes === "string" ? ev.notes : null })), confirmed: agreed },
    { sessionTable: table, source: "voice" },
  );
  if (!v.ok) { console.warn("[webhook] rejected: validation", { callId, error: v.error }); return j({ error: v.error }, 422); }

  try {
    const order = await prisma.order.create({
      data: {
        table, source: "voice", items: JSON.stringify(v.lines),
        totalInr: v.total!, confirmed: true, status: "new",
        sessionId, providerCallId: callId, partialMatch: v.partialMatch ?? false,
      },
    });
    await prisma.orderEvent.create({ data: { orderId: order.id, from: "—", to: "new", actor: "webhook" } });
    return j({ id: order.id, table, total_inr: v.total, partialMatch: v.partialMatch }, 201);
  } catch (e) {
    // race on unique call ID -> treat as duplicate (exactly one row, T4)
    const dup2 = await prisma.order.findUnique({ where: { providerCallId: callId } });
    if (dup2) return j({ id: dup2.id, duplicate: true });
    throw e;
  }
}
