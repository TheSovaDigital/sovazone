import { get, put } from '@vercel/blob';

const ROOT = 'sovausername/telegram-sales-v11';
const CHECKPOINT_PATH = `${ROOT}/checkpoint.json`;

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stripTags(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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
  return { sold, sale_price_ton: salePriceTon, purchased_text: purchasedText, purchased_at: purchasedAt };
}

async function fragmentPage(username, retries = 5) {
  const url = `https://fragment.com/username/${encodeURIComponent(username)}`;
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
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
      return { http_status: r.status, attempts: attempt + 1, source_url: url, ...parseFragmentSale(html) };
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      const retryable = e?.name === 'AbortError' || e?.retryable || /fetch|network|socket|timeout/i.test(String(e?.message || e));
      if (attempt >= retries || !retryable) break;
      await sleep(Math.min(12000, 1000 * (2 ** attempt)) + Math.floor(Math.random() * 500));
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
      catch (e) { out[i] = { username: items[i]?.username, error: String(e?.message || e) }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => runner()));
  return out;
}

async function readJson(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode === 404) return null;
  if (result.statusCode !== 200) throw new Error(`Blob read failed ${pathname}: HTTP ${result.statusCode}`);
  return JSON.parse(await new Response(result.stream).text());
}

async function readJsonl(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode === 404) return null;
  if (result.statusCode !== 200) throw new Error(`Blob read failed ${pathname}: HTTP ${result.statusCode}`);
  const text = await new Response(result.stream).text();
  return text.split('\n').filter(Boolean).map(line => JSON.parse(line));
}

async function writeJson(pathname, value) {
  return put(pathname, JSON.stringify(value, null, 2), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json; charset=utf-8' });
}

async function writeJsonl(pathname, rows) {
  const body = rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
  return put(pathname, body, { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/x-ndjson; charset=utf-8' });
}

function authorized(req) {
  const secret = process.env.SOVA_COLLECTOR_KEY || process.env.CRON_SECRET || '';
  return !!secret && String(req.headers?.authorization || '') === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  if (!authorized(req)) return send(res, 401, { ok: false, error: 'Unauthorized' });
  const offset = clampInt(req.query?.offset, 0, 100000000, -1);
  if (offset < 0) return send(res, 400, { ok: false, error: 'offset is required' });
  const concurrency = clampInt(req.query?.concurrency, 1, 2, 1);
  const retries = clampInt(req.query?.retries, 1, 6, 5);
  const padded = String(offset).padStart(9, '0');
  const batchPath = `${ROOT}/batches/offset-${padded}.jsonl`;
  const errorPath = `${ROOT}/errors/offset-${padded}.jsonl`;

  try {
    const rows = await readJsonl(batchPath);
    if (!rows) return send(res, 404, { ok: false, error: 'batch_not_found', offset, batchPath });

    const errorRows = (await readJsonl(errorPath)) || [];
    const embeddedErrors = rows.filter(row => row?.username && row?.error);
    const sourceTargets = errorRows.length ? errorRows : embeddedErrors;
    const dedup = new Map();
    for (const row of sourceTargets) if (row?.username) dedup.set(row.username.toLowerCase(), row);
    const targets = [...dedup.values()];

    if (!targets.length) {
      const checkpoint = await readJson(CHECKPOINT_PATH);
      return send(res, 200, {
        ok: true, mode: 'repair_fragment_errors', offset, targets: 0, repaired: 0,
        unresolved: Number(checkpoint?.fragment_errors_total || 0), sold_added: 0, dates_added: 0,
        reason: 'no_error_rows_found', checkpoint,
      });
    }

    const checkedAt = new Date().toISOString();
    const fixed = await mapLimit(targets, concurrency, async row => {
      const fragment = await fragmentPage(row.username, retries);
      return { username: row.username, fragment };
    });
    const byUser = new Map(fixed.filter(x => x?.username && !x.error).map(x => [x.username.toLowerCase(), x.fragment]));

    let repaired = 0;
    let soldAdded = 0;
    let datesAdded = 0;
    const rowIndex = new Map(rows.filter(r => r?.username).map((r, i) => [r.username.toLowerCase(), i]));

    for (const target of targets) {
      const key = target.username.toLowerCase();
      const fragment = byUser.get(key);
      if (!fragment) continue;
      let idx = rowIndex.get(key);
      if (idx == null) {
        rows.push({ ...target });
        idx = rows.length - 1;
        rowIndex.set(key, idx);
      }
      const row = rows[idx];
      delete row.error;
      row.source = 'fragment_individual_page';
      row.source_url = fragment.source_url;
      row.collected_at = checkedAt;
      row.fragment = {
        http_status: fragment.http_status,
        attempts: fragment.attempts,
        sold: fragment.sold,
        sale_price_ton: fragment.sale_price_ton,
        purchased_text: fragment.purchased_text,
        purchased_at: fragment.purchased_at,
      };
      repaired += 1;
      if (fragment.sold && fragment.sale_price_ton != null) soldAdded += 1;
      if (fragment.sold && fragment.sale_price_ton != null && fragment.purchased_at) datesAdded += 1;
    }

    const unresolvedTargets = targets.filter(t => !byUser.has(t.username.toLowerCase()));
    await writeJsonl(batchPath, rows);
    await writeJsonl(errorPath, unresolvedTargets);

    const checkpoint = await readJson(CHECKPOINT_PATH);
    if (checkpoint && repaired > 0) {
      checkpoint.fragment_errors_total = Math.max(0, Number(checkpoint.fragment_errors_total || 0) - repaired);
      checkpoint.sold_with_price_total = Number(checkpoint.sold_with_price_total || 0) + soldAdded;
      checkpoint.sale_dates_total = Number(checkpoint.sale_dates_total || 0) + datesAdded;
      checkpoint.updated_at = new Date().toISOString();
      checkpoint.last_error_repair = { offset, repaired, unresolved: unresolvedTargets.length, sold_added: soldAdded, dates_added: datesAdded, repaired_at: checkpoint.updated_at };
      await writeJson(CHECKPOINT_PATH, checkpoint);
    }

    return send(res, 200, {
      ok: true, mode: 'repair_fragment_errors', offset, targets: targets.length,
      repaired, unresolved: unresolvedTargets.length, sold_added: soldAdded, dates_added: datesAdded,
      failures: fixed.filter(x => x?.error), checkpoint,
    });
  } catch (e) {
    return send(res, 500, { ok: false, mode: 'repair_fragment_errors', offset, error: String(e?.message || e) });
  }
}
