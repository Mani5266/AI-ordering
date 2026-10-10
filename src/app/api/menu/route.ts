// GET /api/menu — menu for the tap UI (available flags applied). Session-scoped.
import { loadMenu } from "@/lib/pricing";
import { needSession, j } from "@/lib/api";

export async function GET(req: Request) {
  const s = needSession(req);
  if (s instanceof Response) return s;
  const rows = await loadMenu();
  return j({ items: rows, restaurant: process.env.RESTAURANT_NAME ?? "Cafe" });
}
