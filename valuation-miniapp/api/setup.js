// One-time operator-only configuration for @ValuationAiBot.
// Registering the webhook requires the bot token to be stored in Vercel,
// never in a URL, source code, GitHub Actions or the Mini App.
import crypto from 'node:crypto';

const APP_URL = 'https://sova-valuation-ai.vercel.app';
const COMMANDS = {
  ru: [
    { command: 'start', description: 'Открыть Valuation AI' },
    { command: 'estimate', description: 'Оценить никнейм' },
    { command: 'help', description: 'Как работает оценка' },
    { command: 'privacy', description: 'Конфиденциальность' }
  ],
  en: [
    { command: 'start', description: 'Open Valuation AI' },
    { command: 'estimate', description: 'Evaluate a username' },
    { command: 'help', description: 'How valuation works' },
    { command: 'privacy', description: 'Privacy information' }
  ]
};

function validKey(candidate, expected) {
  if (!candidate || !expected) return false;
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const key = String(req.query?.key || '');
  if (!validKey(key, process.env.VALUATION_SETUP_KEY)) return res.status(403).json({ ok: false });
  const token = process.env.VALUATION_BOT_TOKEN;
  const secret = process.env.VALUATION_WEBHOOK_SECRET;
  if (!token || !secret) return res.status(503).json({ ok: false, missing: ['VALUATION_BOT_TOKEN','VALUATION_WEBHOOK_SECRET'].filter(k => !process.env[k]) });
  const api = async (method, params = {}) => {
    const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(method + ': Telegram API status ' + response.status);
    return data.result;
  };
  try {
    const identity = await api('getMe');
    if (String(identity.username || '').toLowerCase() !== 'valuationaibot')
      return res.status(409).json({ ok: false, error: 'This token belongs to another bot' });

    await api('setMyName', { name: 'Valuation AI' });
    await api('setMyName', { name: 'Valuation AI — Оценка никнеймов', language_code: 'ru' });
    await api('setMyName', { name: 'Valuation AI — Username Valuation', language_code: 'en' });

    await api('setMyDescription', {
      description: 'Оценка никнеймов Instagram, TikTok и Telegram. Выберите платформу и получите ориентировочную стоимость, качество, ликвидность и ключевые факторы оценки. Результат не подтверждает доступность или право владения никнеймом.',
      language_code: 'ru'
    });
    await api('setMyDescription', {
      description: 'Evaluate Instagram, TikTok and Telegram usernames. Choose a platform and get an indicative value range, quality and liquidity indicators, and the key valuation factors. Results do not verify ownership or availability.',
      language_code: 'en'
    });
    await api('setMyDescription', {
      description: 'Оценка никнеймов Instagram, TikTok и Telegram: стоимость, качество, ликвидность и основные факторы. Оценки ориентировочные.'
    });

    await api('setMyShortDescription', {
      short_description: 'Оценка никнеймов Instagram, TikTok и Telegram с помощью Valuation AI.',
      language_code: 'ru'
    });
    await api('setMyShortDescription', {
      short_description: 'Instagram, TikTok and Telegram username valuation by Valuation AI.',
      language_code: 'en'
    });
    await api('setMyShortDescription', {
      short_description: 'Оценка никнеймов Instagram, TikTok и Telegram.'
    });

    await api('setMyCommands', { commands: COMMANDS.ru });
    await api('setMyCommands', { commands: COMMANDS.ru, language_code: 'ru' });
    await api('setMyCommands', { commands: COMMANDS.en, language_code: 'en' });
    await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Оценить никнейм', web_app: { url: APP_URL } } });

    await api('setWebhook', {
      url: APP_URL + '/api/webhook',
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: false
    });
    const status = await api('getWebhookInfo');
    if (status.url !== APP_URL + '/api/webhook') throw new Error('Webhook address mismatch');
    return res.status(200).json({ ok: true, bot: '@' + identity.username, webhook: true, commands: 4, app: APP_URL });
  } catch (err) {
    console.error('Valuation AI bot activation:', err?.message || 'unknown error');
    return res.status(502).json({ ok: false, error: 'Bot setup failed; check server logs' });
  }
}
