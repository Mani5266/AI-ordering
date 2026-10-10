# TapOrder AI — PROGRESS.md (phase log: built / tests / decisions / gaps)

## P0 — repo + env (done)
- Built: Next.js 14.2.35 + TS + Tailwind scaffold in `taporder-ai/`; `.env` + `.env.example`;
  `.gitignore` covers `.env`, `*.db`. Prisma pinned 6.19.3 (v8 RC broke `db push` CLI — downgraded).
- Secrets generated locally into `.env` (STAFF_PIN=755330). No secrets in repo/client bundle.
- QR PNGs for tables 1–10 generated (`public/qr/` + SHEET.md) against `PUBLIC_BASE_URL`.
- Voice prompt generator built from `menu.json` — 3195 chars, under the ~13k cap.
- Decision: polling (3s) for realtime, per PRD cut-list order (SSE only if lag shows in rehearsal).
- GAP (needs user): OmniDim account + agent + webhook config — Phase 0 spike pending keys.

## P1 — menu, data, validation, orders API (done)
- Built: Prisma models (MenuItem/TableSession/Order/OrderEvent/WaiterRequest), 14-item seed,
  `data/menu.json` generated from seed, M4 validation engine, server-side pricing,
  session/token/ratelimit libs, 9 API routes, CSP/nosniff headers middleware.
- Tests (live, dev server): session table=7 ✓; menu=14 ✓; tap order total server-computed
  (2×M01 + kaapi-alias = Rs 280) ✓; off-menu rejected ✓; qty-21 rejected ✓;
  new→accepted ✓; new→served skip rejected ✓; mine scoped ✓. (One test POST with
  `total_inr:1` was correctly IGNORED by the server — unknown field stripped, real total stored.)
- Decisions: WaiterRequest table added (KDS alert cards need storage); drinks-only modifiers
  enforced by item ID (M06/M07); in-memory rate limits (single demo server).

## P2 — Screen 1 (done, unstyled-core)
- Built: `/t/[token]` → session → Screen 1: Table header, voice CTA (placeholder until
  provider keys land), tap menu grouped by category, cart + modifiers + confirm bar.
- Screen 2 (post-order status + bill/waiter + engagement) renders on same page after confirm.

## P3 — voice end-to-end (BLOCKED on user keys)
- Built: webhook receiver `/api/webhooks/omnidim/[secret]` (path+header secret, idempotency,
  defensive items_json parse, live-session bind). VoiceButton shows "connecting soon" + tap fallback.
- Needed: OmniDim credentials + agent (see questions to user).

## P4 — KDS + realtime (done, core)
- Built: `/kds` staff-PIN gate, queue (new→accepted→cooking→ready→served, no skip),
  voice/tap badges, allergen flags, partial-match flags, waiter/bill alert cards, owner strip
  (orders/revenue/voice-tap share/avg time/top dishes, real aggregates).

## P5 — QRs + session hardening (done except print)
- Signed QRs, 90-min sessions, constant-time verify, tampered→403 (verified live).
- TODO: print SHEET.md for demo; staff session-invalidate button on KDS (quick add).

## P6–P8 — pending: automated tests, SECURITY_REPORT, RESULTS, README, rehearsal.
