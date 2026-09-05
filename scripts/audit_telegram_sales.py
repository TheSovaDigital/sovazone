#!/usr/bin/env python3
import csv
import json
import math
import os
import statistics
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone

import requests
from wordfreq import zipf_frequency
from transliterate import translit

API_URL = os.environ.get('AUDIT_API_URL', '').rstrip('/')
COLLECTOR_KEY = os.environ.get('SOVA_COLLECTOR_KEY', '')
VERCEL_BYPASS = os.environ.get('VERCEL_AUTOMATION_BYPASS_SECRET', '')
START_OFFSET = int(os.environ.get('START_OFFSET', '0'))
END_OFFSET = int(os.environ.get('END_OFFSET', '25350'))
LIMIT = int(os.environ.get('LIMIT', '30'))
CONCURRENCY = int(os.environ.get('CONCURRENCY', '2'))
OUT_DIR = os.environ.get('OUT_DIR', 'audit-output')

if not API_URL or not COLLECTOR_KEY or not VERCEL_BYPASS:
    print('Missing AUDIT_API_URL / SOVA_COLLECTOR_KEY / VERCEL_AUTOMATION_BYPASS_SECRET', file=sys.stderr)
    sys.exit(2)

os.makedirs(OUT_DIR, exist_ok=True)

session = requests.Session()
session.headers.update({
    'Accept': 'application/json',
    'Authorization': f'Bearer {COLLECTOR_KEY}',
    'x-vercel-protection-bypass': VERCEL_BYPASS,
})


def percentile(values, p):
    if not values:
        return None
    vals = sorted(values)
    if len(vals) == 1:
        return vals[0]
    k = (len(vals) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return vals[int(k)]
    return vals[f] * (c - k) + vals[c] * (k - f)


def stats(values):
    vals = [float(v) for v in values if v is not None]
    if not vals:
        return {'count': 0}
    return {
        'count': len(vals),
        'min': min(vals),
        'p10': round(percentile(vals, 0.10), 3),
        'p25': round(percentile(vals, 0.25), 3),
        'median': round(statistics.median(vals), 3),
        'mean': round(statistics.fmean(vals), 3),
        'p75': round(percentile(vals, 0.75), 3),
        'p90': round(percentile(vals, 0.90), 3),
        'p95': round(percentile(vals, 0.95), 3),
        'max': max(vals),
    }


def price_bucket(v):
    x = float(v)
    if x < 10: return '<10'
    if x < 25: return '10-24.99'
    if x < 50: return '25-49.99'
    if x < 100: return '50-99.99'
    if x < 250: return '100-249.99'
    if x < 500: return '250-499.99'
    if x < 1000: return '500-999.99'
    if x < 5000: return '1000-4999.99'
    return '5000+'


def pattern_type(u):
    s = u.lower()
    if s.isdigit(): return 'numeric_only'
    if s.isalpha():
        if len(set(s)) == 1: return 'same_letter'
        if len(s) >= 4 and len(set(s)) <= max(2, len(s)//2): return 'letter_repetition'
        return 'letters_only'
    if s.isalnum(): return 'letters_and_digits'
    return 'other'


def semantic_proxy(u):
    s = u.lower()
    if not s.isalpha() or len(s) < 3:
        return 'not_word_candidate'
    en = zipf_frequency(s, 'en')
    ru = 0.0
    ru_form = ''
    try:
        ru_form = translit(s, 'ru', reversed=True)
        if any('а' <= ch <= 'я' or ch == 'ё' for ch in ru_form.lower()):
            ru = zipf_frequency(ru_form.lower(), 'ru')
    except Exception:
        pass
    if en >= 4.0 and en >= ru + 0.35:
        return 'strong_en_word_proxy'
    if ru >= 4.0 and ru >= en + 0.35:
        return 'strong_ru_translit_proxy'
    if max(en, ru) >= 3.0:
        return 'possible_word_proxy'
    return 'low_word_likelihood'


def fetch_batch(offset):
    params = {
        'offset': offset,
        'limit': LIMIT,
        'concurrency': CONCURRENCY,
        'retries': 3,
    }
    last = None
    for attempt in range(1, 6):
        try:
            r = session.get(API_URL, params=params, timeout=210)
            if r.status_code == 200:
                data = r.json()
                if data.get('ok'):
                    return data
                last = f"ok=false: {data}"
            else:
                last = f"HTTP {r.status_code}: {r.text[:500]}"
        except Exception as e:
            last = repr(e)
        wait = min(30, 3 * attempt)
        print(f'offset={offset}: retry {attempt}/5 after {last}; sleeping {wait}s', flush=True)
        time.sleep(wait)
    raise RuntimeError(f'offset={offset}: failed after retries: {last}')


sales = []
scan = {
    'returned_nft_items': 0,
    'usernames_found': 0,
    'clean_usernames': 0,
    'excluded': 0,
    'fragment_errors': 0,
    'batches': 0,
}
error_rows = []

for offset in range(START_OFFSET, END_OFFSET, LIMIT):
    data = fetch_batch(offset)
    scan['batches'] += 1
    for k in ('returned_nft_items', 'usernames_found', 'clean_usernames', 'excluded'):
        scan[k] += int(data.get(k, 0) or 0)
    errs = data.get('errors') or []
    scan['fragment_errors'] += len(errs)
    error_rows.extend({'offset': offset, **e} for e in errs)
    sales.extend(data.get('sales') or [])
    if scan['batches'] % 25 == 0:
        print(f"Progress: batches={scan['batches']} offset={offset + LIMIT} sales={len(sales)} errors={scan['fragment_errors']}", flush=True)
    time.sleep(0.7)

# Deduplicate defensively by nft address, then username/date/price fallback.
seen = set()
deduped = []
for row in sales:
    key = row.get('nft_address') or (row.get('username_lower'), row.get('purchased_at'), row.get('sale_price_ton'))
    if key in seen:
        continue
    seen.add(key)
    deduped.append(row)
sales = deduped

length_counts = Counter()
pattern_counts = Counter()
semantic_counts = Counter()
price_buckets = Counter()
year_counts = Counter()
price_by_length = defaultdict(list)
price_by_pattern = defaultdict(list)
price_by_year = defaultdict(list)

for row in sales:
    u = row.get('username') or ''
    price = float(row.get('sale_price_ton'))
    length = int(row.get('length') or len(u))
    pt = pattern_type(u)
    sp = semantic_proxy(u)
    length_counts[length] += 1
    pattern_counts[pt] += 1
    semantic_counts[sp] += 1
    price_buckets[price_bucket(price)] += 1
    price_by_length[length].append(price)
    price_by_pattern[pt].append(price)
    dt = row.get('purchased_at')
    if dt:
        try:
            year = datetime.fromisoformat(dt.replace('Z', '+00:00')).year
            year_counts[year] += 1
            price_by_year[year].append(price)
        except Exception:
            year_counts['invalid_date'] += 1
    else:
        year_counts['missing_date'] += 1

prices = [float(r['sale_price_ton']) for r in sales]
alpha_only = sum(1 for r in sales if (r.get('username') or '').isalpha())
with_digits = sum(1 for r in sales if any(ch.isdigit() for ch in (r.get('username') or '')))
numeric_only = sum(1 for r in sales if (r.get('username') or '').isdigit())

summary = {
    'generated_at': datetime.now(timezone.utc).isoformat(),
    'source': {
        'collection_scan_offsets': [START_OFFSET, END_OFFSET],
        'batch_limit': LIMIT,
        'note': 'Blob-free re-scan of the same TON collection + Fragment sale pages; underscore/invalid usernames excluded exactly as collector v13.',
    },
    'scan': scan,
    'sales': {
        'count': len(sales),
        'price_ton': stats(prices),
        'alpha_only': alpha_only,
        'with_digits': with_digits,
        'numeric_only': numeric_only,
        'with_date': sum(1 for r in sales if r.get('purchased_at')),
        'without_date': sum(1 for r in sales if not r.get('purchased_at')),
    },
    'length_counts': dict(sorted(length_counts.items())),
    'price_by_length': {str(k): stats(v) for k, v in sorted(price_by_length.items())},
    'pattern_counts': dict(pattern_counts),
    'price_by_pattern': {k: stats(v) for k, v in price_by_pattern.items()},
    'semantic_proxy_counts': dict(semantic_counts),
    'price_buckets': dict(price_buckets),
    'year_counts': {str(k): v for k, v in sorted(year_counts.items(), key=lambda kv: str(kv[0]))},
    'price_by_year': {str(k): stats(v) for k, v in sorted(price_by_year.items())},
    'fragment_errors': error_rows,
}

# Top sales for manual inspection.
top_sales = sorted(sales, key=lambda r: float(r.get('sale_price_ton') or 0), reverse=True)[:300]
summary['top_sales_sample'] = top_sales[:50]

with open(os.path.join(OUT_DIR, 'audit-summary.json'), 'w', encoding='utf-8') as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

with open(os.path.join(OUT_DIR, 'sales.jsonl'), 'w', encoding='utf-8') as f:
    for row in sales:
        f.write(json.dumps(row, ensure_ascii=False) + '\n')

with open(os.path.join(OUT_DIR, 'top-sales.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['username', 'length', 'sale_price_ton', 'purchased_at', 'pattern', 'semantic_proxy'])
    for row in top_sales:
        u = row.get('username') or ''
        w.writerow([u, row.get('length'), row.get('sale_price_ton'), row.get('purchased_at'), pattern_type(u), semantic_proxy(u)])

report = []
report.append('# SovaUsername dataset audit v1')
report.append('')
report.append(f"Generated: {summary['generated_at']}")
report.append(f"Offsets rescanned: {START_OFFSET}–{END_OFFSET}")
report.append('')
report.append('## Core')
report.append(f"- NFT scanned: {scan['returned_nft_items']:,}")
report.append(f"- Clean usernames checked: {scan['clean_usernames']:,}")
report.append(f"- Sales with price: {len(sales):,}")
report.append(f"- Fragment errors after retries: {scan['fragment_errors']:,}")
report.append(f"- Sales with exact date: {summary['sales']['with_date']:,}")
report.append(f"- Letters only: {alpha_only:,}")
report.append(f"- Contains digits: {with_digits:,}")
report.append('')
report.append('## Price TON')
ps = summary['sales']['price_ton']
for k in ('min','p10','p25','median','mean','p75','p90','p95','max'):
    report.append(f"- {k}: {ps.get(k)}")
report.append('')
report.append('## Length coverage')
for length, count in sorted(length_counts.items()):
    st = summary['price_by_length'][str(length)]
    report.append(f"- {length} chars: {count:,} sales; median {st.get('median')} TON; p90 {st.get('p90')} TON")
report.append('')
report.append('## Price buckets')
for bucket in ('<10','10-24.99','25-49.99','50-99.99','100-249.99','250-499.99','500-999.99','1000-4999.99','5000+'):
    report.append(f"- {bucket}: {price_buckets.get(bucket, 0):,}")
report.append('')
report.append('## Structural patterns')
for k, v in pattern_counts.most_common():
    report.append(f"- {k}: {v:,}")
report.append('')
report.append('## Word-likeness proxy (heuristic only)')
report.append('This is not the final semantic classifier. It uses word-frequency heuristics for English and reverse-transliterated Russian.')
for k, v in semantic_counts.most_common():
    report.append(f"- {k}: {v:,}")
report.append('')
report.append('## Years')
for year, count in sorted(year_counts.items(), key=lambda kv: str(kv[0])):
    report.append(f"- {year}: {count:,}")

with open(os.path.join(OUT_DIR, 'audit-report.md'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(report) + '\n')

print(json.dumps({
    'ok': True,
    'sales': len(sales),
    'scanned': scan['returned_nft_items'],
    'errors': scan['fragment_errors'],
    'output': OUT_DIR,
}, ensure_ascii=False))
