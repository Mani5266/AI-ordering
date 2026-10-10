# RESULTS.md — real outcomes only. Nothing here is estimated.

## Automated (tests/order.test.ts) — run pending (`npx vitest run`)
Covers: token tamper, session expiry, price recompute vs client total, qty caps
(0/21/6±confirm), off-menu + ambiguous-alias rejection, unavailable item,
unconfirmed voice, table mismatch, modifier-as-note, XSS-note inertness, state machine.

## Live API smoke (dev server, real DB) — PASS (2026-10-10)
- session for Table 7 issued; menu 14 items
- tap order 2×M01 + kaapi-alias → stored total Rs 280 (server-computed)
- off-menu item rejected; qty-21 rejected; client `total_inr:1` ignored
- new→accepted ok; new→served skip rejected; `/mine` scoped to session
- QR scan `/t/:token` → 307 to `/table/7` with session cookie; tampered token → 403 page
- `/table/7` renders menu + Call to Order; typed URL without scan cookie → 401 rescan wall
- CSP/nosniff/referrer/frame headers present (moved from middleware to next.config — middleware never loaded in dev)

## Voice protocol (PRD 12.2) — pending OmniDim wiring
Log rows go to `data/voice-log.jsonl` via `tsx scripts/voice-test-log.ts …`.
Planned: 3 EN + 2 Hinglish + 1 Telugu + noisy + correction + troll-qty + allergen Q.

## Demo rehearsals — pending (2× clean <4 min required)
