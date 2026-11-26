// Private storage for users who start @ValuationAiBot.
// Never store valued handles. Service notices default on; advertising is explicit opt-in.
import crypto from 'node:crypto';

function pathFor(chatId) {
  if (!Number.isSafeInteger(chatId) || chatId <= 0) throw Error('Invalid private chat ID');
  return 'valuation-bot/users/' + crypto.createHash('sha256').update(String(chatId)).digest('hex') + '.json';
}

export function createSubscriberStore({ get, put, del }) {
  async function read(chatId) {
    const result = await get(pathFor(chatId), { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    const record = JSON.parse(text);
    if (record.chatId !== chatId) throw Error('Subscriber record mismatch');
    return record;
  }
  async function save(chatId, record) {
    await put(pathFor(chatId), JSON.stringify(record), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json'
    });
    return record;
  }
  return {
    async register(chatId, language, entrySource = 'direct') {
      const current = await read(chatId);
      const now = new Date().toISOString();
      return save(chatId, {
        chatId,
        language: String(language || '').toLowerCase().startsWith('en') ? 'en' : 'ru',
        createdAt: current?.createdAt || now,
        lastStartedAt: now,
        source: current?.source || (entrySource === 'share' ? 'share' : 'direct'),
        serviceUpdatesEnabled: current?.serviceUpdatesEnabled !== false,
        serviceUnsubscribedAt: current?.serviceUnsubscribedAt || null,
        newsOptIn: current?.newsOptIn === true,
        marketingConsentAt: current?.marketingConsentAt || null,
        marketingConsentSource: current?.marketingConsentSource || null,
        marketingConsentVersion: current?.marketingConsentVersion || null,
        blocked: false
      });
    },
    async setUpdates(chatId, language, permitted, consentSource = 'command') {
      const current = await read(chatId);
      const now = new Date().toISOString();
      return save(chatId, {
        chatId,
        language: current?.language || (String(language || '').toLowerCase().startsWith('en') ? 'en' : 'ru'),
        createdAt: current?.createdAt || now,
        lastStartedAt: current?.lastStartedAt || now,
        source: current?.source || 'direct',
        serviceUpdatesEnabled: permitted === true ? true : current?.serviceUpdatesEnabled !== false,
        serviceUnsubscribedAt: permitted === true ? null : current?.serviceUnsubscribedAt || null,
        newsOptIn: permitted === true,
        marketingConsentAt: permitted === true ? now : null,
        marketingConsentSource: permitted === true ? (consentSource === 'button' ? 'button' : 'command') : null,
        marketingConsentVersion: permitted === true ? 'valuation-marketing-v1-2026-11' : null,
        blocked: false
      });
    },
    async setServiceUpdates(chatId, language, permitted) {
      const current = await read(chatId);
      const now = new Date().toISOString();
      const allowed = permitted === true;
      return save(chatId, {
        ...(current || {}),
        chatId,
        language: current?.language || (String(language || '').toLowerCase().startsWith('en') ? 'en' : 'ru'),
        createdAt: current?.createdAt || now,
        lastStartedAt: current?.lastStartedAt || now,
        source: current?.source || 'direct',
        serviceUpdatesEnabled: allowed,
        serviceUnsubscribedAt: allowed ? null : now,
        newsOptIn: allowed && current?.newsOptIn === true,
        marketingConsentAt: allowed ? current?.marketingConsentAt || null : null,
        marketingConsentSource: allowed ? current?.marketingConsentSource || null : null,
        marketingConsentVersion: allowed ? current?.marketingConsentVersion || null : null,
        blocked: false
      });
    },
    async markBlocked(chatId, blocked) {
      const current = await read(chatId);
      if (!current) return null;
      return save(chatId, { ...current, blocked: !!blocked, serviceUpdatesEnabled: blocked ? false : current.serviceUpdatesEnabled, newsOptIn: blocked ? false : current.newsOptIn, marketingConsentAt: blocked ? null : current.marketingConsentAt || null });
    },
    async get(chatId) { return read(chatId) },
    async erase(chatId) {
      await del(pathFor(chatId));
      return true;
    }
  };
}

export async function getProductionStore() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw Error('Private subscriber storage is not configured');
  const { get, put, del } = await import('@vercel/blob');
  return createSubscriberStore({ get, put, del });
}
