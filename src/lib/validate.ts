// M4 — the brain. EVERY order (tap AND voice) passes through here (PRD 8/M4, 10.1).
import { z } from "zod";
import { loadMenu, matchItem, type MenuRow } from "./pricing";

// Closed modifier list (PRD 6.3). Anything else -> note, never a price change.
export const MODIFIERS = [
  "less spicy", "extra spicy", "no spice",
  "no onion", "no garlic", "no coriander", "extra chutney", "extra sambar",
  "less sugar", "no sugar", "strong",
] as const;
const DRINK_MODIFIERS = new Set(["less sugar", "no sugar", "strong"]);

const lineIn = z.object({
  menu_item_id: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(80).optional(),
  qty: z.number().int(),
  modifiers: z.array(z.string().max(40)).max(10).default([]),
  note: z.string().max(280).nullable().optional(),
}).refine((l) => l.menu_item_id || l.name, { message: "item needs id or name" });

export const orderIn = z.object({
  table: z.number().int().min(1).max(10),
  items: z.array(lineIn).min(1).max(40),
  confirmed: z.boolean(),
});

export type ValidLine = {
  menu_item_id: string; name: string; qty: number;
  modifiers: string[]; note: string | null;
  unit_price_inr: number; line_total_inr: number;
  veg: boolean; allergens: string[];
};

export type Validated = {
  ok: boolean; error?: string;
  lines?: ValidLine[]; total?: number; partialMatch?: boolean; rejected?: string[];
};

export async function validateOrder(
  raw: unknown,
  opts: { sessionTable: number; source: "voice" | "tap" },
): Promise<Validated> {
  const parsed = orderIn.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "malformed order: " + parsed.error.issues[0]?.message };
  const { table, items, confirmed } = parsed.data;
  if (table !== opts.sessionTable) return { ok: false, error: "table mismatch" }; // M4 step 2
  if (opts.source === "voice" && !confirmed) return { ok: false, error: "voice order needs explicit confirmation" }; // M4 step 7

  const rows = await loadMenu();
  const lines: ValidLine[] = [];
  const rejected: string[] = [];
  let count = 0;

  for (const it of items) {
    // qty caps: 1-20, >5 needs confirmation (M4 step 5)
    if (it.qty < 1 || it.qty > 20) return { ok: false, error: `qty ${it.qty} out of range 1-20` };
    if (it.qty > 5 && !confirmed) return { ok: false, error: "qty above 5 needs confirmation" };
    count += it.qty;
    if (count > 40) return { ok: false, error: "order exceeds 40 items" };

    const row: MenuRow | null = matchItem(rows, it.menu_item_id ?? it.name!);
    if (!row) { rejected.push(it.menu_item_id ?? it.name!); continue; } // M4 step 3: reject item, keep rest
    if (!row.available) { rejected.push(row.name); continue; } // M4 step 4

    // modifiers: closed list only; drinks-only modifiers enforced; rest -> note
    const mods: string[] = [];
    const stray: string[] = [];
    for (const m of it.modifiers) {
      const mm = m.trim().toLowerCase();
      if (!(MODIFIERS as readonly string[]).includes(mm)) { stray.push(m); continue; }
      if (DRINK_MODIFIERS.has(mm) && !["M06", "M07"].includes(row.id)) { stray.push(m); continue; }
      mods.push(mm);
    }
    const noteBits = [it.note?.trim(), ...stray.map((s) => `[modifier-as-note: ${s}]`)].filter(Boolean);
    lines.push({
      menu_item_id: row.id, name: row.name, qty: it.qty, modifiers: mods,
      note: noteBits.length ? noteBits.join(" | ") : null,
      unit_price_inr: row.price_inr, line_total_inr: row.price_inr * it.qty, // M4 step 6: server prices only
      veg: row.veg, allergens: row.allergens,
    });
  }

  if (!lines.length) return { ok: false, error: "no known menu items in order" };
  return {
    ok: true, lines,
    total: lines.reduce((s, l) => s + l.line_total_inr, 0),
    partialMatch: rejected.length > 0, rejected,
  };
}

// Order state machine (PRD M5). Only forward, one step at a time.
const NEXT: Record<string, string> = { new: "accepted", accepted: "cooking", cooking: "ready", ready: "served" };
export function canTransition(from: string, to: string): boolean {
  if (from === to) return false;
  if ((to === "rejected" || to === "cancelled") && ["new", "accepted"].includes(from)) return true;
  return NEXT[from] === to;
}
