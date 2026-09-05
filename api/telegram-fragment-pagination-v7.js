const BASE = 'https://fragment.com/?sort=listed&filter=sold';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data, null, 2));
}

async function getText(url) {
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
  const text = await r.text();
  return { ok: r.ok, status: r.status, finalUrl: r.url, text };
}

function usernames(html) {
  const out = [];
  const seen = new Set();
  const re = /(?:href|data-href)=["'](?:https?:\/\/fragment\.com)?\/username\/([^"'?#/]+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    let u = m[1];
    try { u = decodeURIComponent(u); } catch {}
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

function paginationCandidates(html) {
  const values = new Set();
  const snippets = [];
  const patterns = [
    /(?:data-next-offset|data-offset|data-offset-id|name=["']offset_id["']\s+value|name=["']offset["']\s+value)\s*=\s*["']([^"']+)["']/gi,
    /[?&](?:offset_id|offset)=([^&"'\s<>]+)/gi,
    /"(?:next_offset_id|next_offset|offset_id|offset)"\s*:\s*"?([^",}\s]+)"?/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) && values.size < 50) {
      values.add(m[1]);
      snippets.push(html.slice(Math.max(0, m.index - 180), Math.min(html.length, m.index + 380)));
    }
  }
  return { values: [...values], snippets: snippets.slice(0, 12) };
}

function sameHead(a, b) {
  return a.slice(0, 10).join('|').toLowerCase() === b.slice(0, 10).join('|').toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  try {
    const first = await getText(BASE);
    if (!first.ok) return send(res, 502, { ok: false, version: 'v7', stage: 'first', status: first.status });

    const firstUsers = usernames(first.text);
    const p = paginationCandidates(first.text);
    const last = firstUsers[firstUsers.length - 1] || '';

    const tests = [];
    const urls = [];

    for (const token of p.values.slice(0, 4)) {
      urls.push(`${BASE}&offset_id=${encodeURIComponent(token)}`);
      urls.push(`${BASE}&offset=${encodeURIComponent(token)}`);
    }

    // Fallback probes in case Fragment does not expose the token plainly in HTML.
    urls.push(`${BASE}&offset=500`);
    if (last) urls.push(`${BASE}&offset_id=${encodeURIComponent(last)}`);

    for (const url of [...new Set(urls)].slice(0, 10)) {
      try {
        const r = await getText(url);
        const us = usernames(r.text);
        tests.push({
          url,
          http_status: r.status,
          final_url: r.finalUrl,
          usernames_found: us.length,
          head: us.slice(0, 8),
          tail: us.slice(-3),
          differs_from_first: us.length > 0 && !sameHead(firstUsers, us),
        });
      } catch (e) {
        tests.push({ url, error: String(e?.message || e) });
      }
    }

    return send(res, 200, {
      ok: true,
      version: 'v7',
      purpose: 'Detect and verify Fragment Sold-list pagination before mass collection.',
      first_page: {
        http_status: first.status,
        final_url: first.finalUrl,
        usernames_found: firstUsers.length,
        head: firstUsers.slice(0, 8),
        tail: firstUsers.slice(-5),
      },
      pagination_candidates: p.values,
      candidate_snippets: p.snippets,
      tests,
      working_tests: tests.filter(x => x.differs_from_first),
      next: 'If working_tests is non-empty, use that pagination method in the mass collector.'
    });
  } catch (e) {
    return send(res, 500, { ok: false, version: 'v7', error: String(e?.message || e) });
  }
}
