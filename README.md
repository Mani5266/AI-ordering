# TapOrder AI
**One QR. One kitchen. Speak or tap — same order. Everything else happens while you wait.**

Hackathon build per `taporder-ai-prd.md` (repo root's parent dir). Next.js 14 + TS + SQLite/Prisma.
Node v24.15.0, npm 11.12.1, Prisma 6.19.3, Next 14.2.35.

## Run
```bash
cd taporder-ai
npm install
cp .env.example .env   # fill secrets (never commit .env)
.\node_modules\.bin\prisma db push
.\node_modules\.bin\prisma db seed   # 14 items -> data/menu.json
npm run dev                        # http://localhost:3000
```
Public demo URL (webhooks + phone testing): expose local 3000 via
`.\node_modules\cloudflared\bin\cloudflared.exe tunnel --url http://localhost:3000`,
set `PUBLIC_BASE_URL` in `.env` to the https URL, regenerate QRs:
`.\node_modules\.bin\tsx scripts/generate-qrs.ts`.

## Key routes
- `GET /t/:signedToken` — QR landing, Screen 1 (customer)
- `GET /kds` — staff KDS + owner strip (staff PIN from `.env`)
- `POST /api/webhooks/omnidim/[WEBHOOK_SECRET]` (+ `x-webhook-secret` header) — voice orders
- `GET /api/owner/summary` — real aggregates (staff)

## Voice (OmniDim)
1. Create agent, paste prompt: `.\node_modules\.bin\tsx src/voice/agent-prompt.ts`
2. Define extracted vars: `items_json, notes, confirmed, table, session_id, call_id`
3. Post-Call → Webhook → `PUBLIC_BASE_URL/api/webhooks/omnidim/[WEBHOOK_SECRET]` (+ header)
4. Paste widget snippet values into `.env` as `NEXT_PUBLIC_OMNIDIM_*`, restart dev.

## Demo (3 min)
Scan printed Table-7 QR → ask "does the pongal have nuts?" → speak messy order →
read-back "yes" → KDS shows voice badge next to Table-3 tap order → Accept→Cooking→Ready
live on phone → engagement appears → owner strip + safety one-liner.

## Docs
`PROGRESS.md` phase log · `RESULTS.md` real test outcomes · `SECURITY_REPORT.md` T1–T10.
