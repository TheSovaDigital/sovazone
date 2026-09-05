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
  return { r, text, data, url: url.toString() };
}

async function fragmentPage(username) {
  const url = `https://fragment.com/username/${encodeURIComponent(username)}`;
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    },
  });
  const html = await r.text();
  const sold = /tm-status-unavail[^>]*>\s*Sold\s*</i.test(html) || />\s*Sold\s*</i.test(html);
  const priceMatch = html.match(/Sale\s*Price[\s\S]{0,1200}?class=["'][^"']*(?:tm-value|table-cell-value)[^"']*icon-ton[^"']*["'][^>]*>\s*([\d.,]+)\s*</i);
  const purchased = html.match(/Purchased\s+on\s+([^<\n]{1,120})/i);
  return {
    username,
    http_status: r.status,
    sold,
    sale_price_ton: priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null,
    purchased_text: purchased ? purchased[1].trim() : null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const apiKey = process.env.TONCENTER_API_KEY;
  if (!apiKey) return send(res, 500, { ok: false, version: 'v9', error: 'TONCENTER_API_KEY missing' });

  const limit = clampInt(req.query?.limit, 10, 1000, 100);
  const secondOffset = clampInt(req.query?.offset2, limit, 10000000, 1000);
  const fragmentChecks = clampInt(req.query?.fragment_checks, 0, 10, 5);

  try {
    const [a, b] = await Promise.all([
      tonItems(apiKey, 0, limit),
      tonItems(apiKey, secondOffset, limit),
    ]);

    const arrA = Array.isArray(a.data?.nft_items) ? a.data.nft_items : [];
    const arrB = Array.isArray(b.data?.nft_items) ? b.data.nft_items : [];

    const mapItems = (arr) => arr.map((item, i) => {
      const username = usernameFromItem(item);
      return {
        username,
        clean: !!username && /^[A-Za-z0-9]+$/.test(username),
        has_underscore: !!username && username.includes('_'),
        index: item?.index ?? item?.nft_index ?? null,
        address: item?.address ?? null,
        owner_address: item?.owner_address ?? null,
        on_sale: item?.on_sale ?? null,
        sale_contract_address: item?.sale_contract_address ?? null,
      };
    });

    const itemsA = mapItems(arrA);
    const itemsB = mapItems(arrB);
    const setA = new Set(itemsA.map(x => x.address).filter(Boolean));
    const overlap = itemsB.filter(x => x.address && setA.has(x.address)).length;

    const candidates = [...itemsA, ...itemsB]
      .filter(x => x.username && x.clean)
      .slice(0, fragmentChecks);

    const fragment = [];
    for (const c of candidates) {
      try { fragment.push(await fragmentPage(c.username)); }
      catch (e) { fragment.push({ username: c.username, error: String(e?.message || e) }); }
    }

    return send(res, 200, {
      ok: true,
      version: 'v9',
      purpose: 'Bypass Fragment sold-list 500-row cap by enumerating the Telegram Usernames NFT collection through TON Center, then checking individual Fragment pages.',
      toncenter: {
        collection: COLLECTION,
        page_a: { offset: 0, limit, http_status: a.r.status, count: arrA.length },
        page_b: { offset: secondOffset, limit, http_status: b.r.status, count: arrB.length },
        address_overlap_between_pages: overlap,
        pagination_works: arrA.length > 0 && arrB.length > 0 && overlap < Math.min(arrA.length, arrB.length),
      },
      samples: {
        page_a: itemsA.slice(0, 12),
        page_b: itemsB.slice(0, 12),
      },
      fragment_checks: fragment,
      implication: 'If TON pagination works, we can enumerate the full collection in batches and only keep clean A-Z/0-9 usernames. Fragment individual pages provide Sold/Sale Price/Purchased date for sold items.',
      next: 'If pagination_works=true, build batch collector with cursor/checkpoint storage instead of relying on Fragment marketplace pagination.'
    });
  } catch (e) {
    return send(res, 500, { ok: false, version: 'v9', error: String(e?.message || e) });
  }
}
