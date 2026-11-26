// Privacy-aware Telegram webhook for @ValuationAiBot. No username valuations are stored here.
import crypto from 'node:crypto';
import {recordEvent,isValuationAdmin} from './analytics.js';
import {issueAdminCode} from './admin-auth.js';

const APP_URL = process.env.PUBLIC_APP_URL || 'https://valuation.sovazone.com';
const BUY_CHANNEL_URL = 'https://t.me/SovaDigital';
const SELL_CHANNEL_URL = 'https://t.me/SovaUsername';
const WEBSITE_URL = 'https://sovazone.com/';
function equalsSecret(value, secret) {
  if (!value || !secret) return false;
  const a = Buffer.from(String(value));
  const b = Buffer.from(String(secret));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const RU = {
  open: 'Оценить никнейм',
  buy: 'Купить ник',
  sell: 'Продать ник',
  website: 'Посетить сайт',
  start: '<b>SovaZone Valuation AI</b>\n\nОцените никнейм Instagram, TikTok или Telegram — бесплатно и за пару нажатий.\n\nНажмите «Оценить никнейм», чтобы открыть приложение.\n\nПосле /start включаются уведомления о работе и обновлениях сервиса. Отключить их можно командой /unsubscribe. Рекламные предложения отправляются только при отдельной подписке через /subscribe.',
  help: '<b>Как пользоваться</b>\n\n1. Откройте приложение.\n2. Выберите платформу.\n3. Введите никнейм и запустите оценку.\n\nКоманды: /unsubscribe — отключить уведомления, /subscribe — включить уведомления и отдельно согласиться на рекламу, /delete — удалить запись, /privacy — конфиденциальность, /myid — ваш Telegram ID.',
  estimate: 'Выберите платформу и введите никнейм в приложении.',
  privacy: '<b>Конфиденциальность</b>\n\nПосле /start мы сохраняем Telegram ID чата, язык, дату входа и источник перехода, чтобы бот работал. Обычные уведомления об обновлениях сервиса включаются после /start, но их можно отключить через /unsubscribe. Реклама допускается только при отдельном согласии через /subscribe; /unsubscribe также отзывает его. Запись можно удалить через /delete. Оцениваемые никнеймы и результаты не хранятся в аналитике. Фиксируем только анонимизированные события входа и успешной оценки по платформе.',
  subscribed: 'Вы включили уведомления и отдельно согласились получать рекламные предложения Valuation AI. Отписаться: /unsubscribe.',
  unsubscribed: 'Уведомления и рекламные рассылки отключены. Оценка никнеймов по-прежнему доступна.',
  deleted: 'Ваша запись удалена. При повторном /start она будет создана заново.'
};
const EN = {
  open: 'Evaluate username',
  buy: 'Buy a username',
  sell: 'Sell a username',
  website: 'Visit website',
  start: '<b>SovaZone Valuation AI</b>\n\nEstimate an Instagram, TikTok or Telegram username in just a few taps.\n\nTap “Evaluate username” to open the app.\n\nStarting the bot enables service notices and product update notifications. Disable them any time with /unsubscribe. Promotional messages require a separate /subscribe command.',
  help: '<b>How to use Valuation AI</b>\n\n1. Open the app.\n2. Choose a platform.\n3. Enter a username and run valuation.\n\nCommands: /unsubscribe — disable notices, /subscribe — enable notices and opt in to promotions, /delete — erase your record, /privacy — privacy details, /myid — your Telegram ID.',
  estimate: 'Choose a platform and enter the username in the app.',
  privacy: '<b>Privacy</b>\n\nAfter /start, we store your Telegram chat ID, language, start date and referral source for bot operation. Service notices and product update notifications are enabled after /start; use /unsubscribe to disable them. Promotional messages require separate explicit consent via /subscribe; /unsubscribe also withdraws that consent. Use /delete to erase your record. Valued usernames and results are not stored in analytics. We count pseudonymous opens and successful estimates by platform.',
  subscribed: 'You have enabled service notices and explicitly opted in to Valuation AI promotions. Unsubscribe: /unsubscribe.',
  unsubscribed: 'Service notices and promotional messages are now disabled. Username valuations remain available.',
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
    [
      { text: t.buy, url: BUY_CHANNEL_URL },
      { text: t.sell, url: SELL_CHANNEL_URL }
    ],
    [{ text: t.website, url: WEBSITE_URL }]
  ] : [];
  await apiCall('sendMessage', {
    chat_id: chatId,
    text: t[key] || t.start,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {})
  });
}

export async function handleUpdate(req, res, customStore, customRecordEvent) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.VALUATION_BOT_TOKEN || !process.env.VALUATION_WEBHOOK_SECRET) return res.status(503).json({ error: 'Not configured' });
  if (!equalsSecret(req.headers['x-telegram-bot-api-secret-token'], process.env.VALUATION_WEBHOOK_SECRET)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const store = customStore || (await import('./subscriber-store.js')).getProductionStore && await (await import('./subscriber-store.js')).getProductionStore();
    const analytics=customRecordEvent||(customStore?null:recordEvent);
    async function log(entry){if(analytics)try{await analytics(entry)}catch(e){console.error('Valuation bot analytics event failed',e?.message)}}
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
      if(command==='myid'){
        await apiCall('sendMessage',{chat_id:chatId,text:'Telegram ID: '+String(chatId)});
      } else if(command==='stats'){
        if(isValuationAdmin(msg.from?.id)&&msg.from?.id===chatId){
          const code=await issueAdminCode(chatId);
          await apiCall('sendMessage',{chat_id:chatId,
            text:lang?.startsWith('en')
              ?'Private analytics. Open inside Telegram, or sign in on your computer using this single-use code (valid 10 minutes):\n\n<code>'+code+'</code>\n\nNever share the code.'
              :'Закрытая аналитика. Откройте панель в Telegram или войдите с компьютера по одноразовому коду (действует 10 минут):\n\n<code>'+code+'</code>\n\nНикому не передавайте этот код.',
            parse_mode:'HTML',
            reply_markup:{inline_keyboard:[[{text:lang?.startsWith('en')?'Open statistics':'Открыть статистику',web_app:{url:APP_URL+'/admin.html'}}]]}});
        }else{
          await apiCall('sendMessage',{chat_id:chatId,text:lang?.startsWith('en')?'Administrator access only. Use /myid to view your Telegram ID.':'Доступ только администратору. Команда /myid покажет ваш Telegram ID.'});
        }
      } else if (command === 'delete' || command === 'stop') {
        await store.erase(chatId);
        await reply(chatId, lang, 'deleted', false);
      } else if (command === 'subscribe') {
        await store.setUpdates(chatId, lang, true);
        await reply(chatId, lang, 'subscribed', false);
      } else if (command === 'unsubscribe') {
        await store.setServiceUpdates(chatId, lang, false);
        await reply(chatId, lang, 'unsubscribed', false);
      } else {
        const subscriber=await store.register(chatId, lang, source);
        if(command==='start'){
          await log({userId:chatId,type:'bot_start',platform:'none',source});
          if(subscriber?.createdAt&&subscriber.createdAt===subscriber.lastStartedAt)
            await log({userId:chatId,type:'bot_registered',platform:'none',source});
        }
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
