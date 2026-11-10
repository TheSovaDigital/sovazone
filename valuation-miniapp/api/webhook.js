// Privacy-aware Telegram webhook for @ValuationAiBot. No username valuations are stored here.
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
  optin: 'Получать новости и рекламу',
  start: '<b>SovaZone Valuation AI</b>\n\nОцените никнейм Instagram, TikTok или Telegram — бесплатно и за пару нажатий.\n\nНажмите «Оценить никнейм», чтобы открыть приложение.\n\nПродолжая пользоваться ботом, вы соглашаетесь с обработкой Telegram ID для работы сервиса. Новости и рекламные предложения — только по желанию: нажмите «Получать новости и рекламу». Отписаться можно в любой момент через /unsubscribe.',
  help: '<b>Как пользоваться</b>\n\n1. Откройте приложение.\n2. Выберите платформу.\n3. Введите никнейм и запустите оценку.\n\nКоманды: /subscribe — подписка на новости, /unsubscribe — отказ, /delete — удалить запись, /privacy — конфиденциальность.',
  estimate: 'Выберите платформу и введите никнейм в приложении.',
  privacy: '<b>Конфиденциальность</b>\n\nПосле /start мы сохраняем Telegram ID чата, язык, дату входа и источник перехода, чтобы бот работал. Рекламные и информационные рассылки включаются отдельно кнопкой «Получать новости и рекламу» или командой /subscribe. Согласие можно отозвать через /unsubscribe, а запись удалить через /delete. Оцениваемые никнеймы и результаты в базе подписчиков не хранятся.',
  subscribed: 'Вы дали согласие получать новости и рекламные предложения Valuation AI. Отписаться: /unsubscribe.',
  unsubscribed: 'Подписка на новости и предложения отключена. Оценка никнеймов по-прежнему доступна.',
  deleted: 'Ваша запись удалена. При повторном /start она будет создана заново.'
};
const EN = {
  open: 'Evaluate username',
  optin: 'Receive updates & offers',
  start: '<b>SovaZone Valuation AI</b>\n\nEstimate an Instagram, TikTok or Telegram username in just a few taps.\n\nTap “Evaluate username” to open the app.\n\nBy using the bot, you acknowledge processing of your Telegram ID to provide the service. News and promotional messages are optional: tap “Receive updates & offers” to opt in. Unsubscribe any time with /unsubscribe.',
  help: '<b>How to use Valuation AI</b>\n\n1. Open the app.\n2. Choose a platform.\n3. Enter a username and run valuation.\n\nCommands: /subscribe — opt in, /unsubscribe — opt out, /delete — erase your record, /privacy — privacy details.',
  estimate: 'Choose a platform and enter the username in the app.',
  privacy: '<b>Privacy</b>\n\nAfter /start, we store your Telegram chat ID, language, start date and referral source for bot operation. News and promotional messages are separate and require the “Receive updates & offers” button or /subscribe. Use /unsubscribe to withdraw consent and /delete to erase your record. Valued usernames and results are not stored in the subscriber database.',
  subscribed: 'You have opted in to Valuation AI news and promotional messages. Unsubscribe: /unsubscribe.',
  unsubscribed: 'Updates and offers are now turned off. You can still use username valuations.',
  deleted: 'Your record was erased. Starting the bot again will create a new record.'
};
function copyFor(language) { return String(language || '').toLowerCase().startsWith('en') ? EN : RU }
async function apiCall(method, data) {
  const response = await fetch('https://api.telegram.org/bot' + process.env.VALUATION_BOT_TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw Error('Telegram API ' + method + ' HTTP ' + response.status);
  const json = await response.json();
  if (!json.ok) throw Error('Telegram API rejected ' + method);
  return json.result;
}
async function reply(chatId, lang, key, showOpen = true) {
  const t = copyFor(lang);
  const buttons = showOpen ? [
    [{ text: t.open, web_app: { url: APP_URL } }],
    ...(key === 'start' ? [[{ text: t.optin, callback_data: 'optin_yes' }]] : [])
  ] : [];
  await apiCall('sendMessage', {
    chat_id: chatId,
    text: t[key] || t.start,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {})
  });
}

export async function handleUpdate(req, res, customStore) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.VALUATION_BOT_TOKEN || !process.env.VALUATION_WEBHOOK_SECRET) return res.status(503).json({ error: 'Not configured' });
  if (!equalsSecret(req.headers['x-telegram-bot-api-secret-token'], process.env.VALUATION_WEBHOOK_SECRET)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const store = customStore || (await import('./subscriber-store.js')).getProductionStore && await (await import('./subscriber-store.js')).getProductionStore();
    const update = req.body || {};
    const cb = update.callback_query;
    if (cb && typeof cb.id === 'string' && cb.message?.chat?.type === 'private' && Number.isSafeInteger(cb.message.chat.id)) {
      const chatId = cb.message.chat.id;
      if (cb.data === 'optin_yes') {
        await store.setUpdates(chatId, cb.from?.language_code, true, 'button');
        await apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: copyFor(cb.from?.language_code).subscribed.replace(/<\/?[^>]*>/g, '').slice(0,180) });
        await reply(chatId, cb.from?.language_code, 'subscribed', false);
      }
      return res.status(200).json({ ok: true });
    }
    const member = update.my_chat_member;
    if (member?.chat?.type === 'private' && Number.isSafeInteger(member.chat.id)) {
      if (['kicked', 'left'].includes(member.new_chat_member?.status)) await store.markBlocked(member.chat.id, true);
      return res.status(200).json({ ok: true });
    }
    const msg = update.message;
    if (msg?.chat?.type === 'private' && Number.isSafeInteger(msg.chat.id) && typeof msg.text === 'string') {
      const chatId = msg.chat.id, lang = msg.from?.language_code;
      const match = msg.text.trim().match(/^\/([a-z]+)(?:@ValuationAiBot)?(?:\s+(.+))?$/i);
      const command = (match?.[1] || 'start').toLowerCase();
      const source = match?.[2]?.trim() === 'share' ? 'share' : 'direct';
      if (command === 'delete' || command === 'stop') {
        await store.erase(chatId);
        await reply(chatId, lang, 'deleted', false);
      } else if (command === 'subscribe') {
        await store.setUpdates(chatId, lang, true);
        await reply(chatId, lang, 'subscribed', false);
      } else if (command === 'unsubscribe') {
        await store.setUpdates(chatId, lang, false);
        await reply(chatId, lang, 'unsubscribed', false);
      } else {
        await store.register(chatId, lang, source);
        await reply(chatId, lang, ['start','help','estimate','value','privacy'].includes(command)
          ? (command === 'value' ? 'estimate' : command)
          : 'start', true);
      }
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Valuation webhook error:', error.message);
    return res.status(500).json({ ok: false });
  }
}
export default function handler(req, res) { return handleUpdate(req, res); }
