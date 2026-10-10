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
  const [pinError, setPinError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [alerts, setAlerts] = useState<{ id: string; table: number; kind: string }[]>([]);
  const [summary, setSummary] = useState<{ orders: number; revenue_inr: number; customers_today: number; voice: number; tap: number; voice_share: number; avg_order_seconds: { voice: number; tap: number }; top_dishes: { name: string; qty: number }[] } | null>(null);
  const [fStatus, setFStatus] = useState("all");
  const [fSource, setFSource] = useState("all");
  const [tab, setTab] = useState<"live" | "book">("live");
  const [book, setBook] = useState<{ billed_inr: number; orders: Order[] } | null>(null);

  const load = (p: string) => {
    const h = { "x-staff-pin": p };
    fetch("/api/kds/queue", { headers: h }).then(async (r) => {
      if (!r.ok) { setPinError(true); return; }
      setPinError(false);
      setAuthed(true);
      try { sessionStorage.setItem("tap_staff", p); } catch { /* private mode */ }
      const d = await r.json();
      setOrders(d.orders); setAlerts(d.alerts);
    });
    fetch("/api/owner/summary", { headers: h }).then(async (r) => {
      if (!r.ok) return; // wrong PIN — stay on login instead of crashing on the error shape
      setSummary(await r.json());
    }).catch(() => {});
    if (tab === "book") fetch("/api/owner/orders", { headers: h }).then(async (r) => {
      if (r.ok) setBook(await r.json());
    }).catch(() => {});
  };

  // stay signed in across refreshes; Sign out button ends it explicitly
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("tap_staff");
      if (saved) { setPin(saved); load(saved); }
    } catch { /* private mode */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = () => {
    try { sessionStorage.removeItem("tap_staff"); } catch { /* private mode */ }
    setPin(""); setAuthed(false); setOrders([]); setAlerts([]); setSummary(null);
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
        {pinError && <p className="mt-2 font-bold text-red-600">Wrong PIN — check STAFF_PIN and retry.</p>}
      </main>
    );

  const fresh = orders.filter((o) => o.status === "new").length;
  const visible = orders.filter((o) =>
    (fStatus === "all" || o.status === fStatus) && (fSource === "all" || o.source === fSource));
  return (
    <main className="min-h-screen bg-[#F6F4EE]">
      <header className="flex items-center justify-between bg-[#0A2463] px-4 py-3.5 text-white shadow">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-blue-200">Demo Cafe</div>
          <div className="font-serif text-xl font-bold">Kitchen {fresh > 0 && <span className="ml-2 animate-pulse rounded-full bg-red-600 px-2.5 py-0.5 align-middle text-sm">{fresh} NEW</span>}</div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <button onClick={resetTable} className="underline text-blue-100">Reset table sessions</button>
          <button onClick={signOut} className="rounded-full bg-white px-4 py-1.5 font-bold text-[#0A2463]">Sign out</button>
        </div>
      </header>

      {summary && (
        <section className="grid grid-cols-2 gap-2.5 p-3 md:grid-cols-6">
          <Stat icon="🧾" label="Orders today" value={String(summary.orders)} />
          <Stat icon="🧑‍🍳" label="Customers today" value={String(summary.customers_today ?? 0)} />
          <Stat icon="💰" label="Revenue" value={`Rs ${summary.revenue_inr}`} />
          <Stat icon="🎙" label="Voice share" value={`${summary.voice_share}% (${summary.voice}v/${summary.tap}t)`} />
          <Stat icon="⏱" label="Avg order time" value={`${fmtDur(summary.avg_order_seconds.voice)} v / ${fmtDur(summary.avg_order_seconds.tap)} t`} />
          <Stat icon="🏆" label="Top dishes" value={summary.top_dishes.map((d) => `${d.name}×${d.qty}`).join(", ") || "—"} />
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

      <div className="flex gap-2 px-3 pt-3">
        <button onClick={() => setTab("live")} className={`flex-1 rounded-xl py-2.5 font-bold ${tab === "live" ? "bg-[#0A2463] text-white" : "bg-white text-gray-600 shadow-sm"}`}>🔥 Live kitchen ({orders.length})</button>
        <button onClick={() => { setTab("book"); load(pin); }} className={`flex-1 rounded-xl py-2.5 font-bold ${tab === "book" ? "bg-[#0A2463] text-white" : "bg-white text-gray-600 shadow-sm"}`}>📒 Day-book {book ? `(Rs ${book.billed_inr})` : ""}</button>
      </div>

      {tab === "book" ? (
        <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
          {(book?.orders ?? []).map((o) => (
            <article key={o.id} className="rounded-2xl bg-white p-3 shadow-[0_1px_4px_rgba(10,36,99,0.08)]">
              <div className="flex items-center justify-between">
                <span className="font-serif text-lg font-bold text-[#0A2463]">Table {o.table}</span>
                <span className="text-xs font-bold text-gray-500">{new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="text-sm text-gray-700">{o.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${o.source === "voice" ? "bg-[#0A2463] text-white" : "bg-[#3E6CB5] text-white"}`}>{o.source}</span>
                <span className="text-sm"><span className="mr-2 capitalize text-gray-500">{o.status}</span><b>Rs {o.total_inr}</b></span>
              </div>
            </article>
          ))}
          {(book?.orders ?? []).length === 0 && <p className="text-gray-500">No orders yet today.</p>}
        </div>
      ) : (
      <>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 px-3">
        <span className="w-full text-[11px] font-bold uppercase tracking-wider text-gray-500 md:w-auto">Show:</span>
        {(["all", "new", "accepted", "cooking", "ready"] as const).map((s) => (
          <button key={s} onClick={() => setFStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${fStatus === s ? "bg-[#0A2463] text-white" : "bg-white text-gray-600 shadow-sm"}`}>
            {s === "all" ? "All status" : s}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-gray-300" />
        {(["all", "voice", "tap"] as const).map((s) => (
          <button key={s} onClick={() => setFSource(s)}
            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${fSource === s ? "bg-[#0A2463] text-white" : "bg-white text-gray-600 shadow-sm"}`}>
            {s === "all" ? "Voice + Tap" : s === "voice" ? "🎙 Voice" : "👆 Tap"}
          </button>
        ))}
        {(fStatus !== "all" || fSource !== "all") && (
          <span className="text-xs font-semibold text-gray-500">{visible.length} shown</span>
        )}
      </div>

      <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((o) => (
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
        {visible.length === 0 && <p className="text-gray-500">{orders.length === 0 ? "No active orders — waiting for the next QR scan." : "No orders match this filter."}</p>}
      </div>
      </>
      )}
    </main>
  );
}

function fmtDur(sec: number): string {
  if (!sec || sec <= 0) return "—";
  if (sec < 90) return `${sec}s`;
  const m = Math.round(sec / 60);
  return m < 90 ? `${m}m` : `${Math.round(m / 60)}h`;
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center shadow-[0_1px_4px_rgba(10,36,99,0.08)]">
      <div className="text-lg">{icon}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-serif text-lg font-bold text-[#0A2463]">{value}</div>
    </div>
  );
}
