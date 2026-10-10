// M1 — short-lived table-bound sessions (PRD 9/T2). JWT, 90-min default expiry.
import jwt from "jsonwebtoken";

export type SessionClaims = { sid: string; table: number };

export function issueSession(sid: string, table: number): string {
  const ttl = Number(process.env.SESSION_TTL_MINUTES ?? 90);
  return jwt.sign({ sid, table }, process.env.SESSION_SECRET!, { expiresIn: `${ttl}m` });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    const p = jwt.verify(token, process.env.SESSION_SECRET!) as SessionClaims;
    return typeof p.sid === "string" && Number.isInteger(p.table) ? p : null;
  } catch {
    return null;
  }
}

export function sessionFromRequest(req: Request): SessionClaims | null {
  const h = req.headers.get("authorization");
  if (h?.startsWith("Bearer ")) return verifySession(h.slice(7));
  const cookie = req.headers.get("cookie")?.match(/(?:^|;\s*)tap_session=([^;]+)/)?.[1];
  return cookie ? verifySession(decodeURIComponent(cookie)) : null;
}
