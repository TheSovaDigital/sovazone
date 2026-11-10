# Valuation AI / @ValuationAiBot

A standalone Telegram Mini App dedicated exclusively to username valuation (Instagram, TikTok and Telegram). **No catalog, advertising dashboard, or username sales. Bot updates/offers require explicit opt-in.**

## Architecture
- Static, responsive UI and Russian/English localization; local-only valuation history.
- `/api/estimate` and `/api/estimate-telegram` proxy existing SovaZone valuation engines through Vercel rewrites. The engines retain their own rate limits and valuations. The Mini App never pretends to check availability, ownership, or sale prices.
- Optional `/api/webhook` supports `/start`, `/help`, `/estimate`, `/value` and returns a Web App button. It requires two Vercel environment variables and a Telegram webhook to be registered. No private data is stored.
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