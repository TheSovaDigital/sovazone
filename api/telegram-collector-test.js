const COLLECTION = 'EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi';
const BASE = 'https://toncenter.com/api/v3';

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function tonGet(path, params, apiKey) {
  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-API-Key': apiKey,
    },
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 2000) }; }

  if (!response.ok) {
    const message = data?.error || data?.message || `TON Center HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return data;
}

function tokenInfoFor(metadata, address) {
  const row = metadata?.[address];
  if (!row || !Array.isArray(row.token_info)) return null;
  return row.token_info[0] || null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TONCENTER_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      error: 'TONCENTER_API_KEY is not configured',
    });
  }

  const itemLimit = clampInt(req.query?.items, 1, 50, 10);
  const transferLimit = clampInt(req.query?.transfers, 1, 100, 20);
  const offset = clampInt(req.query?.offset, 0, 1000000000, 0);

  try {
    const [collectionData, itemsData, transfersData] = await Promise.all([
      tonGet('/nft/collections', {
        collection_address: COLLECTION,
        limit: 1,
      }, apiKey),
      tonGet('/nft/items', {
        collection_address: COLLECTION,
        limit: itemLimit,
        offset,
      }, apiKey),
      tonGet('/nft/transfers', {
        collection_address: COLLECTION,
        limit: transferLimit,
        offset,
        sort: 'desc',
      }, apiKey),
    ]);

    const items = Array.isArray(itemsData?.nft_items) ? itemsData.nft_items : [];
    const transfers = Array.isArray(transfersData?.nft_transfers) ? transfersData.nft_transfers : [];
    const collection = Array.isArray(collectionData?.nft_collections)
      ? collectionData.nft_collections[0] || null
      : null;

    return res.status(200).json({
      ok: true,
      source: 'TON Center API v3',
      collection: COLLECTION,
      collectionInfo: collection ? {
        address: collection.address,
        next_item_index: collection.next_item_index,
        owner_address: collection.owner_address,
        collection_content: collection.collection_content,
      } : null,
      request: { itemLimit, transferLimit, offset },
      counts: {
        itemsReturned: items.length,
        transfersReturned: transfers.length,
      },
      sampleItems: items.map((item) => ({
        address: item.address,
        index: item.index,
        owner_address: item.owner_address,
        real_owner: item.real_owner,
        on_sale: item.on_sale,
        sale_contract_address: item.sale_contract_address,
        auction_contract_address: item.auction_contract_address,
        content: item.content,
        token_info: tokenInfoFor(itemsData?.metadata, item.address),
      })),
      sampleTransfers: transfers.map((t) => ({
        nft_address: t.nft_address,
        old_owner: t.old_owner,
        new_owner: t.new_owner,
        transaction_hash: t.transaction_hash,
        transaction_lt: t.transaction_lt,
        transaction_now: t.transaction_now,
        trace_id: t.trace_id,
        transaction_aborted: t.transaction_aborted,
        forward_amount: t.forward_amount,
      })),
      note: 'Diagnostic endpoint only. It does not classify transfers as sales yet.',
    });
  } catch (error) {
    console.error('telegram-collector-test error', error);
    return res.status(502).json({
      ok: false,
      error: 'TON Center request failed',
      details: String(error?.message || error),
    });
  }
}
