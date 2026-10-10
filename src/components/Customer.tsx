"use client";
import { useEffect, useState } from "react";
import VoiceWidget from "@/voice/widget";

type Item = { id: string; name: string; price_inr: number; veg: boolean; spice_level: string; allergens: string[]; available: boolean; category: string; aliases: string[] };
type CartLine = { ref: string; qty: number; modifiers: string[] };
type Order = { id: string; status: string; total_inr: number; items: unknown[] };

const MODS = ["less spicy", "extra spicy", "no onion", "extra chutney", "extra sambar", "less sugar", "strong"];
const AUTH: RequestCredentials = "include"; // scan-issued session cookie (set by /t/:token redirect)
const NAVY = "bg-[#0A2463]";

export default function Customer({ table }: { table: number }) {
  const [denied, setDenied] = useState(false);
  const [menu, setMenu] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [placing, setPlacing] = useState(false);
  const [reorder, setReorder] = useState(false); // back to menu after an order
  // Voice-first: the menu is for SEEING, the call is for ORDERING.
  // Tap stays only as a tucked-away fallback (noisy hall / mic denied / shy caller).
  const [tapMode, setTapMode] = useState(false);

  useEffect(() => {
    const loadMenu = () =>
      fetch("/api/menu", { credentials: AUTH }).then(async (r) => {
        if (r.status === 401) {
          // demo mode (scan deferred): mint a session for this table and retry once
          const d = await fetch("/api/session/demo", { method: "POST", credentials: AUTH,
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table }) });
          if (!d.ok) { setDenied(true); return; }
          const r2 = await fetch("/api/menu", { credentials: AUTH });
          if (!r2.ok) { setDenied(true); return; }
          setMenu((await r2.json()).items ?? []);
          return;
        }
        setMenu((await r.json()).items ?? []);
      }).catch(() => setDenied(true));
    loadMenu();
    const poll = () => fetch("/api/orders/mine", { credentials: AUTH })
      .then((r) => (r.ok ? r.json() : null)).then((d) => d && setOrders(d.orders ?? [])).catch(() => {});
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  if (denied)
    return (
      <main className="min-h-screen bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900">TapOrder AI</h1>
        <p className="mt-4 font-medium text-red-600">Session expired — please scan your table&apos;s QR again.</p>
      </main>
    );
  if (!menu.length) return <main className="min-h-screen bg-white p-8 text-center text-gray-900">Opening Table {table}…</main>;

  const add = (ref: string) => setCart((c) => { const f = c.find((l) => l.ref === ref); return f ? c.map((l) => l.ref === ref ? { ...l, qty: Math.min(20, l.qty + 1) } : l) : [...c, { ref, qty: 1, modifiers: [] }]; });
  const priceOf = (ref: string) => menu.find((m) => m.id === ref || m.name === ref)?.price_inr ?? 0;
  const total = cart.reduce((s, l) => s + priceOf(l.ref) * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const active = orders.filter((o) => !["served", "cancelled", "rejected"].includes(o.status));
  // Finished orders live ONLY on the manager dashboard — the customer side never
  // shows another meal's data. No active order = fresh menu, always.
  const confirmed = active.length > 0;
  const latest = active[0];
  const showMenu = !confirmed || reorder;
  const justFinished = orders.length > 0 && !confirmed && !reorder;

  const place = async () => {
    setPlacing(true);
    try {
      const r = await fetch("/api/orders", { method: "POST", credentials: AUTH, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, confirmed: true, items: cart.map((l) => ({ menu_item_id: l.ref, qty: l.qty, modifiers: l.modifiers })) }) });
      if (!r.ok) { alert("Order rejected: " + (await r.json()).error); return; }
      setCart([]);
      setReorder(false);
    } finally { setPlacing(false); }
  };

  const call = async (kind: "waiter" | "bill") => {
    await fetch("/api/waiter", { method: "POST", credentials: AUTH, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
    alert(kind === "bill" ? "Bill requested — staff will bring it." : "Waiter is on the way to your table.");
  };

  const groups = Array.from(new Set(menu.map((m) => m.category)));
  return (
    <main className="min-h-screen bg-[#F6F4EE] pb-40 text-gray-900">
      <header className={`${NAVY} px-4 pb-5 pt-4 text-center text-white`}>
        <div className="text-xs uppercase tracking-[0.25em] text-blue-200">Demo Cafe</div>
        <h1 className="mt-0.5 font-serif text-2xl font-bold tracking-wide">Table {table}</h1>
        <p className="mt-0.5 text-[11px] text-blue-100">One QR. One kitchen. Speak or tap.</p>
      </header>

      <div className="mx-auto w-full max-w-3xl px-3 md:px-6">
        {showMenu && (
          <>
            {confirmed && (
              <button onClick={() => setReorder(false)} className="mt-3 text-sm font-bold text-[#0A2463]">← Back to my order</button>
            )}
            <section className="relative -mt-0 overflow-hidden rounded-3xl bg-gradient-to-b from-[#14337a] to-[#0A2463] p-6 pb-7 text-center text-white shadow-xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-lg">📞</div>
              <div className="mt-2 font-serif text-3xl font-bold">Call to Order</div>
              <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-blue-100">Tap below and speak your order — e.g. “two masala dosa, one less spicy, three filter coffee”</p>
              <div className="mt-4 flex justify-center">
                <VoiceWidget table={table} session="" />
              </div>
            </section>
            <p className="my-4 text-center text-[13px] font-medium text-gray-500">See something you like? Call above — just say it.</p>

            {groups.map((g) => (
              <section key={g} className="mb-6">
                <div className="mb-2 flex items-center gap-3">
                  <h2 className="font-serif text-lg font-bold uppercase tracking-wider text-[#0A2463]">{g.replace("-", " ")}</h2>
                  <div className="h-px flex-1 bg-[#0A2463]/15" />
                  <span className="text-xs font-semibold text-gray-400">{menu.filter((m) => m.category === g).length} items</span>
                </div>
                <div className="grid gap-2.5 md:grid-cols-2">
                  {menu.filter((m) => m.category === g).map((m) => (
                    <article key={m.id} className={`flex items-start justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_4px_rgba(10,36,99,0.08)] ${m.available ? "" : "opacity-50"}`}>
                      <div className="flex min-w-0 gap-2.5">
                        <VegMark veg={m.veg} />
                        <div className="min-w-0">
                          <div className="font-serif text-[17px] font-bold leading-snug text-gray-900">{m.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-[#0A2463]/5 px-2 py-0.5 text-[13px] font-bold text-[#0A2463]">Rs {m.price_inr}</span>
                            {m.spice_level !== "none" && <span className="text-xs text-orange-600">{"🔥".repeat(m.spice_level === "hot" ? 2 : 1)} {m.spice_level}</span>}
                          </div>
                          {m.allergens.length > 0 && <div className="mt-1 text-[11px] font-medium text-red-600">contains: {m.allergens.join(", ")}</div>}
                        </div>
                      </div>
                      <button disabled={!m.available} onClick={() => add(m.id)}
                        className={`${NAVY} mt-0.5 shrink-0 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:bg-gray-300 ${tapMode ? "" : "hidden"}`}>
                        {m.available ? "Add" : "Out"}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            <div className="mb-6 mt-2 text-center">
              {!tapMode ? (
                <button onClick={() => setTapMode(true)} className="text-xs font-semibold text-gray-400 underline">
                  Noisy hall or no mic? Tap here to order manually instead
                </button>
              ) : (
                <button onClick={() => { setTapMode(false); setCart([]); }} className="text-xs font-semibold text-gray-400 underline">
                  Hide manual ordering
                </button>
              )}
            </div>
            {justFinished && (
              <div className="mb-3 rounded-xl bg-green-50 p-3 text-center text-sm font-semibold text-green-800">
                Thank you for dining with us! ☕ Scan a fresh QR for a new order.
              </div>
            )}
          </>
        )}

        {confirmed && latest && (
          <section className="mt-3">
            <div className="rounded-2xl bg-white p-5 text-center shadow">
              <div className="text-sm font-medium text-gray-500">Order status — Table {table}</div>
              <div className="text-3xl font-bold capitalize text-[#0A2463]">{latest.status}</div>
              <div className="mt-1 text-sm font-semibold">Rs {latest.total_inr}</div>
              <StatusBar status={latest.status} />
              <p className="mt-2 text-xs text-gray-500">Your food is on its way — the kitchen updates this screen live.</p>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => call("bill")} className="flex-1 rounded-xl border-2 border-[#0A2463] py-2.5 font-bold text-[#0A2463]">🧾 Request bill</button>
              <button onClick={() => call("waiter")} className="flex-1 rounded-xl border-2 border-[#0A2463] py-2.5 font-bold text-[#0A2463]">🙋 Call waiter</button>
            </div>
            <button onClick={() => { setReorder(true); window.scrollTo({ top: 0 }); }} className="mt-2 w-full rounded-xl bg-[#0A2463] py-2.5 font-bold text-white">＋ Order more</button>
            <Engagement />
          </section>
        )}
      </div>

      {cart.length > 0 && showMenu && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-white p-3 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-2 max-h-32 overflow-y-auto">
              {cart.map((l) => (
                <div key={l.ref} className="flex items-center justify-between py-0.5 text-sm font-medium text-gray-900">
                  <span>{menu.find((x) => x.id === l.ref)?.name} × {l.qty} <span className="text-gray-500">— Rs {priceOf(l.ref) * l.qty}</span></span>
                  <span>
                    <button aria-label="decrease" onClick={() => setCart((c) => c.map((x) => x.ref === l.ref ? { ...x, qty: Math.max(1, x.qty - 1) } : x))} className="px-2 text-lg font-bold text-[#0A2463]">−</button>
                    <button aria-label="increase" onClick={() => setCart((c) => c.map((x) => x.ref === l.ref ? { ...x, qty: Math.min(20, x.qty + 1) } : x))} className="px-2 text-lg font-bold text-[#0A2463]">+</button>
                    <button aria-label="remove" onClick={() => setCart((c) => c.filter((x) => x.ref !== l.ref))} className="px-2 font-bold text-red-600">✕</button>
                  </span>
                </div>
              ))}
              <details className="mt-1 text-xs text-gray-600"><summary className="cursor-pointer font-semibold">Add modifiers (spice, extras…)</summary>
                {cart.map((l) => (
                  <div key={l.ref} className="mt-1">{menu.find((x) => x.id === l.ref)?.name}: {MODS.map((mod) => (
                    <label key={mod} className="mr-2 inline-block py-0.5"><input type="checkbox" checked={l.modifiers.includes(mod)}
                      onChange={() => setCart((c) => c.map((x) => x.ref === l.ref ? { ...x, modifiers: x.modifiers.includes(mod) ? x.modifiers.filter((m) => m !== mod) : [...x.modifiers, mod] } : x))} /> {mod}</label>
                  ))}</div>
                ))}
              </details>
            </div>
            <button disabled={placing} onClick={place} className={`${NAVY} w-full rounded-xl py-3.5 text-base font-bold text-white`}>
              {placing ? "Placing…" : `Confirm order — ${count} item${count > 1 ? "s" : ""}, Rs ${total}`}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function VegMark({ veg }: { veg: boolean }) {
  const c = veg ? "border-green-700" : "border-red-700";
  const dot = veg ? "bg-green-700" : "bg-red-700";
  return (
    <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-2 ${c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
    </span>
  );
}

function StatusBar({ status }: { status: string }) {
  const steps = ["new", "accepted", "cooking", "ready", "served"];
  const i = steps.indexOf(status);
  return (
    <div className="mt-3">
      <div className="flex gap-1">{steps.slice(0, 4).map((s, k) => <div key={s} className={`h-2.5 flex-1 rounded-full ${k <= i ? "bg-[#0A2463]" : "bg-gray-200"}`} />)}</div>
      <div className="mt-1 flex justify-between text-[11px] font-semibold text-gray-500">
        <span>Received</span><span>Accepted</span><span>Cooking</span><span>Ready</span>
      </div>
    </div>
  );
}

function Engagement() {
  // PRD 3.4/M7: each item renders ONLY if configured — never a dead link.
  const links = [
    process.env.NEXT_PUBLIC_REVIEW_URL ? { icon: "⭐", label: "Review us", href: process.env.NEXT_PUBLIC_REVIEW_URL } : null,
    process.env.NEXT_PUBLIC_INSTA_URL ? { icon: "📸", label: "Instagram", href: process.env.NEXT_PUBLIC_INSTA_URL } : null,
    process.env.NEXT_PUBLIC_WA_URL ? { icon: "💬", label: "WhatsApp", href: process.env.NEXT_PUBLIC_WA_URL } : null,
  ].filter((l): l is { icon: string; label: string; href: string } => l !== null);
  if (!links.length) return null;
  return (
    <div className="mt-4 rounded-2xl bg-white p-4 text-center text-sm shadow">
      <div className="mb-2 font-bold text-[#0A2463]">While you wait…</div>
      <div className="flex justify-center gap-5 font-medium">
        {links.map((l) => (
          <a key={l.label} className="text-[#0A2463] underline" href={l.href} target="_blank" rel="noreferrer">{l.icon} {l.label}</a>
        ))}
      </div>
    </div>
  );
}
