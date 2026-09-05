const TONCENTER_BASE = 'https://toncenter.com/api/v3';
const COLLECTION = 'EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data, null, 2));
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

async function tonItems(apiKey, offset, limit) {
  const url = new URL(`${TONCENTER_BASE}/nft/items`);
  url.searchParams.set('collection_address', COLLECTION);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  const r = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-API-Key': apiKey,
    },
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
    if (m) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n)) salePriceTon = n;
      break;
    }
  }

  let purchasedText = null;
  const pm = html.match(/Purchased\s+on\s+([^<\n]{1,160})/i);
  if (pm) purchasedText = pm[1].replace(/\s+/g, ' ').trim();

  let purchasedAt = null;
  if (purchasedText) {
    const normalized = purchasedText
      .replace(/\s+at\s+/i, ' ')
      .replace(/\s+(Telegram Username|Web Address|TON Web).*$/i, '')
      .trim();
    const ts = Date.parse(`${normalized} UTC`);
    if (Number.isFinite(ts)) purchasedAt = new Date(ts).toISOString();
  }

  return { sold, sale_price_ton: salePriceTon, purchased_text: purchasedText, purchased_at: purchasedAt };
}

async function fragmentPage(username) {
  const url = `https://fragment.com/username/${encodeURIComponent(username)}`;
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': 'https://fragment.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    },
  });

  const html = await r.text();
  if (!r.ok) throw new Error(`Fragment HTTP ${r.status}`);
  return { http_status: r.status, ...parseFragmentSale(html) };
}

async function mapLimit(items, concurrency, worker) {
  const out = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        out[i] = await worker(items[i], i);
      } catch (e) {
        out[i] = { ...items[i], error: String(e?.message || e) };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runner()));
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const apiKey = process.env.TONCENTER_API_KEY;
  if (!apiKey) return send(res, 500, { ok: false, version: 'v10', error: 'TONCENTER_API_KEY missing' });

  const offset = clampInt(req.query?.offset, 0, 10000000, 0);
  const limit = clampInt(req.query?.limit, 10, 100, 30);
  const concurrency = clampInt(req.query?.concurrency, 1, 8, 4);

  const started = Date.now();

  try {
    const nftItems = await tonItems(apiKey, offset, limit);

    const mapped = nftItems.map(item => {
      const username = usernameFromItem(item);
      return {
        username,
        clean: !!username && /^[A-Za-z0-9]+$/.test(username),
        has_underscore: !!username && username.includes('_'),
        nft_index: item?.index ?? item?.nft_index ?? null,
        nft_address: item?.address ?? null,
        owner_address: item?.owner_address ?? null,
        on_sale_now: item?.on_sale ?? null,
        sale_contract_address: item?.sale_contract_address ?? null,
      };
    });

    const clean = mapped.filter(x => x.username && x.clean);

    const checked = await mapLimit(clean, concurrency, async row => {
      const fragment = await fragmentPage(row.username);
      return { ...row, fragment };
    });

    const sold = checked.filter(x => x.fragment?.sold && x.fragment?.sale_price_ton !== null);
    const errors = checked.filter(x => x.error);

    return send(res, 200, {
      ok: true,
      version: 'v10',
      purpose: 'Pilot batch collector: enumerate TON username NFTs, exclude underscores, then read authoritative Fragment sold price/date from each individual username page.',
      batch: {
        offset,
        limit,
        returned_nft_items: nftItems.length,
        usernames_found: mapped.filter(x => x.username).length,
        clean_usernames: clean.length,
        excluded_underscore_or_invalid: mapped.length - clean.length,
        fragment_checked: checked.length,
        sold_with_price: sold.length,
        fragment_errors: errors.length,
        elapsed_ms: Date.now() - started,
        next_offset: nftItems.length === limit ? offset + limit : null,
      },
      sold: sold.slice(0, 50),
      unsold_or_unparsed_sample: checked.filter(x => !x.fragment?.sold || x.fragment?.sale_price_ton === null).slice(0, 10),
      errors: errors.slice(0, 10),
      next: 'If sold_with_price > 0 and fragment_errors stay low, move collection to an automated background job with checkpoint storage and CSV/JSONL output.'
    });
  } catch (e) {
    return send(res, 500, { ok: false, version: 'v10', error: String(e?.message || e) });
  }
}
