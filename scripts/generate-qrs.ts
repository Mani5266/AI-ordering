// M1 — signed per-table QR PNGs (tables 1-10). QR holds ONLY the stable signed URL.
import QRCode from "qrcode";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { signTable } from "../src/lib/tokens";

config();
const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const base = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const rid = process.env.RESTAURANT_ID ?? "cafe-demo";
  const out = join(here, "..", "public", "qr");
  mkdirSync(out, { recursive: true });
  const rows: string[] = ["# TapOrder AI — Table QR sheet", ""];
  for (let t = 1; t <= 10; t++) {
    const url = `${base}/t/${signTable(rid, t)}`;
    await QRCode.toFile(join(out, `table-${t}.png`), url, { width: 512, margin: 2 });
    rows.push(`## Table ${t}`, `![Table ${t}](./table-${t}.png)`, url, "");
    console.log(`table-${t}.png -> ${url.slice(0, 60)}...`);
  }
  writeFileSync(join(out, "SHEET.md"), rows.join("\n"));
  console.log("wrote public/qr/table-1..10.png + SHEET.md");
}
main().catch((e) => { console.error(e); process.exit(1); });
