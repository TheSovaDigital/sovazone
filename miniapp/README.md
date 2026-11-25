# SOVA USERNAMES — Telegram Mini App

Premium Telegram Mini App with a curated Instagram handle catalog, client-side favorites, integrated links to **separate** SovaZone Valuation AI, authenticated usage analytics, marketing opt-ins, and a drafts-only advertising/broadcast workspace.

## What is built

- Beautiful responsive RU/EN UI with Telegram theme integration and a web preview mode.
- Curated catalog snapshot from `https://sovazone.com/usernames` (32 items, one marked sold) with search, filter, sort, favorites, details and inquiry to `@SovaDS`.
- Separate link to the existing valuation tool (not merging its model or records).
- Server-side Telegram `initData` signature verification and 24h freshness checks; never trust `initDataUnsafe` for server auth.
- Authenticated, append-only event analytics (no search text), source attribution from `startapp`/`ref`, verified MAU/WAU, interest and lead funnel.
- Explicit opt-in for promotional messages and a bot `/stop` command; users can revoke consent.
- Admin-only metrics and saved campaign **drafts**; there is deliberately no bulk send endpoint.
- Private per-project Blob store, not a public analytics bucket.

## Vercel

This lives in `TheSovaDigital/sovazone/miniapp/` but is deployed as a **separate Vercel project** with `rootDirectory = miniapp`. It must not change SovaZone's production HTML, its SEO, services or current valuation APIs.

Required environment variables (set only in Vercel Settings, never commit secrets):

| variable | purpose |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | HMAC verification and Bot API |
| `TELEGRAM_WEBHOOK_SECRET` | `X-Telegram-Bot-Api-Secret-Token` verification |
| `TG_ADMIN_IDS` | Comma-separated numeric Telegram user IDs permitted to view analytics and create drafts |
| `PUBLIC_APP_URL` | Canonical HTTPS Mini App URL for bot's Open App button |
| `BLOB_READ_WRITE_TOKEN` | Auto-generated private Vercel Blob store token (or Vercel OIDC; never expose to browser) |

**Before BotFather connection**, the public URL shows a fully navigable demo. It **does not collect user data** and keeps notifications/admin gated.

Telegram: create a bot in @BotFather, set the Main Mini App URL to the Vercel HTTPS project, configure the bot menu button. Then set the environment variables through Vercel. Only after that, register the webhook with Telegram using `setWebhook` to `${PUBLIC_APP_URL}/api/webhook` and `secret_token` matching `TELEGRAM_WEBHOOK_SECRET`; avoid putting credentials in URLs/logs.

## Privacy and campaign constraints

- User-ID, language, referral source, and a small set of button/catalog event names are recorded **only after** verified Telegram authorization. No phone, geolocation, private messages, full user search queries or browser fingerprints.
- These actions are data about visitors, **not proof of transactions**. "Inquiry clicks" do not equal sales.
- Do not send marketing messages without verified, explicit opt-in and Telegram permission. Campaigns are **draft only** until separately reviewed/implemented with opt-out, throttling, retry/429 handling and audit log.
- Analytics are aggregated from private Blob events for 30 UTC days, with a cap of 1,800 events per day and a `truncated` flag. This is an MVP, not a substitute for a transactional database at scale. For scale >10k active users, migrate to Postgres/ClickHouse.
- Handle availability and prices are a snapshot. Confirm in Telegram before any deal. The bot does not sell Telegram usernames or promise transfer of occupied names.
- Provide a privacy policy and data-deletion workflow prior to broad launch. Users can contact `@SovaDS` for deletion requests.

## Local preview

```sh
cd miniapp
npm install
npx vercel dev
```

The project currently does not have external credentials; preview mode works without them.

## Tests

```sh
npm test
```

**No existing SovaZone file needs editing.**