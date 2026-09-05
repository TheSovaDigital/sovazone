import { createHash } from 'node:crypto';

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
  return String(value || '').replace(/^@+/, '').trim();
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
    const fragmentTime = timeMatch?.[1] || null;
    const clean = /^[A-Za-z0-9]+$/.test(username);

    rows.push({
      username,
      url: `https://fragment.com/username/${encodeURIComponent(username)}`,
      status: statusText,
      fragment_price_ton: parseTon(priceText),
      fragment_price_text: priceText || null,
      fragment_time: fragmentTime,
      fragment_time_is_future: fragmentTime ? Date.parse(fragmentTime) > Date.now() + 5 * 60 * 1000 : null,
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
    const key = row.username.toLowerCase();
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
  if (!response.ok) throw new Error(`Fragment HTTP ${response.status}: ${textOnly(html).slice(0, 240)}`);
  return { html, status: response.status, finalUrl: response.url };
}

function usernameIndex(username) {
  const normalized = cleanUsername(username).toLowerCase();
  const hex = createHash('sha256').update(normalized, 'utf8').digest('hex');
  return {
    normalized,
    sha256_hex: hex,
    nft_index: BigInt(`0x${hex}`).toString(10),
  };
}

async function tonGet(apiKey, path, params = {}) {
  const url = new URL(`${TONCENTER_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json', 'X-API-Key': apiKey },
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!response.ok) {
    const message = data?.error || data?.message || text.slice(0, 300) || `HTTP ${response.status}`;
    throw new Error(`TON Center ${path} HTTP ${response.status}: ${message}`);
  }
  return data;
}

function findTokenInfo(metadata, username, index) {
  if (!metadata || typeof metadata !== 'object') return null;
  const targetName = `@${username.toLowerCase()}`;
  const targetDomain = `${username.toLowerCase()}.t.me`;
  let fallback = null;

  for (const entry of Object.values(metadata)) {
    const infos = Array.isArray(entry?.token_info) ? entry.token_info : [];
    for (const info of infos) {
      fallback ||= info;
      const name = String(info?.name || '').toLowerCase();
      const nftIndex = String(info?.nft_index || '');
      const extra = info?.extra && typeof info.extra === 'object' ? info.extra : {};
      const domain = String(extra?.domain || info?.domain || '').toLowerCase();
      if (nftIndex === index || name === targetName || domain === targetDomain) return info;
    }
  }
  return fallback;
}

function normalizePotentialTon(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;

  // TON Center action amounts are usually nanotons when represented as large integers.
  if (/^\d+$/.test(raw) && raw.length >= 8) return n / 1e9;
  return n;
}

function collectAmountFields(value, path = '', out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectAmountFields(item, `${path}[${i}]`, out));
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    const lower = key.toLowerCase();
    const amountLike = /(^|_)(amount|value|price|full_price|sale_price|bid|bid_amount|ton_amount)(_|$)/i.test(lower);
    if (amountLike && (typeof child === 'string' || typeof child === 'number')) {
      const ton = normalizePotentialTon(child);
      if (ton !== null && ton > 0 && ton < 1e9) {
        out.push({ field: childPath, raw: String(child), ton });
      }
    }
    if (child && typeof child === 'object') collectAmountFields(child, childPath, out);
  }
  return out;
}

function summarizeAction(action) {
  const amounts = collectAmountFields(action?.details || {});
  return {
    type: action?.type || null,
    success: action?.success ?? null,
    start_utime: action?.start_utime ?? null,
    end_utime: action?.end_utime ?? null,
    action_id: action?.action_id || null,
    amount_candidates: amounts.slice(0, 12),
    details: action?.details ?? null,
  };
}

function candidateFromActions(actions, fragmentPrice) {
  const summaries = actions.map(summarizeAction);
  const actionTypes = [...new Set(summaries.map((x) => x.type).filter(Boolean))];
  const amounts = summaries.flatMap((x) => x.amount_candidates || []);
  const plausible = amounts
    .filter((x) => x.ton >= 0.01)
    .sort((a, b) => b.ton - a.ton);

  let best = null;
  if (Number.isFinite(fragmentPrice) && fragmentPrice > 0) {
    best = plausible
      .map((x) => ({ ...x, rel_diff: Math.abs(x.ton - fragmentPrice) / fragmentPrice }))
      .sort((a, b) => a.rel_diff - b.rel_diff)[0] || null;
  } else {
    best = plausible[0] || null;
  }

  const priceMatch = best && Number.isFinite(fragmentPrice) && fragmentPrice > 0
    ? best.rel_diff <= 0.03
    : false;

  return {
    action_types: actionTypes,
    has_nft_action: actionTypes.some((t) => /nft/i.test(t)),
    has_ton_action: actionTypes.some((t) => /ton|transfer|purchase|sale|auction/i.test(t)),
    best_amount_candidate_ton: best?.ton ?? null,
    best_amount_field: best?.field ?? null,
    fragment_price_match_3pct: priceMatch,
    all_amount_candidates: plausible.slice(0, 20),
    actions: summaries,
  };
}

async function inspectTrace(apiKey, transfer, fragmentPrice) {
  if (!transfer?.trace_id) return { ok: false, error: 'transfer has no trace_id' };
  try {
    const data = await tonGet(apiKey, '/actions', {
      trace_id: transfer.trace_id,
      include_accounts: true,
      include_transactions: false,
      limit: 100,
      sort: 'asc',
    });
    const actions = Array.isArray(data?.actions) ? data.actions : [];
    return {
      ok: true,
      trace_id: transfer.trace_id,
      action_count: actions.length,
      ...candidateFromActions(actions, fragmentPrice),
    };
  } catch (error) {
    return { ok: false, trace_id: transfer.trace_id, error: String(error?.message || error) };
  }
}

function transferSummary(t) {
  return {
    transaction_now: t?.transaction_now ?? null,
    transaction_iso: t?.transaction_now ? new Date(t.transaction_now * 1000).toISOString() : null,
    transaction_hash: t?.transaction_hash || null,
    transaction_lt: t?.transaction_lt || null,
    trace_id: t?.trace_id || null,
    nft_address: t?.nft_address || null,
    old_owner: t?.old_owner || null,
    new_owner: t?.new_owner || null,
    forward_amount: t?.forward_amount || null,
    transaction_aborted: t?.transaction_aborted ?? null,
  };
}

async function verifyUsername(apiKey, row, transferLimit, traceLimit) {
  const idx = usernameIndex(row.username);
  const itemData = await tonGet(apiKey, '/nft/items', {
    collection_address: COLLECTION,
    index: idx.nft_index,
    limit: 1,
  });

  const item = Array.isArray(itemData?.nft_items) ? itemData.nft_items[0] : null;
  const tokenInfo = findTokenInfo(itemData?.metadata, idx.normalized, idx.nft_index);

  if (!item?.address) {
    return {
      username: row.username,
      fragment: row,
      index: idx,
      nft_found: false,
      verified_sale: false,
      reason: 'NFT item was not found for SHA-256(username) index in Telegram Usernames collection.',
    };
  }

  const transferData = await tonGet(apiKey, '/nft/transfers', {
    item_address: item.address,
    limit: transferLimit,
    offset: 0,
    sort: 'desc',
  });
  const transfers = (Array.isArray(transferData?.nft_transfers) ? transferData.nft_transfers : [])
    .filter((t) => !t?.transaction_aborted);

  // We inspect recent ownership changes. Fragment rows are recent-first; this is enough for v3 validation.
  const toInspect = transfers.slice(0, traceLimit);
  const traceResults = [];
  for (const transfer of toInspect) {
    traceResults.push({
      transfer: transferSummary(transfer),
      trace: await inspectTrace(apiKey, transfer, row.fragment_price_ton),
    });
  }

  const matched = traceResults.find((x) => x.trace?.fragment_price_match_3pct);
  const best = matched || traceResults.find((x) => x.trace?.best_amount_candidate_ton != null) || traceResults[0] || null;

  return {
    username: row.username,
    fragment: row,
    index: idx,
    nft_found: true,
    nft: {
      address: item.address,
      index: item.index,
      collection_address: item.collection_address,
      owner_address: item.owner_address,
      real_owner: item.real_owner,
      on_sale: item.on_sale,
      sale_contract_address: item.sale_contract_address || null,
      auction_contract_address: item.auction_contract_address || null,
      metadata_name: tokenInfo?.name || null,
      metadata_description: tokenInfo?.description || null,
    },
    transfers_found: transfers.length,
    traces_inspected: traceResults.length,
    verified_sale: Boolean(matched),
    verification_rule: 'Fragment price must match an amount-like field in the TON trace within 3%; NFT is resolved from SHA-256(lowercase username) index.',
    blockchain_sale: matched ? {
      price_ton: matched.trace.best_amount_candidate_ton,
      date_unix: matched.transfer.transaction_now,
      date_iso: matched.transfer.transaction_iso,
      transaction_hash: matched.transfer.transaction_hash,
      trace_id: matched.transfer.trace_id,
      old_owner: matched.transfer.old_owner,
      new_owner: matched.transfer.new_owner,
      amount_field: matched.trace.best_amount_field,
    } : null,
    best_trace_candidate: best,
    trace_results: traceResults,
  };
}

function parseRequestedUsernames(req) {
  const raw = req.query?.username ?? req.query?.usernames;
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(',');
  const seen = new Set();
  return parts
    .flatMap((x) => String(x).split(','))
    .map(cleanUsername)
    .filter((x) => /^[A-Za-z0-9]+$/.test(x))
    .filter((x) => {
      const k = x.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TONCENTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'TONCENTER_API_KEY is not configured' });
  }

  const limit = clampInt(req.query?.limit, 1, 5, 3);
  const transferLimit = clampInt(req.query?.transfers, 3, 30, 12);
  const traceLimit = clampInt(req.query?.traces, 1, 8, 4);
  const requested = parseRequestedUsernames(req);

  try {
    const fragmentResponse = await fetchFragment();
    const parsed = parseSoldRows(fragmentResponse.html);
    const clean = parsed.filter((x) => x.is_clean);

    let selected;
    if (requested.length) {
      const map = new Map(clean.map((x) => [x.username.toLowerCase(), x]));
      selected = requested.map((username) => map.get(username.toLowerCase()) || {
        username,
        url: `https://fragment.com/username/${encodeURIComponent(username)}`,
        status: 'Not found on current Fragment Sold page',
        fragment_price_ton: null,
        fragment_price_text: null,
        fragment_time: null,
        fragment_time_is_future: null,
        length: username.length,
        is_clean: true,
        has_underscore: false,
        letters_only: /^[A-Za-z]+$/.test(username),
        digits_only: /^\d+$/.test(username),
        alphanumeric: true,
      });
    } else {
      selected = clean.slice(0, limit);
    }

    const results = [];
    for (const row of selected) {
      try {
        results.push(await verifyUsername(apiKey, row, transferLimit, traceLimit));
      } catch (error) {
        results.push({
          username: row.username,
          fragment: row,
          ok: false,
          verified_sale: false,
          error: String(error?.message || error),
        });
      }
    }

    const verified = results.filter((x) => x.verified_sale).length;

    return res.status(200).json({
      ok: true,
      version: 'v3',
      purpose: 'Cross-check Fragment Sold rows against Telegram Usernames NFT history in TON Center.',
      fragment: {
        request_url: FRAGMENT_SOLD_URL,
        final_url: fragmentResponse.finalUrl,
        http_status: fragmentResponse.status,
        rows_parsed: parsed.length,
        clean_rows: clean.length,
      },
      ton: {
        base: TONCENTER_BASE,
        collection: COLLECTION,
        username_to_index: 'decimal(SHA-256(lowercase username))',
      },
      settings: {
        usernames_requested: requested.length ? requested : null,
        selected: selected.length,
        transfer_history_limit: transferLimit,
        traces_per_username: traceLimit,
      },
      counts: {
        checked: results.length,
        blockchain_price_matches: verified,
        not_matched_yet: results.length - verified,
      },
      results,
      next: 'Send this JSON/screenshot back. If action details expose Fragment payment consistently, v4 will turn the confirmed matches into a clean mass-collection pipeline.',
    });
  } catch (error) {
    console.error('telegram-fragment-ton-verify-v3 error', error);
    return res.status(502).json({
      ok: false,
      version: 'v3',
      error: String(error?.message || error),
      next: 'Open the endpoint again with ?limit=1&traces=2 and send the JSON response.',
    });
  }
}
