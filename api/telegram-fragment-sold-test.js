const FRAGMENT_SOLD_URL = 'https://fragment.com/?sort=listed&filter=sold';
const TONCENTER_BASE = 'https://toncenter.com/api/v3';
const COLLECTION = 'EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi';

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function textOnly(html = '') {
  return decodeHtml(
    String(html)
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function classText(row, classNeedle) {
  const safe = classNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<(?:div|span|td)[^>]*class=["'][^"']*${safe}[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:div|span|td)>`,
    'i'
  );
  const m = row.match(re);
  return m ? textOnly(m[1]) : '';
}

function parseTon(text) {
  const raw = String(text || '')
    .replace(/TON/gi, '')
    .replace(/[\u00a0\u202f\s]/g, '')
    .replace(/,/g, '')
    .replace(/[^0-9.]/g, '');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function cleanUsername(value) {
  return String(value || '')
    .replace(/^@+/, '')
    .trim();
}

function usernameFromRow(row) {
  const candidates = [
    /(?:href|data-href)=["']\/username\/([^"'?#/]+)["']/i,
    /(?:href|data-href)=["']https?:\/\/fragment\.com\/username\/([^"'?#/]+)["']/i,
  ];
  for (const re of candidates) {
    const m = row.match(re);
    if (m?.[1]) {
      try { return cleanUsername(decodeURIComponent(m[1])); }
      catch { return cleanUsername(m[1]); }
    }
  }

  const title = classText(row, 'table-cell-value tm-value');
  const m = title.match(/@?([A-Za-z0-9_]{3,64})/);
  return m ? cleanUsername(m[1]) : '';
}

function parseSoldRows(html) {
  const rows = [];
  const rowRe = /<tr\b[^>]*class=["'][^"']*tm-row-selectable[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = rowRe.exec(html))) {
    const row = match[0];
    const username = usernameFromRow(row);
    if (!username) continue;

    const priceText = classText(row, 'icon-ton');
    const statusText = classText(row, 'tm-status-unavail') || 'Sold';
    const timeMatch = row.match(/<time\b[^>]*datetime=["']([^"']+)["']/i);
    const soldAt = timeMatch?.[1] || null;
    const clean = /^[A-Za-z0-9]+$/.test(username);

    rows.push({
      username,
      url: `https://fragment.com/username/${encodeURIComponent(username)}`,
      status: statusText,
      price_ton: parseTon(priceText),
      price_text: priceText || null,
      sold_at: soldAt,
      length: username.length,
      is_clean: clean,
      has_underscore: username.includes('_'),
      letters_only: /^[A-Za-z]+$/.test(username),
      digits_only: /^\d+$/.test(username),
      alphanumeric: /^[A-Za-z0-9]+$/.test(username),
    });
  }

  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.username.toLowerCase()}|${row.sold_at || ''}|${row.price_ton ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchFragment() {
  const response = await fetch(FRAGMENT_SOLD_URL, {
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

  const html = await response.text();
  if (!response.ok) {
    throw new Error(`Fragment HTTP ${response.status}: ${textOnly(html).slice(0, 240)}`);
  }
  return { html, status: response.status, finalUrl: response.url };
}

async function toncenterHealth(apiKey) {
  if (!apiKey) return { ok: false, error: 'TONCENTER_API_KEY missing' };
  try {
    const url = new URL(`${TONCENTER_BASE}/nft/collections`);
    url.searchParams.set('collection_address', COLLECTION);
    url.searchParams.set('limit', '1');
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-API-Key': apiKey },
    });
    const data = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      collection_found: Array.isArray(data?.nft_collections) && data.nft_collections.length > 0,
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = clampInt(req.query?.limit, 1, 100, 30);
  const cleanOnly = String(req.query?.clean ?? '1') !== '0';
  const debug = String(req.query?.debug ?? '0') === '1';

  try {
    const [{ html, status, finalUrl }, toncenter] = await Promise.all([
      fetchFragment(),
      toncenterHealth(process.env.TONCENTER_API_KEY),
    ]);

    const parsed = parseSoldRows(html);
    const clean = parsed.filter((x) => x.is_clean);
    const selected = (cleanOnly ? clean : parsed).slice(0, limit);

    const result = {
      ok: parsed.length > 0,
      source: 'Fragment public sold listing',
      fragment: {
        request_url: FRAGMENT_SOLD_URL,
        final_url: finalUrl,
        http_status: status,
        html_bytes: Buffer.byteLength(html, 'utf8'),
      },
      toncenter,
      filters: {
        clean_only: cleanOnly,
        clean_rule: 'A-Z / a-z / 0-9 only; underscores excluded from CLEAN',
      },
      counts: {
        rows_parsed: parsed.length,
        clean_rows: clean.length,
        excluded_rows: parsed.length - clean.length,
        returned: selected.length,
      },
      sold: selected,
      note: parsed.length
        ? 'v2 reads the Fragment Sold page. Blockchain-level sale verification will be added after we confirm the returned row structure.'
        : 'No sold rows were parsed. Use ?debug=1 and send the response so the parser can be adjusted to the current Fragment HTML.',
    };

    if (debug) {
      result.debug = {
        html_head: textOnly(html).slice(0, 2500),
        has_tm_row_selectable: /tm-row-selectable/i.test(html),
        has_filter_sold: /filter=sold/i.test(html),
      };
    }

    return res.status(parsed.length ? 200 : 502).json(result);
  } catch (error) {
    console.error('telegram-fragment-sold-test error', error);
    return res.status(502).json({
      ok: false,
      error: 'Fragment sold-list request failed',
      details: String(error?.message || error),
      next: 'Open this endpoint with ?debug=1 and send the JSON response.',
    });
  }
}
