// Telegram Mini App initData verification. Never trust initDataUnsafe for authorization.
import crypto from 'node:crypto';
export function verifyTelegramInitData(input, botToken, nowSeconds = Math.floor(Date.now()/1000)) {
  if (typeof input !== 'string' || !input || input.length > 8192 || !botToken) return null;
  const p = new URLSearchParams(input);
  const hash = p.get('hash');
  const userJson = p.get('user');
  const timestamp = Number(p.get('auth_date'));
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash) || !userJson) return null;
  if (!Number.isSafeInteger(timestamp) || timestamp > nowSeconds + 60 || nowSeconds-timestamp > 86400) return null;
  const lines = [...p.entries()].filter(([k])=>k!=='hash').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v);
  const secretKey = crypto.createHmac('sha256','WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256',secretKey).update(lines.join('\n')).digest('hex');
  const actualBytes = Buffer.from(hash.toLowerCase(),'hex');
  const expectedBytes = Buffer.from(expected,'hex');
  if (!crypto.timingSafeEqual(actualBytes,expectedBytes)) return null;
  try {
    const user = JSON.parse(userJson);
    return Number.isSafeInteger(user.id) && user.id > 0 ? { id:user.id, language:user.language_code||'ru' } : null;
  } catch { return null; }
}
