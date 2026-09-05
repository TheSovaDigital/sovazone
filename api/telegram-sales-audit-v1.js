const TONCENTER_BASE = 'https://toncenter.com/api/v3';
const COLLECTION = 'EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function clampInt(v, min, max, fallback) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function cleanUsername(value = '') {
  return String(value).replace(/^@+/, '').trim();
}

function usernameFromItem(item) {
  const candidates = [
    item?.content?.name,
    item?.metadata?.name,
    item?.name,
    item?.content?.domain,
    item?.metadata?.domain,
    item?.domain,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const s = cleanUsername(String(value));
    const m = s.match(/^([A-Za-z0-9_]{3,64})(?:\.t\.me)?$/i);
    if (m) return m[1];
  }

  const blobs = [item?.content, item?.metadata, item?.extra]
    .filter(Boolean)
    .map(x => typeof x === 'string' ? x : JSON.stringify(x));

  for (const blob of blobs) {
    const m = blob.match(/(?:@|username\/|domain["']?\s*:\s*["'])([A-Za-z0-9_]{3,64})/i);
    if (m) return m[1];
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stripTags(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function tonItems(apiKey, offset, limit) {
  const url = new URL(`${TONCENTER_BASE}/nft/items`);
  url.searchParams.set('collection_address', COLLECTION);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  const r = await fetch(url, {
    headers: { Accept: 'application/json', 'X-API-Key': apiKey },
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!r.ok) throw new Error(`TON Center HTTP ${r.status}: ${text.slice(0, 300)}`);
  return Array.isArray(data?.nft_items) ? data.nft_items : [];
}

function parseFragmentSale(html) {
  const sold = /tm-status-unavail[^>]*>\s*Sold\s*</i.test(html) || />\s*Sold\s*</i.test(html);

  const pricePatterns = [
    /Sale\s*Price[\s\S]{0,1400}?class=["'][^"']*(?:tm-value|table-cell-value)[^"']*icon-ton[^"']*["'][^>]*>\s*([\d.,]+)\s*</i,
    /Sale\s*Price[\s\S]{0,1400}?class=["'][^"']*icon-ton[^"']*(?:tm-value|table-cell-value)[^"']*["'][^>]*>\s*([\d.,]+)\s*</i,
  ];

  let salePriceTon = null;
  for (const re of pricePatterns) {
    const m = html.match(re);
    if (!m) continue;
    const n = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) salePriceTon = n;
    break;
  }

  let purchasedText = null;
  let purchasedAt = null;
  const timeMatch = html.match(/Purchased\s+on\s*<time\b[^>]*\bdatetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/i);
  if (timeMatch) {
    purchasedText = stripTags(timeMatch[2]);
    const ts = Date.parse(timeMatch[1]);
    if (Number.isFinite(ts)) purchasedAt = new Date(ts).toISOString();
  }

  if (!purchasedText) {
    const plain = html.match(/Purchased\s+on\s+([^<\n]{1,160})/i);
    if (plain) purchasedText = plain[1].replace(/\s+/g, ' ').trim();
  }
  if (!purchasedAt && purchasedText) {
    const normalized = purchasedText.replace(/\s+at\s+/i, ' ').trim();
    const ts = Date.parse(`${normalized} UTC`);
    if (Number.isFinite(ts)) purchasedAt = new Date(ts).toISOString();
  }

  return { sold, sale_price_ton: salePriceTon, purchased_at: purchasedAt };
}

async function fragmentPage(username, retries = 2) {
  const url = `https://fragment.com/username/${encodeURIComponent(username)}`;
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Referer: 'https://fragment.com/',
          'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 Chrome/140 Safari/537.36',
        },
      });
      const html = await r.text();
      clearTimeout(timer);
      if (!r.ok) {
        const error = new Error(`Fragment HTTP ${r.status}`);
        error.retryable = r.status === 429 || r.status >= 500;
        throw error;
      }
      return { source_url: url, ...parseFragmentSale(html) };
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      const retryable = e?.name === 'AbortError' || e?.retryable || /fetch|network|socket|timeout/i.test(String(e?.message || e));
      if (attempt >= retries || !retryable) break;
      await sleep(800 * (2 ** attempt) + Math.floor(Math.random() * 300));
    }
  }
  throw lastError || new Error('Unknown Fragment error');
}

async function mapLimit(items, concurrency, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function runner() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try { out[i] = await worker(items[i], i); }
      catch (e) { out[i] = { ...items[i], error: String(e?.message || e) }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => runner()));
  return out;
}

function authOk(req) {
  const secret = process.env.SOVA_COLLECTOR_KEY || process.env.CRON_SECRET || '';
  return !!secret && String(req.headers?.authorization || '') === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  if (!authOk(req)) return send(res, 401, { ok: false, error: 'Unauthorized' });
  const apiKey = process.env.TONCENTER_API_KEY;
  if (!apiKey) return send(res, 503, { ok: false, error: 'TONCENTER_API_KEY missing' });

  const offset = clampInt(req.query?.offset, 0, 100000000, 0);
  const limit = clampInt(req.query?.limit, 5, 50, 30);
  const concurrency = clampInt(req.query?.concurrency, 1, 4, 2);
  const retries = clampInt(req.query?.retries, 0, 4, 2);

  try {
    const nftItems = await tonItems(apiKey, offset, limit);
    const mapped = nftItems.map(item => {
      const username = usernameFromItem(item);
      return {
        username,
        username_lower: username ? username.toLowerCase() : null,
        length: username ? username.length : null,
        clean: !!username && /^[A-Za-z0-9]+$/.test(username),
        has_underscore: !!username && username.includes('_'),
        nft_index: item?.index ?? item?.nft_index ?? null,
        nft_address: item?.address ?? null,
      };
    });

    const clean = mapped.filter(x => x.username && x.clean);
    const excluded = mapped.filter(x => !x.username || !x.clean);
    const checked = await mapLimit(clean, concurrency, async row => ({
      ...row,
      fragment: await fragmentPage(row.username, retries),
    }));

    const sales = checked
      .filter(x => !x.error && x.fragment?.sold && x.fragment?.sale_price_ton != null)
      .map(x => ({
        username: x.username,
        username_lower: x.username_lower,
        length: x.length,
        sale_price_ton: x.fragment.sale_price_ton,
        purchased_at: x.fragment.purchased_at,
        nft_index: x.nft_index,
        nft_address: x.nft_address,
      }));

    const errors = checked.filter(x => x.error).map(x => ({ username: x.username, error: x.error }));
    return send(res, 200, {
      ok: true,
      version: 'audit-v1',
      offset,
      limit,
      returned_nft_items: nftItems.length,
      usernames_found: mapped.filter(x => x.username).length,
      clean_usernames: clean.length,
      excluded: excluded.length,
      checked: checked.length,
      sold_with_price: sales.length,
      errors,
      sales,
      next_offset: nftItems.length < limit ? null : offset + nftItems.length,
    });
  } catch (e) {
    return send(res, 500, { ok: false, version: 'audit-v1', offset, error: String(e?.message || e) });
  }
}
