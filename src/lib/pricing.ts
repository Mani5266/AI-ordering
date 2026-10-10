// Server-side pricing — the ONLY place totals come from (PRD 3.2, M4 step 6).
import { prisma } from "./db";

export type MenuRow = {
  id: string; name: string; aliases: string[]; price_inr: number;
  veg: boolean; spice_level: string; allergens: string[]; available: boolean; category: string;
};

export async function loadMenu(): Promise<MenuRow[]> {
  // ponytail: no cache — availability flips must take effect on the very next
  // order (a 30s cache once let an unavailable item through; test caught it).
  // SQLite is local and orders are low-frequency; the query is sub-ms.
  const db = await prisma.menuItem.findMany();
  const rows = db.map((m) => ({
    id: m.id, name: m.name, aliases: JSON.parse(m.aliases) as string[],
    price_inr: m.priceInr, veg: m.veg, spice_level: m.spiceLevel,
    allergens: JSON.parse(m.allergens) as string[], available: m.available, category: m.category,
  }));
  return rows;
}

/** Match by ID, else by exact name/alias (case-insensitive); ambiguous or missing -> null. */
export function matchItem(rows: MenuRow[], ref: string): MenuRow | null {
  const direct = rows.find((r) => r.id === ref);
  if (direct) return direct;
  const q = ref.trim().toLowerCase();
  const hits = rows.filter((r) => r.name.toLowerCase() === q || r.aliases.some((a) => a.toLowerCase() === q));
  return hits.length === 1 ? hits[0] : null; // 0 or ambiguous -> reject (M4 step 3)
}
