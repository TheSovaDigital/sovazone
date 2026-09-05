
const FRAGMENT_LIST = 'https://fragment.com/?sort=listed&filter=sold';

function json(res, status, data) {
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

function contexts(html, needle, radius = 700, max = 4) {
  const out = [];
  const lower = html.toLowerCase();
  const n = needle.toLowerCase();
  let pos = 0;
  while (out.length < max) {
    const i = lower.indexOf(n, pos);
    if (i < 0) break;
    const a = Math.max(0, i - radius);
    const b = Math.min(html.length, i + n.length + radius);
    out.push({
      raw: html.slice(a, b),
      text: stripTags(html.slice(a, b))
    });
    pos = i + n.length;
  }
  return out;
}

function extractUsernamesFromListing(html) {
  const seen = new Set();
  const out = [];
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

function extractTimestamps(html) {
  const vals = [];
  const patterns = [
    /data-timestamp=["'](\d{9,13})["']/gi,
    /data-time=["'](\d{9,13})["']/gi,
    /datetime=["']([^"']+)["']/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null && vals.length < 30) {
      vals.push(m[1]);
    }
  }
  return [...new Set(vals)].slice(0, 30);
}

function extractTonCandidates(html) {
  const text = stripTags(html);
  const candidates = [];
  const patterns = [
    /(?:Sold(?:\s+for)?|Price|Bid|Minimum bid)[^\d]{0,80}([\d,.]+)\s*TON/gi,
    /([\d,.]+)\s*TON/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null && candidates.length < 30) {
      candidates.push(m[1]);
    }
  }
  return [...new Set(candidates)].slice(0, 30);
}

async function getText(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SovaZoneResearch/1.0; +https://sovazone.com/)'
    },
    redirect: 'follow'
  });
  const text = await r.text();
  return {
    ok: r.ok,
    status: r.status,
    final_url: r.url,
    bytes: Buffer.byteLength(text),
    text
  };
}

export default async function handler(req, res) {
  try {
    const requested = String(req.query?.username || req.query?.user || '')
      .replace(/^@/, '')
      .trim();

    const listing = await getText(FRAGMENT_LIST);
    if (!listing.ok) {
      return json(res, 502, {
        ok: false,
        version: 'v5',
        stage: 'fragment_listing',
        http_status: listing.status,
        final_url: listing.final_url
      });
    }

    const all = extractUsernamesFromListing(listing.text);
    let usernames = [];

    if (requested) {
      if (!/^[A-Za-z0-9_]{3,32}$/.test(requested)) {
        return json(res, 400, { ok: false, error: 'Invalid username' });
      }
      usernames = [requested];
    } else {
      usernames = all.filter(x => !x.includes('_')).slice(0, 3);
    }

    const pages = [];
    for (const username of usernames) {
      const url = `https://fragment.com/username/${encodeURIComponent(username)}`;
      const p = await getText(url);

      const soldCtx = contexts(p.text, 'Sold', 900, 4);
      const tonCtx = contexts(p.text, 'TON', 700, 4);
      const timeCtx = contexts(p.text, 'data-timestamp', 650, 4);

      pages.push({
        username,
        request_url: url,
        http_status: p.status,
        final_url: p.final_url,
        html_bytes: p.bytes,
        page_mentions_sold: /\bSold\b/i.test(stripTags(p.text)),
        timestamps_found: extractTimestamps(p.text),
        ton_candidates: extractTonCandidates(p.text),
        sold_contexts: soldCtx,
        ton_contexts: tonCtx,
        timestamp_contexts: timeCtx
      });
    }

    return json(res, 200, {
      ok: true,
      version: 'v5',
      purpose: 'Verify what Fragment individual username pages expose for sold price/time before mass collection.',
      listing: {
        request_url: FRAGMENT_LIST,
        http_status: listing.status,
        final_url: listing.final_url,
        html_bytes: listing.bytes,
        usernames_found: all.length,
        selected: usernames
      },
      pages,
      next: 'Send this JSON/screenshot back. We will identify the exact Fragment fields for sold price/time, then build paginated collector.'
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      version: 'v5',
      error: String(e && e.message ? e.message : e)
    });
  }
}
