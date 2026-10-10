// M1 — HMAC-signed table tokens (PRD 9/T3). QR encodes ONLY restaurant+table+signature.
import { createHmac, timingSafeEqual } from "crypto";

const b64 = (s: string) =>
  Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) =>
  Buffer.from(s, "base64url").toString("utf8");

export function signTable(restaurantId: string, table: number): string {
  const payload = b64(JSON.stringify({ r: restaurantId, t: table }));
  const sig = createHmac("sha256", process.env.HMAC_SECRET!).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

// ponytail: tables 1-10 valid by convention (PRD M1); change VALID_TABLES to grow.
export function verifyTable(token: string, restaurantId: string): number | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expect = createHmac("sha256", process.env.HMAC_SECRET!).update(payload).digest("base64url");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expect, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null; // constant-time (T3)
    const { r, t } = JSON.parse(unb64(payload));
    if (r !== restaurantId || !Number.isInteger(t) || t < 1 || t > 10) return null;
    return t;
  } catch {
    return null;
  }
}
