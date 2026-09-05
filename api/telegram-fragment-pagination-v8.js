const PAGE_URL = 'https://fragment.com/?sort=listed&filter=sold';
const API_BASE = 'https://fragment.com/api';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data, null, 2));
}

function getCookieHeader(headers) {
  try {
    if (typeof headers.getSetCookie === 'function') {
      const arr = headers.getSetCookie();
      if (Array.isArray(arr) && arr.length) return arr.map(x => x.split(';', 1)[0]).join('; ');
    }
  } catch {}
  const raw = headers.get('set-cookie');
  if (!raw) return '';
  return raw.split(/,(?=[^;,]+=)/).map(x => x.split(';', 1)[0]).join('; ');
}

function extractHash(html) {
  const patterns = [
    /api\?hash=([a-f0-9]+)/i,
    /\\\/api\?hash=([a-f0-9]+)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function htmlFromApi(data) {
  if (typeof data?.html === 'string') return data.html;
  return `${data?.body || ''}${data?.foot || ''}`;
}

function usernames(html = '') {
  const out = [];
  const seen = new Set();
  const re = /href=["']\/(username)\/([^"'?#/]+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    let u = m[2];
    try { u = decodeURIComponent(u); } catch {}
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

function nextOffset(html = '') {
  const m = html.match(/data-next-offset=["'](\d+)["']/i);
  return m ? m[1] : null;
}

async function callApi(hash, cookie, offsetId = null) {
  const body = new URLSearchParams();
  body.set('method', 'searchAuctions');
  body.set('type', 'usernames');
  body.set('query', '');
  body.set('sort', 'listed');
  body.set('filter', 'sold');
  if (offsetId !== null) body.set('offset_id', String(offsetId));

  const headers = {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Origin': 'https://fragment.com',
    'Referer': PAGE_URL,
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  };
  if (cookie) headers.Cookie = cookie;

  const r = await fetch(`${API_BASE}?hash=${encodeURIComponent(hash)}`, {
    method: 'POST',
    redirect: 'follow',
    headers,
    body,
  });

  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { status: r.status, final_url: r.url, text, data };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  try {
    const page = await fetch(PAGE_URL, {
      redirect: 'follow',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      },
    });

    const html = await page.text();
    const hash = extractHash(html);
    const cookie = getCookieHeader(page.headers);

    if (!hash) {
      return send(res, 502, {
        ok: false,
        version: 'v8',
        stage: 'extract_hash',
        page_status: page.status,
        has_api_hash_text: /api\?hash=/i.test(html),
      });
    }

    const first = await callApi(hash, cookie, null);
    const firstHtml = htmlFromApi(first.data);
    const firstUsers = usernames(firstHtml);
    const offset1 = nextOffset(firstHtml);

    let second = null;
    let secondUsers = [];
    let offset2 = null;

    if (offset1) {
      second = await callApi(hash, cookie, offset1);
      const secondHtml = htmlFromApi(second.data);
      secondUsers = usernames(secondHtml);
      offset2 = nextOffset(secondHtml);
    }

    return send(res, 200, {
      ok: true,
      version: 'v8',
      purpose: 'Use Fragment searchAuctions API directly and verify offset_id pagination.',
      page: {
        status: page.status,
        final_url: page.url,
        hash_found: true,
        cookie_present: !!cookie,
      },
      api_first: {
        http_status: first.status,
        response_keys: first.data && typeof first.data === 'object' ? Object.keys(first.data) : [],
        error: first.data?.error ?? null,
        usernames_found: firstUsers.length,
        head: firstUsers.slice(0, 8),
        tail: firstUsers.slice(-5),
        next_offset_id: offset1,
      },
      api_second: second ? {
        http_status: second.status,
        response_keys: second.data && typeof second.data === 'object' ? Object.keys(second.data) : [],
        error: second.data?.error ?? null,
        usernames_found: secondUsers.length,
        head: secondUsers.slice(0, 8),
        tail: secondUsers.slice(-5),
        next_offset_id: offset2,
        differs_from_first: firstUsers.slice(0, 10).join('|').toLowerCase() !== secondUsers.slice(0, 10).join('|').toLowerCase(),
      } : null,
      debug: {
        first_response_preview: first.data ? null : first.text.slice(0, 800),
        second_response_preview: second && !second.data ? second.text.slice(0, 800) : null,
      },
      next: 'If api_second.differs_from_first is true and next_offset_id advances, pagination is solved.'
    });
  } catch (e) {
    return send(res, 500, { ok: false, version: 'v8', error: String(e?.message || e) });
  }
}
