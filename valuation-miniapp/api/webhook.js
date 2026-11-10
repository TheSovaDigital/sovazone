// Telegram webhook for @ValuationAiBot. Does not log or store Telegram user identities.
import crypto from 'node:crypto';

const APP_URL = process.env.PUBLIC_APP_URL || 'https://valuation.sovazone.com';

function equalsSecret(value, secret) {
  if (!value || !secret) return false;
  const a = Buffer.from(String(value));
  const b = Buffer.from(String(secret));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const RU = {
  open: 'Оценить никнейм',
  start: '<b>Valuation AI</b>\n\nОценка никнеймов Instagram, TikTok и Telegram. Получите ориентировочный диапазон стоимости, показатели качества и ликвидности, а также факторы оценки.\n\nНажмите кнопку, чтобы открыть приложение.',
  help: '<b>Как пользоваться Valuation AI</b>\n\n1. Откройте приложение.\n2. Выберите Instagram, TikTok или Telegram.\n3. Введите никнейм и запустите оценку.\n\nРезультат носит ориентировочный характер и не подтверждает доступность или право владения никнеймом.',
  estimate: 'Выберите платформу и введите никнейм в приложении Valuation AI.',
  privacy: '<b>Конфиденциальность</b>\n\nБот не ведёт рекламных рассылок и не хранит вашу личность. Никнейм передаётся в Valuation AI для расчёта; история результатов сохраняется только на вашем устройстве. Оценка не проверяет владение аккаунтом.'
};
const EN = {
  open: 'Evaluate username',
  start: '<b>Valuation AI</b>\n\nEvaluate Instagram, TikTok and Telegram usernames. Get an indicative value range, quality and liquidity indicators, and the key valuation factors.\n\nUse the button below to open the app.',
  help: '<b>How Valuation AI works</b>\n\n1. Open the app.\n2. Choose Instagram, TikTok or Telegram.\n3. Enter a username and run the valuation.\n\nResults are indicative estimates, not proof of availability or ownership.',
  estimate: 'Select a platform and enter the username in the Valuation AI app.',
  privacy: '<b>Privacy</b>\n\nThis bot sends no marketing messages and does not store your Telegram identity. A username is sent to the valuation engine for estimation; your valuation history is stored only on your device. Ownership and availability are not checked.'
};

async function reply(chatId, languageCode, command) {
  const t = String(languageCode || '').toLowerCase().startsWith('en') ? EN : RU;
  const key = command === 'help' ? 'help' : command === 'privacy' ? 'privacy' : (command === 'estimate' || command === 'value') ? 'estimate' : 'start';
  const response = await fetch('https://api.telegram.org/bot' + process.env.VALUATION_BOT_TOKEN + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: t[key],
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [[{ text: t.open, web_app: { url: APP_URL } }]] }
    })
  });
  if (!response.ok) throw new Error('Telegram API responded with ' + response.status);
  const result = await response.json();
  if (!result.ok) throw new Error('Telegram rejected message');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.VALUATION_WEBHOOK_SECRET;
  if (!process.env.VALUATION_BOT_TOKEN || !secret) return res.status(503).json({ error: 'Not configured' });
  if (!equalsSecret(req.headers['x-telegram-bot-api-secret-token'], secret)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const msg = req.body?.message;
    if (msg?.chat?.type === 'private' && Number.isSafeInteger(msg.chat.id) && typeof msg.text === 'string') {
      const command = (msg.text.trim().match(/^\/([a-z]+)(?:@ValuationAiBot)?(?:\s|$)/i)?.[1] || '').toLowerCase();
      await reply(msg.chat.id, msg.from?.language_code, ['start','help','estimate','value','privacy'].includes(command) ? command : 'start');
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Valuation AI Telegram webhook failed:', err?.message || 'unknown error');
    return res.status(500).json({ ok: false });
  }
}
