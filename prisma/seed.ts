// TapOrder AI — canonical seed menu (PRD 6.1/6.2). Single source of truth:
// this file -> data/menu.json -> voice prompt + validation. Never hand-edit downstream.
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export type SeedItem = {
  id: string; name: string; aliases: string[]; price_inr: number;
  veg: boolean; spice_level: "none" | "mild" | "medium" | "hot";
  allergens: ("nuts" | "dairy" | "gluten")[]; available: boolean;
  category: "south-indian" | "cafe" | "tandoor" | "mains" | "drinks";
};

export const MENU: SeedItem[] = [
  { id: "M01", name: "Masala Dosa", aliases: ["masala dosai", "masala dose", "dosa"], price_inr: 120, veg: true, spice_level: "medium", allergens: [], available: true, category: "south-indian" },
  { id: "M02", name: "Idli Sambar (4 pc)", aliases: ["idli", "idly", "idli sambar"], price_inr: 80, veg: true, spice_level: "mild", allergens: [], available: true, category: "south-indian" },
  { id: "M03", name: "Medu Vada (4 pc)", aliases: ["medu vada", "vada", "garelu"], price_inr: 70, veg: true, spice_level: "mild", allergens: [], available: true, category: "south-indian" },
  { id: "M04", name: "Pongal", aliases: ["pongal", "ven pongal", "katte pongal", "khara pongal"], price_inr: 90, veg: true, spice_level: "mild", allergens: ["dairy", "nuts"], available: true, category: "south-indian" },
  { id: "M05", name: "Onion Uttapam", aliases: ["onion uttapam", "uttapam", "uthappam"], price_inr: 110, veg: true, spice_level: "medium", allergens: [], available: true, category: "south-indian" },
  { id: "M06", name: "Filter Coffee", aliases: ["filter coffee", "filter kaapi", "kaapi", "coffee"], price_inr: 40, veg: true, spice_level: "none", allergens: ["dairy"], available: true, category: "drinks" },
  { id: "M07", name: "Masala Tea", aliases: ["masala tea", "masala chai", "chai", "tea"], price_inr: 30, veg: true, spice_level: "none", allergens: ["dairy"], available: true, category: "drinks" },
  { id: "M08", name: "Paneer Tikka", aliases: ["paneer tikka", "paneer", "tikka"], price_inr: 220, veg: true, spice_level: "hot", allergens: ["dairy"], available: true, category: "tandoor" },
  { id: "M09", name: "Butter Chicken", aliases: ["butter chicken", "murgh makhani", "chicken curry"], price_inr: 280, veg: false, spice_level: "medium", allergens: ["dairy"], available: true, category: "mains" },
  { id: "M10", name: "Chicken Biryani", aliases: ["chicken biryani", "biryani", "chicken dum biryani"], price_inr: 240, veg: false, spice_level: "hot", allergens: [], available: true, category: "mains" },
  { id: "M11", name: "Garlic Naan", aliases: ["garlic naan", "naan"], price_inr: 50, veg: true, spice_level: "none", allergens: ["gluten", "dairy"], available: true, category: "tandoor" },
  { id: "M12", name: "Plain Naan", aliases: ["plain naan", "naan"], price_inr: 40, veg: true, spice_level: "none", allergens: ["gluten"], available: true, category: "tandoor" },
  { id: "M13", name: "Veg Fried Rice", aliases: ["veg fried rice", "fried rice", "veg rice"], price_inr: 160, veg: true, spice_level: "medium", allergens: [], available: true, category: "mains" },
  { id: "M14", name: "Fresh Lime Soda", aliases: ["fresh lime soda", "lime soda", "nimbu soda", "soda"], price_inr: 60, veg: true, spice_level: "none", allergens: [], available: true, category: "drinks" },
];

// ponytail: tables 1-10 are valid by convention (checked in tokens.ts), no table rows seeded.
export const VALID_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

async function main() {
  const prisma = new PrismaClient();
  for (const m of MENU) {
    const row = {
      id: m.id, name: m.name, aliases: JSON.stringify(m.aliases),
      priceInr: m.price_inr, veg: m.veg, spiceLevel: m.spice_level,
      allergens: JSON.stringify(m.allergens), available: m.available, category: m.category,
    };
    await prisma.menuItem.upsert({ where: { id: m.id }, update: row, create: row });
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(here, "..", "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "menu.json"), JSON.stringify(MENU, null, 2) + "\n");
  console.log(`seeded ${MENU.length} items + wrote data/menu.json`);
  await prisma.$disconnect();
}

// ponytail: importable by prompt generator without running DB seed.
if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
