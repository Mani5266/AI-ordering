// Shared API helpers: staff auth (T8), body-size cap (T8), session check.
import { NextResponse } from "next/server";
import { sessionFromRequest, type SessionClaims } from "./session";

export const BODY_LIMIT = 64 * 1024; // orders are small; bigger is abuse (T8)

export function staffAuthed(req: Request): boolean {
  const pin = req.headers.get("x-staff-pin") ?? "";
  const want = process.env.STAFF_PIN ?? "";
  return want.length > 0 && pin.length === want.length && pin === want;
}

export function needStaff(req: Request): NextResponse | null {
  return staffAuthed(req) ? null : NextResponse.json({ error: "staff login required" }, { status: 401 });
}

export function needSession(req: Request): SessionClaims | NextResponse {
  const s = sessionFromRequest(req);
  return s ?? NextResponse.json({ error: "invalid or expired session — please scan again" }, { status: 401 });
}

export function bodyTooBig(req: Request): boolean {
  const len = Number(req.headers.get("content-length") ?? 0);
  return len > BODY_LIMIT;
}

export const j = (data: unknown, status = 200) => NextResponse.json(data, { status });
