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
  return decodeHtml(String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

function classText(row, classNeedle) {
  const safe = classNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<(?:div|span|td)[^>]*class=["'][^"']*${safe}[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:div|span|td)>`, 'i');
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

function cleanUsername(v) { return String(v || '').replace(/^@+/, '').trim(); }

function usernameFromRow(row) {
  for (const re of [
    /(?:href|data-href)=["']\/username\/([^"'?#/]+)["']/i,
    /(?:href|data-href)=["']https?:\/\/fragment\.com\/username\/([^"'?#/]+)["']/i,
  ]) {
    const m = row.match(re);
    if (m?.[1]) {
      try { return cleanUsername(decodeURIComponent(m[1])); }
      catch { return cleanUsername(m[1]); }
    }
  }
  return '';
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
    const timeMatch = row.match(/<time\b[^>]*datetime=["']([^"']+)["']/i);
    rows.push({
      username,
      url: `https://fragment.com/username/${encodeURIComponent(username)}`,
      fragment_price_ton: parseTon(priceText),
      fragment_price_text: priceText || null,
      fragment_time_raw: timeMatch?.[1] || null,
      is_clean: /^[A-Za-z0-9]+$/.test(username),
    });
  }
  const seen = new Set();
  return rows.filter(r => {
    const k = r.username.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

async function fetchFragment() {
  const r = await fetch(FRAGMENT_SOLD_URL, {
    redirect: 'follow',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': 'https://fragment.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    }
  });
  const html = await r.text();
  if (!r.ok) throw new Error(`Fragment HTTP ${r.status}: ${textOnly(html).slice(0, 200)}`);
  return { html, status: r.status, finalUrl: r.url };
}

function usernameIndex(username) {
  const normalized = cleanUsername(username).toLowerCase();
  const hex = createHash('sha256').update(normalized, 'utf8').digest('hex');
  return { normalized, sha256_hex: hex, nft_index: BigInt(`0x${hex}`).toString(10) };
}

async function tonGet(apiKey, path, params = {}) {
  const url = new URL(`${TONCENTER_BASE}${path}`);
  for (const [k,v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, String(x)));
    else url.searchParams.set(k, String(v));
  }
  const r = await fetch(url, { headers: { Accept:'application/json', 'X-API-Key': apiKey } });
  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch {}
  if (!r.ok) throw new Error(`TON Center ${path} HTTP ${r.status}: ${data?.error || data?.message || text.slice(0,240)}`);
  return data;
}

function nanotonsToTon(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  try {
    const n = BigInt(s);
    if (n <= 0n) return null;
    // TON blockchain message values are nanotons.
    return Number(n) / 1e9;
  } catch { return null; }
}

function collectMessageValues(value, path = '', out = [], seen = new Set()) {
  if (!value || typeof value !== 'object') return out;
  if (seen.has(value)) return out;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((x,i) => collectMessageValues(x, `${path}[${i}]`, out, seen));
    return out;
  }

  const hasMessageShape = ('source' in value || 'destination' in value) && ('value' in value);
  if (hasMessageShape) {
    const ton = nanotonsToTon(value.value);
    if (ton !== null) {
      out.push({
        path,
        ton,
        raw: String(value.value),
        source: value.source || null,
        destination: value.destination || null,
        hash: value.hash || null,
        opcode: value.opcode ?? null,
        created_at: value.created_at ?? null,
      });
    }
  }

  for (const [k,v] of Object.entries(value)) {
    if (v && typeof v === 'object') collectMessageValues(v, path ? `${path}.${k}` : k, out, seen);
  }
  return out;
}

function dedupePayments(arr) {
  const map = new Map();
  for (const p of arr) {
    const key = `${p.hash || ''}|${p.source || ''}|${p.destination || ''}|${p.raw}`;
    if (!map.has(key)) map.set(key, p);
  }
  return [...map.values()];
}

function choosePriceCandidate(payments, fragmentPrice) {
  const sensible = payments
    .filter(p => p.ton >= 0.01 && p.ton < 100000000)
    .sort((a,b) => b.ton - a.ton);

  if (!Number.isFinite(fragmentPrice) || fragmentPrice <= 0) {
    return { matched:false, best:sensible[0] || null, rel_diff:null };
  }

  const ranked = sensible
    .map(p => ({...p, rel_diff: Math.abs(p.ton-fragmentPrice)/fragmentPrice}))
    .sort((a,b) => a.rel_diff-b.rel_diff);
  const best = ranked[0] || null;
  return { matched:Boolean(best && best.rel_diff <= 0.03), best, rel_diff:best?.rel_diff ?? null };
}

function transferSummary(t) {
  return {
    transaction_now: t?.transaction_now ?? null,
    transaction_iso: t?.transaction_now ? new Date(t.transaction_now*1000).toISOString() : null,
    transaction_hash: t?.transaction_hash || null,
    trace_id: t?.trace_id || null,
    nft_address: t?.nft_address || null,
    old_owner: t?.old_owner || null,
    new_owner: t?.new_owner || null,
    forward_amount: t?.forward_amount || null,
    aborted: t?.transaction_aborted ?? null,
  };
}

async function inspectRawTrace(apiKey, transfer, fragmentPrice) {
  if (!transfer?.trace_id) return { ok:false, error:'No trace_id' };
  const data = await tonGet(apiKey, '/traces', {
    trace_id: transfer.trace_id,
    include_actions: true,
    limit: 1,
  });
  const traces = Array.isArray(data?.traces) ? data.traces : [];
  const trace = traces[0] || null;
  if (!trace) return { ok:false, trace_id:transfer.trace_id, error:'Trace not found' };

  const payments = dedupePayments(collectMessageValues(trace));
  const candidate = choosePriceCandidate(payments, fragmentPrice);
  const large = payments.filter(p => p.ton >= 2).sort((a,b)=>b.ton-a.ton).slice(0,25);

  return {
    ok:true,
    trace_id:transfer.trace_id,
    trace_start_utime:trace.start_utime ?? null,
    trace_end_utime:trace.end_utime ?? null,
    total_message_values:payments.length,
    values_ge_2_ton:large,
    best_price_candidate:candidate.best,
    fragment_price_match_3pct:candidate.matched,
  };
}

async function verify(apiKey, row, transferLimit, traceLimit) {
  const idx = usernameIndex(row.username);
  const itemData = await tonGet(apiKey, '/nft/items', {
    collection_address: COLLECTION,
    index: idx.nft_index,
    limit: 1,
  });
  const item = Array.isArray(itemData?.nft_items) ? itemData.nft_items[0] : null;
  if (!item?.address) return { username:row.username, fragment:row, nft_found:false, verified_sale:false };

  const transferData = await tonGet(apiKey, '/nft/transfers', {
    item_address:item.address,
    limit:transferLimit,
    offset:0,
    sort:'desc',
  });
  const transfers = (Array.isArray(transferData?.nft_transfers) ? transferData.nft_transfers : [])
    .filter(t => !t?.transaction_aborted)
    .slice(0, traceLimit);

  const traces = [];
  for (const t of transfers) {
    try {
      traces.push({ transfer:transferSummary(t), raw_trace:await inspectRawTrace(apiKey,t,row.fragment_price_ton) });
    } catch (e) {
      traces.push({ transfer:transferSummary(t), raw_trace:{ok:false,error:String(e?.message || e)} });
    }
  }

  const match = traces.find(x => x.raw_trace?.fragment_price_match_3pct);
  return {
    username:row.username,
    fragment:row,
    nft_found:true,
    nft:{
      address:item.address,
      index:item.index,
      owner_address:item.owner_address,
      real_owner:item.real_owner,
      on_sale:item.on_sale,
      sale_contract_address:item.sale_contract_address || null,
      auction_contract_address:item.auction_contract_address || null,
    },
    transfers_inspected:traces.length,
    verified_sale:Boolean(match),
    blockchain_sale:match ? {
      price_ton:match.raw_trace.best_price_candidate?.ton ?? null,
      date_iso:match.transfer.transaction_iso,
      transaction_hash:match.transfer.transaction_hash,
      trace_id:match.transfer.trace_id,
      old_owner:match.transfer.old_owner,
      new_owner:match.transfer.new_owner,
      payment_source:match.raw_trace.best_price_candidate?.source ?? null,
      payment_destination:match.raw_trace.best_price_candidate?.destination ?? null,
    } : null,
    trace_results:traces,
  };
}

function parseRequested(req) {
  const raw=req.query?.username ?? req.query?.usernames;
  if (!raw) return [];
  const seen=new Set();
  return String(Array.isArray(raw)?raw.join(','):raw).split(',')
    .map(cleanUsername)
    .filter(x=>/^[A-Za-z0-9]+$/.test(x))
    .filter(x=>{const k=x.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;})
    .slice(0,5);
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const apiKey=process.env.TONCENTER_API_KEY;
  if (!apiKey) return res.status(500).json({ok:false,error:'TONCENTER_API_KEY is not configured'});

  const limit=clampInt(req.query?.limit,1,5,3);
  const transferLimit=clampInt(req.query?.transfers,3,30,12);
  const traceLimit=clampInt(req.query?.traces,1,8,4);
  const requested=parseRequested(req);

  try {
    const fr=await fetchFragment();
    const parsed=parseSoldRows(fr.html);
    const clean=parsed.filter(x=>x.is_clean);
    let selected;
    if (requested.length) {
      const map=new Map(clean.map(x=>[x.username.toLowerCase(),x]));
      selected=requested.map(username=>map.get(username.toLowerCase()) || {
        username,
        url:`https://fragment.com/username/${encodeURIComponent(username)}`,
        fragment_price_ton:null,
        fragment_price_text:null,
        fragment_time_raw:null,
        is_clean:true,
      });
    } else selected=clean.slice(0,limit);

    const results=[];
    for (const row of selected) {
      try { results.push(await verify(apiKey,row,transferLimit,traceLimit)); }
      catch(e) { results.push({username:row.username,fragment:row,verified_sale:false,error:String(e?.message||e)}); }
    }
    const verified=results.filter(x=>x.verified_sale).length;
    return res.status(200).json({
      ok:true,
      version:'v4',
      purpose:'Inspect RAW TON trace message values around Telegram Username NFT transfers. v3 only saw decoded nft_transfer forward_amount=1 TON.',
      fragment:{http_status:fr.status,rows_parsed:parsed.length,clean_rows:clean.length},
      ton:{base:TONCENTER_BASE,collection:COLLECTION},
      settings:{selected:selected.length,transfer_history_limit:transferLimit,traces_per_username:traceLimit},
      counts:{checked:results.length,raw_trace_price_matches:verified,not_matched:results.length-verified},
      results,
      next:'Send the JSON/screenshot. If the Fragment price appears in RAW message values, the next version will mass-collect verified sales; if not, we will switch to resolving the Fragment auction/sale contract instead of NFT-transfer traces.'
    });
  } catch(e) {
    return res.status(502).json({ok:false,version:'v4',error:String(e?.message||e),next:'Retry with ?limit=1&traces=2 and send the JSON.'});
  }
}
