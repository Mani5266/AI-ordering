"use client";
import { useEffect, useState } from "react";

type Line = { menu_item_id: string; name: string; qty: number; modifiers: string[]; note: string | null; veg: boolean; allergens: string[] };
type Order = { id: string; table: number; source: string; items: Line[]; total_inr: number; status: string; partialMatch: boolean; created_at: string };

const FLOW: Record<string, string> = { new: "accepted", accepted: "cooking", cooking: "ready", ready: "served" };
const LABEL: Record<string, string> = { new: "✅ Accept order", accepted: "🍳 Start cooking", cooking: "🔔 Mark ready", ready: "🧾 Mark served" };
const STATUS_COLOR: Record<string, string> = { new: "border-red-500", accepted: "border-amber-500", cooking: "border-[#0A2463]", ready: "border-green-600" };

export default function Kds() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [alerts, setAlerts] = useState<{ id: string; table: number; kind: string }[]>([]);
  const [summary, setSummary] = useState<{ orders: number; revenue_inr: number; customers_today: number; voice: number; tap: number; voice_share: number; avg_order_seconds: { voice: number; tap: number }; top_dishes: { name: string; qty: number }[] } | null>(null);

  const load = (p: string) => {
    const h = { "x-staff-pin": p };
    fetch("/api/kds/queue", { headers: h }).then(async (r) => {
      if (!r.ok) return;
      setAuthed(true);
      const d = await r.json();
      setOrders(d.orders); setAlerts(d.alerts);
    });
    fetch("/api/owner/summary", { headers: h }).then((r) => r.json()).then(setSummary).catch(() => {});
  };

  useEffect(() => {
    if (!authed) return;
    const t = setInterval(() => load(pin), 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const act = async (id: string, to: string) => {
    await fetch(`/api/orders/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json", "x-staff-pin": pin }, body: JSON.stringify({ to }) });
    load(pin);
  };

  const dismissAlert = async (id: string) => {
    await fetch("/api/waiter", { method: "PATCH", headers: { "Content-Type": "application/json", "x-staff-pin": pin }, body: JSON.stringify({ id }) });
    load(pin);
  };

  const resetTable = async () => {
    const t = Number(prompt("Reset sessions for table (1-10)?"));
    if (!t || t < 1 || t > 10) return;
    const r = await fetch("/api/session/invalidate", { method: "POST", headers: { "Content-Type": "application/json", "x-staff-pin": pin }, body: JSON.stringify({ table: t }) });
    alert(r.ok ? `Table ${t} sessions reset.` : "Reset failed.");
  };

  if (!authed)
    return (
      <main className="mx-auto max-w-sm p-8 text-center">
        <div className="mb-4 bg-[#0A2463] py-3 text-xl font-bold text-white">☕ Demo Cafe — Staff</div>
        <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" type="password" placeholder="Staff PIN"
          className="mt-2 w-full rounded border p-2 text-center text-2xl" onKeyDown={(e) => e.key === "Enter" && load(pin)} />
        <button onClick={() => load(pin)} className="mt-2 w-full rounded bg-[#0A2463] py-2 text-white">Open KDS</button>
      </main>
    );

  const fresh = orders.filter((o) => o.status === "new").length;
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between bg-[#0A2463] px-4 py-3 text-white">
        <div className="font-bold">☕ Demo Cafe — Kitchen {fresh > 0 && <span className="ml-2 animate-pulse rounded bg-red-600 px-2 py-0.5 text-sm">{fresh} NEW</span>}</div>
        <button onClick={resetTable} className="text-xs underline">Reset table sessions</button>
      </header>

      {summary && (
        <section className="grid grid-cols-2 gap-2 p-3 md:grid-cols-6">
          <Stat label="Orders today" value={String(summary.orders)} />
          <Stat label="Customers today" value={String(summary.customers_today ?? 0)} />
          <Stat label="Revenue" value={`Rs ${summary.revenue_inr}`} />
          <Stat label="Voice share" value={`${summary.voice_share}% (${summary.voice}v/${summary.tap}t)`} />
          <Stat label="Avg order time" value={`${summary.avg_order_seconds.voice}s v / ${summary.avg_order_seconds.tap}s t`} />
          <Stat label="Top dishes" value={summary.top_dishes.map((d) => `${d.name}×${d.qty}`).join(", ") || "—"} />
        </section>
      )}

      {alerts.length > 0 && (
        <div className="px-3">
          {alerts.map((a) => (
            <div key={a.id} className="mb-2 flex items-center justify-between rounded bg-amber-200 p-2 font-bold">
              <span>🔔 Table {a.table} — {a.kind === "bill" ? "requests BILL" : "calls WAITER"}</span>
              <button onClick={() => dismissAlert(a.id)} className="rounded bg-[#0A2463] px-3 py-1 text-sm text-white">Done</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
        {orders.map((o) => (
          <article key={o.id} className={`rounded-lg border-l-8 bg-white p-3 shadow ${STATUS_COLOR[o.status] ?? "border-gray-300"}`}>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-[#0A2463]">Table {o.table}</span>
              <span className={`rounded px-2 py-0.5 text-xs font-bold text-white ${o.source === "voice" ? "bg-[#0A2463]" : "bg-[#3E6CB5]"}`}>
                {o.source === "voice" ? "🎙 Voice" : "👆 Tap"}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {o.status.toUpperCase()} · {Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000)} min ago · <b>Rs {o.total_inr}</b>
            </div>
            {o.partialMatch && <div className="mt-1 text-xs font-bold text-red-600">⚠ partial match — some items were rejected, check before cooking</div>}
            <ul className="mt-2 text-sm">
              {o.items.map((it, k) => (
                <li key={k} className="border-b py-1">
                  <b>{it.qty}× {it.name}</b>
                  {it.modifiers.length > 0 && <span className="text-gray-600"> ({it.modifiers.join(", ")})</span>}
                  {it.note && <div className="text-xs text-gray-600">📝 {it.note}</div>}
                  {it.allergens.length > 0 && <span className="ml-1 rounded bg-red-100 px-1 text-xs font-bold text-red-700">⚠ {it.allergens.join("/")}</span>}
                </li>
              ))}
            </ul>
            {FLOW[o.status] && (
              <button onClick={() => act(o.id, FLOW[o.status])} className="mt-3 w-full rounded-lg bg-[#0A2463] py-3 font-bold text-white">
                {LABEL[o.status]}
              </button>
            )}
          </article>
        ))}
        {orders.length === 0 && <p className="text-gray-500">No active orders — waiting for the next QR scan.</p>}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-2 text-center shadow">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-bold text-[#0A2463]">{value}</div>
    </div>
  );
}
