# TapOrder AI
**One QR. One kitchen. Speak or tap — same order. Everything else happens while you wait.**

Voice-first dine-in ordering for Indian cafes. A diner scans the per-table QR,
sees the menu, taps **Call to Order**, speaks ("two masala dosa, one less spicy,
three filter coffee"), says **YES** to the read-back — and a validated,
server-priced order lands on one kitchen display next to tap orders. The manager
Accepts, the kitchen cooks, the phone updates live. No app, no login, no waiter
needed for order-taking.

Live demo: scan Table 7's QR → order by voice → watch the KDS → phone goes
Accepted → Cooking → Ready. Engagement (review / Instagram / WhatsApp) appears
only after ordering, while the customer waits.

## The loop (every actor)

| Step | Who | What happens |
|---|---|---|
| 1. Scan | Customer | Table QR (`/t/:signedToken`) verifies signature → 307 to `/table/N` + scan-time session cookie |
| 2. See | Customer | Full menu (names, veg marks, Rs prices, allergens) + big **Call to Order** |
| 3. Speak | Customer + agent | In-browser OmniDim web call; agent clarifies once, reads back items + total, waits for explicit YES, hangs up itself |
| 4. Deliver | OmniDim → backend | Post-call webhook → backend re-validates every item/price against the menu DB → order created (`source: voice`) |
| 5. Accept | Manager (KDS) | NEW card with 🎙 badge; **Accept is compulsory** — nothing cooks before it |
| 6. Cook → Ready → Served | Manager | One tap per step; customer's page updates live (3s polling) |
| 7. Pay | Staff | Bill alert → collect at table → **Mark bill paid**; Day-book tracks billed vs collected |
| Fallback | Anyone | Noisy hall / no mic → tucked-away manual tap ordering, same pipeline, same KDS |

Tap orders enter the identical validation, schema, KDS queue and status flow.
One pipeline — never two systems.

## Stack

- **Next.js 14 (App Router) + TypeScript + Tailwind** — one repo, pages + API together
- **Prisma + PostgreSQL (Neon)** — MenuItem, TableSession, Order, OrderEvent, WaiterRequest
- **Voice:** OmniDim web call via `@omnidim-ai/client` (server-minted sessions; API key never reaches the browser)
- **Realtime:** 3s polling (SSE upgrade only if rehearsal lags)
- **Deploy:** Vercel (production) · `cloudflared` tunnel for local phone testing

## Run it locally

```bash
cd taporder-ai
npm install
cp .env.example .env        # fill in (see below) — never commit .env
npx prisma db push
npx prisma db seed          # 14 dishes -> data/menu.json
npm run dev                 # http://localhost:3000
```

Open `http://localhost:3000/table/7` (demo mode auto-mints a session).
KDS: `http://localhost:3000/kds` (staff PIN from `.env`).

## Environment variables

| Key | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Neon Postgres connection string |
| `HMAC_SECRET` | server | Signs per-table QR tokens (T3) |
| `SESSION_SECRET` | server | Signs short-lived table sessions (90 min) |
| `WEBHOOK_SECRET` | server | Path credential for the voice webhook (T4) |
| `STAFF_PIN` | server | KDS + owner + paid-marking auth |
| `OMNIDIM_API_KEY` | server | Mints web-call sessions; post-call reference |
| `OMNIDIM_AGENT_ID` | server | Voice agent (e.g. `265954`) |
| `RESTAURANT_ID` / `RESTAURANT_NAME` | both | QR payload + greetings |
| `PUBLIC_BASE_URL` | server | Canonical URL (QR + webhook redirects) |
| `DEMO_OPEN_TABLES` | server | `1` = `/table/N` self-serves (testing); `0` = QR-only (judging) |
| `SESSION_TTL_MINUTES` | server | Session life (default 90) |
| `NEXT_PUBLIC_REVIEW_URL` / `NEXT_PUBLIC_INSTA_URL` / `NEXT_PUBLIC_WA_URL` | browser | Post-order engagement links (hidden unless set) |

`NEXT_PUBLIC_*` bake in at build time → redeploy after changing.

## Voice agent setup (OmniDim dashboard)

1. Create assistant → paste the generated prompt as instructions:
   `npx tsx src/voice/agent-prompt.ts` (menu-derived, ~3.2k chars, under the 13k cap)
2. Welcome message: `Hello! Welcome to TapOrder. I see you're at table [table_number]. Ready to place your order?`
3. Languages: English (India) + Telugu. Extracted variables: `order_items` (JSON-array prompt), `total_price`, `confirmation` (Yes/No), `table`.
4. Post-Call → Webhook → `PUBLIC_BASE_URL/api/webhooks/omnidim/[WEBHOOK_SECRET]`, triggers on Completed, include summary + conversation + sentiment + extracted variables.
5. Speak → YES → hang up → order appears on KDS with 🎙 badge in seconds.

## Key routes

| Route | Auth | Purpose |
|---|---|---|
| `GET /` | — | Two doors: Customer / Staff |
| `GET /t/:signedToken` | signed QR | Verify → session cookie → redirect `/table/N` |
| `GET /table/N` | session | Customer: menu + Call to Order + live status |
| `GET /kds` | staff PIN | Kitchen: queue, alerts, stats, day-book, analytics |
| `POST /api/orders` | session | Tap order (M4-validated) |
| `GET /api/orders/mine` | session | This table's orders only |
| `POST /api/orders/:id/action` | staff | Accept → Cooking → Ready → Served (no skip) |
| `POST /api/orders/:id/paid` | staff | Mark bill paid |
| `POST /api/voice/session` | session | Mint OmniDim `ws_url` (key stays server-side) |
| `POST /api/webhooks/omnidim/:secret` | path secret | Voice order receiver (idempotent on call ID) |
| `GET /api/kds/queue` | staff | NEW-first FCFS queue + waiter/bill alerts |
| `GET /api/owner/summary?range=day\|week\|month` | staff | Orders, customers, revenue, voice share, avg time, top dishes, collected |
| `GET /api/owner/orders` | staff | Day-book: every order + bill + paid/unpaid |
| `POST /api/waiter` | session | Bill / waiter request → KDS alert |
| `POST /api/session/demo` | demo flag | Self-serve session (testing only) |
| `POST /api/session/invalidate` | staff | Reset a table's sessions (new seating) |

## QR generation

```bash
npx tsx scripts/generate-qrs.ts   # public/qr/table-1..10.png + SHEET.md (print this)
```

QRs encode only the stable signed table URL — never a session. Regenerate after
changing `PUBLIC_BASE_URL` or `HMAC_SECRET`.

## Tests

```bash
npx vitest run        # 15 lib tests: tokens, sessions, M4 validation, pricing, state machine
npx tsc --noEmit      # type check
```

Voice protocol (manual, real calls — log via `npx tsx scripts/voice-test-log.ts …`
into `data/voice-log.jsonl`): 3 EN + 2 Hinglish + 1 Telugu + noisy + correction
+ troll-qty + allergen question.

## Docs

- `PROGRESS.md` — phase log (built / tests / decisions / gaps)
- `RESULTS.md` — real outcomes only, failures included
- `SECURITY_REPORT.md` — T1–T10 with evidence
- `prisma/seed.ts` — the 14-dish single source of truth (`→ data/menu.json →` prompt + validation)

## Security model (summary)

Signed QRs, scan-time expiring sessions, server-side price recompute,
closed-menu validation, quantity caps, explicit voice confirmation, compulsory
KDS Accept gate, webhook path-secret + call-ID idempotency, staff PIN on every
staff route, CSP/nosniff/referrer/frame headers, 64 KB body caps, per-session
rate limits. Full matrix in `SECURITY_REPORT.md`.
