
const FRAGMENT_LIST = 'https://fragment.com/?sort=listed&filter=sold';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data, null, 2));
}

function decodeHtml(s = '') {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(s = '') {
  return decodeHtml(
    s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
     .replace(/<style[\s\S]*?<\/style>/gi, ' ')
     .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

async function getText(url) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SovaZoneResearch/1.0; +https://sovazone.com/)'
    }
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, final_url: r.url, text, bytes: Buffer.byteLength(text) };
}

function extractUsernames(html) {
  const out = [];
  const seen = new Set();
  const re = /href=["']\/username\/([A-Za-z0-9_]{3,32})(?:[?"'#]|["'])/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[1];
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

function normalizeNumber(s) {
  if (!s) return null;
  const x = s.replace(/\s/g, '').replace(/,/g, '');
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function extractSalePriceTon(html) {
  // Fragment individual sold pages currently render:
  // Sale Price ... <div class="table-cell-value tm-value icon-before icon-ton">10</div>
  const patterns = [
    /Sale\s*Price[\s\S]{0,1200}?class=["'][^"']*(?:tm-value|table-cell-value)[^"']*icon-ton[^"']*["'][^>]*>\s*([\d.,]+)\s*</i,
    /Sale\s*Price[\s\S]{0,1200}?class=["'][^"']*icon-ton[^"']*(?:tm-value|table-cell-value)[^"']*["'][^>]*>\s*([\d.,]+)\s*</i,
    /Sale\s*Price[\s\S]{0,900}?>\s*([\d.,]+)\s*<\/(?:div|span)>/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = normalizeNumber(m[1]);
      if (n !== null) return { ton: n, raw: m[1], method: re.source };
    }
  }
  return null;
}

function extractOwner(html) {
  const idx = html.search(/>\s*Owner\s*</i);
  if (idx < 0) return null;
  const chunk = html.slice(idx, idx + 2500);
  const href = chunk.match(/href=["']https:\/\/tonviewer\.com\/([^"'/?#]+)["']/i);
  return href ? href[1] : null;
}

function extractStatus(html) {
  const text = stripTags(html.slice(0, 20000));
  if (/\bSold\b/i.test(text)) return 'Sold';
  if (/\bAuction\b/i.test(text)) return 'Auction';
  return 'Unknown';
}

function extractUsefulContext(html) {
  const idx = html.search(/Sale\s*Price/i);
  if (idx < 0) return null;
  const raw = html.slice(Math.max(0, idx - 400), Math.min(html.length, idx + 1800));
  return { raw, text: stripTags(raw) };
}

export default async function handler(req, res) {
  try {
    const requested = String(req.query?.username || '')
      .replace(/^@/, '')
      .trim();

    const listing = await getText(FRAGMENT_LIST);
    if (!listing.ok) {
      return send(res, 502, { ok: false, version: 'v6', stage: 'listing', status: listing.status });
    }

    const all = extractUsernames(listing.text);
    const selected = requested
      ? [requested]
      : all.filter(x => !x.includes('_')).slice(0, 5);

    const results = [];

    for (const username of selected) {
      if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) continue;

      const page = await getText(`https://fragment.com/username/${encodeURIComponent(username)}`);
      const price = extractSalePriceTon(page.text);

      results.push({
        username,
        http_status: page.status,
        final_url: page.final_url,
        status: extractStatus(page.text),
        sale_price_ton: price?.ton ?? null,
        sale_price_raw: price?.raw ?? null,
        price_extraction_ok: !!price,
        owner: extractOwner(page.text),
        is_clean: /^[A-Za-z0-9]+$/.test(username),
        has_underscore: username.includes('_'),
        length: username.length,
        sale_price_context: extractUsefulContext(page.text)
      });
    }

    return send(res, 200, {
      ok: true,
      version: 'v6',
      purpose: 'Extract authoritative Sale Price directly from individual Fragment sold username pages.',
      listing: {
        http_status: listing.status,
        usernames_found: all.length,
        selected
      },
      counts: {
        checked: results.length,
        price_extracted: results.filter(x => x.price_extraction_ok).length,
        sold_status: results.filter(x => x.status === 'Sold').length
      },
      results,
      next: 'If sale_price_ton is extracted for most rows, next version will add pagination and persistent export for mass collection.'
    });
  } catch (e) {
    return send(res, 500, {
      ok: false,
      version: 'v6',
      error: String(e?.message || e)
    });
  }
}
