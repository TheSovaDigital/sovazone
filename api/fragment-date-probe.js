const USERNAME = 'bet04';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data, null, 2));
}

function collectSnippets(html, patterns) {
  const out = [];
  const lower = html.toLowerCase();
  for (const pattern of patterns) {
    let from = 0;
    while (true) {
      const idx = lower.indexOf(pattern.toLowerCase(), from);
      if (idx < 0) break;
      out.push({
        pattern,
        index: idx,
        snippet: html.slice(Math.max(0, idx - 350), Math.min(html.length, idx + 950)),
      });
      from = idx + pattern.length;
      if (out.length >= 40) return out;
    }
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const url = `https://fragment.com/username/${USERNAME}`;
  try {
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
    if (!r.ok) return send(res, r.status, { ok: false, url, http_status: r.status, body_start: html.slice(0, 1000) });

    const snippets = collectSnippets(html, [
      'Purchased', 'Sold', 'Sale Price', 'datetime=', '<time', 'tm-datetime', 'date', 'history', 'transaction'
    ]);

    return send(res, 200, {
      ok: true,
      username: USERNAME,
      url,
      html_length: html.length,
      has_purchased: /purchased/i.test(html),
      has_datetime_attr: /datetime\s*=\s*["']/i.test(html),
      snippets,
    });
  } catch (e) {
    return send(res, 500, { ok: false, url, error: String(e?.message || e) });
  }
}
