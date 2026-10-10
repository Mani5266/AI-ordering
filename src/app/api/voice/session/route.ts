// POST /api/voice/session — mint a short-lived OmniDim web-call session (P3/M3).
// API key never leaves the server; the page only gets ws_url (OmniDim Web SDK pattern).
import { prisma } from "@/lib/db";
import { needSession, bodyTooBig, j } from "@/lib/api";

export async function POST(req: Request) {
  if (bodyTooBig(req)) return j({ error: "body too large" }, 413);
  const s = needSession(req);
  if (s instanceof Response) return s;
  const sess = await prisma.tableSession.findUnique({ where: { id: s.sid } });
  if (!sess || sess.invalidated || sess.expiresAt < new Date())
    return j({ error: "session expired — please scan again" }, 401);

  const r = await fetch("https://omnidim.io/api/v1/sessions/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OMNIDIM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: Number(process.env.OMNIDIM_AGENT_ID),
      type: "voice",
      custom_variables: { table: s.table, restaurant: process.env.RESTAURANT_NAME ?? "Demo Cafe", session_id: s.sid },
    }),
  });
  if (!r.ok) {
    console.error("[voice] session create failed", r.status, (await r.text()).slice(0, 200));
    return j({ error: "voice agent unreachable — tap your order below" }, 502);
  }
  const { ws_url } = (await r.json()) as { ws_url?: string };
  if (!ws_url) return j({ error: "voice agent unreachable — tap your order below" }, 502);
  return j({ ws_url });
}
