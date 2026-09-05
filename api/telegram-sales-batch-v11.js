import { get, put } from '@vercel/blob';

const TONCENTER_BASE = 'https://toncenter.com/api/v3';
const COLLECTION = 'EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi';
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

  return {
    sold,
    sale_price_ton: salePriceTon,
    purchased_text: purchasedText,
    purchased_at: purchasedAt,
  };
}

async function fragmentPage(username, retries) {
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
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': 'https://fragment.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        },
      });

      const html = await r.text();
      clearTimeout(timer);

      if (!r.ok) {
        const error = new Error(`Fragment HTTP ${r.status}`);
        error.retryable = r.status === 429 || r.status >= 500;
        throw error;
      }

      return {
        http_status: r.status,
        attempts: attempt + 1,
        source_url: url,
        ...parseFragmentSale(html),
      };
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      const retryable = e?.name === 'AbortError' || e?.retryable || /fetch|network|socket|timeout/i.test(String(e?.message || e));
      if (attempt >= retries || !retryable) break;
      await sleep(500 * (2 ** attempt) + Math.floor(Math.random() * 250));
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
      try {
        out[i] = await worker(items[i], i);
      } catch (e) {
        out[i] = { ...items[i], error: String(e?.message || e) };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => runner()));
  return out;
}

async function readCheckpoint() {
  const result = await get(CHECKPOINT_PATH, { access: 'private' });
  if (!result || result.statusCode === 404) return null;
  if (result.statusCode !== 200) throw new Error(`Blob checkpoint read failed: HTTP ${result.statusCode}`);

  const text = await new Response(result.stream).text();
  return JSON.parse(text);
}

async function writeJson(pathname, value) {
  return put(pathname, JSON.stringify(value, null, 2), {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json; charset=utf-8',
  });
}

async function writeJsonl(pathname, rows) {
  const body = rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
  return put(pathname, body, {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/x-ndjson; charset=utf-8',
  });
}

function authState(req) {
  const secret = process.env.SOVA_COLLECTOR_KEY || process.env.CRON_SECRET || '';
  if (!secret) return { configured: false, ok: false };
  const auth = String(req.headers?.authorization || '');
  return { configured: true, ok: auth === `Bearer ${secret}` };
}

function initialCheckpoint(startOffset = 0) {
  const now = new Date().toISOString();
  return {
    version: 'v11',
    collection: COLLECTION,
    started_at: now,
    updated_at: now,
    next_offset: startOffset,
    complete: false,
    batches_total: 0,
    nft_items_total: 0,
    usernames_found_total: 0,
    clean_usernames_total: 0,
    excluded_total: 0,
    fragment_checked_total: 0,
    sold_with_price_total: 0,
    fragment_errors_total: 0,
    last_batch: null,
  };
}

async function statusResponse(res) {
  try {
    const checkpoint = await readCheckpoint();
    return send(res, 200, {
      ok: true,
      version: 'v11',
      mode: 'status',
      storage: 'Vercel Blob private',
      checkpoint,
      collector_auth_configured: !!(process.env.SOVA_COLLECTOR_KEY || process.env.CRON_SECRET),
      next: checkpoint?.complete
        ? 'Collection crawl marked complete. Run enrichment/aggregation next.'
        : 'Call with mode=run using Authorization: Bearer <SOVA_COLLECTOR_KEY or CRON_SECRET>.',
    });
  } catch (e) {
    return send(res, 503, {
      ok: false,
      version: 'v11',
      mode: 'status',
      error: String(e?.message || e),
      setup_needed: 'Connect a Vercel Blob store to this project so @vercel/blob can access private storage.',
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const mode = String(req.query?.mode || 'status').toLowerCase();
  if (mode !== 'run') return statusResponse(res);

  const apiKey = process.env.TONCENTER_API_KEY;
  if (!apiKey) return send(res, 503, { ok: false, version: 'v11', error: 'TONCENTER_API_KEY missing' });

  const auth = authState(req);
  if (!auth.configured) {
    return send(res, 503, {
      ok: false,
      version: 'v11',
      error: 'Collector auth is not configured',
      setup_needed: 'Set SOVA_COLLECTOR_KEY or CRON_SECRET before enabling persistent collection.',
    });
  }
  if (!auth.ok) return send(res, 401, { ok: false, version: 'v11', error: 'Unauthorized' });

  const limit = clampInt(req.query?.limit, 5, 50, 20);
  const concurrency = clampInt(req.query?.concurrency, 1, 6, 3);
  const retries = clampInt(req.query?.retries, 0, 2, 1);
  const startOffset = clampInt(req.query?.start_offset, 0, 100000000, 0);
  const started = Date.now();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    let checkpoint = await readCheckpoint();
    if (!checkpoint) checkpoint = initialCheckpoint(startOffset);

    if (checkpoint.complete) {
      return send(res, 200, {
        ok: true,
        version: 'v11',
        mode: 'run',
        complete: true,
        checkpoint,
        message: 'Collection crawl is already marked complete.',
      });
    }

    const offset = clampInt(checkpoint.next_offset, 0, 100000000, 0);
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
        owner_address: item?.owner_address ?? null,
        on_sale_now: item?.on_sale ?? null,
        sale_contract_address: item?.sale_contract_address ?? null,
      };
    });

    const clean = mapped.filter(x => x.username && x.clean);
    const collectedAt = new Date().toISOString();

    const checked = await mapLimit(clean, concurrency, async row => {
      const fragment = await fragmentPage(row.username, retries);
      return {
        ...row,
        source: 'fragment_individual_page',
        source_url: fragment.source_url,
        collected_at: collectedAt,
        fragment: {
          http_status: fragment.http_status,
          attempts: fragment.attempts,
          sold: fragment.sold,
          sale_price_ton: fragment.sale_price_ton,
          purchased_text: fragment.purchased_text,
          purchased_at: fragment.purchased_at,
        },
      };
    });

    const sold = checked.filter(x => x.fragment?.sold && x.fragment?.sale_price_ton !== null);
    const errors = checked.filter(x => x.error);
    const excluded = mapped.filter(x => !x.username || !x.clean);

    const paddedOffset = String(offset).padStart(9, '0');
    const batchPath = `${ROOT}/batches/offset-${paddedOffset}.jsonl`;
    const metaPath = `${ROOT}/batches/offset-${paddedOffset}.meta.json`;
    const errorPath = `${ROOT}/errors/offset-${paddedOffset}.jsonl`;

    if (checked.length) await writeJsonl(batchPath, checked);
    if (errors.length) await writeJsonl(errorPath, errors);

    const nextOffset = nftItems.length ? offset + nftItems.length : offset;
    const complete = nftItems.length === 0 || nftItems.length < limit;

    const batchMeta = {
      version: 'v11',
      run_id: runId,
      collection: COLLECTION,
      offset,
      limit,
      concurrency,
      retries,
      returned_nft_items: nftItems.length,
      usernames_found: mapped.filter(x => x.username).length,
      clean_usernames: clean.length,
      excluded_underscore_or_invalid: excluded.length,
      fragment_checked: checked.length,
      sold_with_price: sold.length,
      fragment_errors: errors.length,
      next_offset: complete ? null : nextOffset,
      complete,
      elapsed_ms: Date.now() - started,
      collected_at: collectedAt,
      batch_blob_path: checked.length ? batchPath : null,
      error_blob_path: errors.length ? errorPath : null,
    };

    await writeJson(metaPath, batchMeta);

    checkpoint = {
      ...checkpoint,
      updated_at: new Date().toISOString(),
      next_offset: complete ? null : nextOffset,
      complete,
      batches_total: Number(checkpoint.batches_total || 0) + 1,
      nft_items_total: Number(checkpoint.nft_items_total || 0) + nftItems.length,
      usernames_found_total: Number(checkpoint.usernames_found_total || 0) + mapped.filter(x => x.username).length,
      clean_usernames_total: Number(checkpoint.clean_usernames_total || 0) + clean.length,
      excluded_total: Number(checkpoint.excluded_total || 0) + excluded.length,
      fragment_checked_total: Number(checkpoint.fragment_checked_total || 0) + checked.length,
      sold_with_price_total: Number(checkpoint.sold_with_price_total || 0) + sold.length,
      fragment_errors_total: Number(checkpoint.fragment_errors_total || 0) + errors.length,
      last_batch: batchMeta,
    };

    await writeJson(CHECKPOINT_PATH, checkpoint);

    return send(res, 200, {
      ok: true,
      version: 'v11',
      mode: 'run',
      batch: batchMeta,
      checkpoint,
      sold_sample: sold.slice(0, 10),
      error_sample: errors.slice(0, 5),
      next: complete
        ? 'Enumeration complete. Aggregate/dedupe stored batch files and begin semantic enrichment.'
        : 'Run the same endpoint again; it will resume from checkpoint.next_offset automatically.',
    });
  } catch (e) {
    return send(res, 500, {
      ok: false,
      version: 'v11',
      mode: 'run',
      run_id: runId,
      error: String(e?.message || e),
      elapsed_ms: Date.now() - started,
    });
  }
}
