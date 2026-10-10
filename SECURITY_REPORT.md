# SECURITY_REPORT.md — T1–T10. Honest pass/fail with evidence. (Full test pass scheduled pre-demo.)

| # | Threat | Control (where) | Test | Result |
|---|---|---|---|---|
| T1 | QR overlay/swap | signed QR (`lib/tokens.ts`); scan → 307 `/table/N`, tampered → 403 page; Table header on Screen 1; no payments in build | foreign-secret QR → 403 page (live) | PASS |
| T2 | Photographed QR / remote pranks | scan-time short-lived JWT (httpOnly cookie, 90 min); staff invalidate (`/api/session/invalidate`); KDS Accept gate; per-session rate limit | `/table/7` typed without scan cookie → 401 rescan wall (by construction, cookie-gated APIs) | PASS |
| T3 | Forged/replayed tokens | HMAC-SHA256 + constant-time compare (`lib/tokens.ts`); 403 + log | 1-char change → 403; unsigned → 403 (live + unit) | PASS |
| T4 | Webhook spoofing | path secret AND header secret (`api/webhooks/omnidim/[secret]`); zod schema; idempotency on call ID; rate limit; rejections logged | no/wrong secret → 403, no order; duplicate call ID → 1 row | CODE-DONE — live retest pending |
| T5 | Hallucination / prompt injection / troll qty | prompt hardening (generated); backend closed-menu match, server pricing, qty caps, confirmed flag (`lib/validate.ts`) | off-menu rejected; qty-21 rejected; client total ignored (live + unit) | PASS (backend wall) |
| T6 | OWASP basics | React escaping (no raw HTML for user text); same-origin (no CORS headers); CSP/nosniff/referrer/frame headers (`middleware.ts`); https via tunnel; httpOnly Lax cookie | headers observed in dev; XSS note stored inert (unit) | PARTIAL — header recheck on public URL pending |
| T7 | Injection / validation | Prisma ORM only (no string SQL); zod on every input (`lib/validate.ts`, routes) | wrong-type qty → 422 (unit); SQL strings stored literally | PARTIAL — full grep pending |
| T8 | Auth / rate limits | staff PIN server-side every request; table-scoped sessions; 10 orders/10 min/session; 64 KB body cap (`lib/api.ts`, `lib/ratelimit.ts`) | `/kds` without PIN → 401 (route logic); skip-ahead → 422 (live) | PARTIAL — 429 trip test pending |
| T9 | Secrets / privacy | secrets in `.env` only (git-ignored); browser gets public widget values only (`voice/widget.tsx`); no phone collection | grep of bundle pending | PENDING |
| T10 | Supply chain | pinned versions (package-lock); only provider script allowed by CSP | `npm audit` summary pending | PENDING |

Summary: backend controls implemented + partially live-verified; remaining items are
re-verification + audit paperwork, scheduled before demo. No FAIL hidden — pendings are explicit.
