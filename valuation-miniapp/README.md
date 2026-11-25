# Valuation AI / @ValuationAiBot

A standalone Telegram Mini App dedicated exclusively to username valuation (Instagram, TikTok and Telegram). **No catalog, advertising dashboard, or username sales. Bot updates/offers require explicit opt-in.**

## Architecture
- Static, responsive RU/EN UI and local-only valuation history.\n- Server-side analytics of verified /start, Mini App opens and successful estimates by platform. All aggregate analytics live in private Vercel Blob; neither searched handles nor estimated prices are stored.\n- Private /admin.html dashboard protected by signed Telegram initData and an exact VALUATION_ADMIN_IDS allowlist.
- `/api/estimate` and `/api/estimate-telegram` are authenticated server-side proxies of the SovaZone valuation engines. The bot checks Telegram initData and the user's /start subscriber record before forwarding. Successful evaluations emit event records with only platform and keyed pseudonymous ID; they do not store looked-up names or monetary values.
- Optional `/api/webhook` supports `/start`, `/help`, `/estimate`, `/value`, `/myid` and `/stats` and returns a Web App button. It requires two Vercel environment variables and a Telegram webhook to be registered. No private data is stored.
- Does not depend on the unrelated SovaUsername catalog Mini App.

## BotFather activation (no token in chat)
1. Go to @BotFather → `/setmenubutton` → select `@ValuationAiBot` → set button text `Оценить никнейм` → enter the exact production Mini App URL.
2. Optional: configure Main Mini App in BotFather for a large Launch button; enter the same HTTPS URL.
3. To activate `/start` with an actual Web App button, set `VALUATION_BOT_TOKEN` (sensitive), `VALUATION_WEBHOOK_SECRET` (random 32-64 char string) and `PUBLIC_APP_URL` (public HTTPS site URL) in the **separate Valuation AI Vercel project**, then register the Telegram webhook using the Bot API `setWebhook` method with `secret_token` equal to the configured secret. Never paste the bot token in ChatGPT or commit it to git.

## Privacy
- After /start the bot stores only Telegram chat ID, language, first/last start date and referral source in a private Vercel Blob store, solely to provide bot messages. Marketing opt-in is off by default.
- A username entered for valuation is sent to the pre-existing SovaZone valuation engine; local history is stored in the user's browser only and can be cleared.
- /subscribe explicitly opts into bot updates and offers; /unsubscribe opts out; /delete erases the contact record. No broadcasts are implemented or sent automatically.
- Sharing an estimate links to t.me/ValuationAiBot?start=share, so first-time users enter via /start rather than immediately launching the Mini App.
- External data from the valuation engine is rendered as escaped text.
## Subscriber-only Mini App onboarding
- Telegram initData is HMAC-verified server-side at `/api/access` against the bot token; only users whose private record exists after `/start` may interact with the Mini App UI.
- Direct Main Mini App launches, and the website opened outside Telegram, show a bot-onboarding screen. The public valuation APIs on SovaZone remain independently accessible; this gate protects the Mini App user experience, not those unrelated public APIs.

## Admin statistics (enabled after ID allowlisting)
- Send `/myid` to @ValuationAiBot from your own account. It returns only your numerical Telegram user ID.
- Add the number to `VALUATION_ADMIN_IDS` in the **sova-valuation-ai Vercel project**, target Production (comma-separated IDs are allowed). Never use a Bot API token or an arbitrary visitor username as an administrator credential.
- Redeploy the production project with its root directory `valuation-miniapp` on the main branch.
- Open `/stats` in the bot, then tap `Open statistics`. The dashboard calls `POST /api/admin-stats` with Telegram-signed initData; non-admins and ordinary browser sessions receive no statistics.
- Metrics: total subscriber records, 7/30-day unique active visitors, 30-day valuations by platform, successful evaluations, /start sources, registration events and opt-in users.
- Historical subscriber records are counted if available in private Blob. **Earlier valuation searches cannot be reconstructed**. Analytics records begin at deployment.
- Raw analytics contain a keyed pseudonymous identifier and categorical event only; no raw Telegram ID, searched handles, result prices, private messages or IP data.
- Analytics shown over the last 30 days; older event blobs should be periodically deleted according to the privacy retention policy. The dashboard reads a maximum of 3,000 subscriber records and 10,000 event paths, and reports a truncation warning if limits are reached.
- Marketing consent remains opt-in, separate from necessary usage metrics. No broadcast sending was added.
