#!/usr/bin/env python3
import argparse, csv, json, math, os, statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone


def quantile(vals, q):
    vals = sorted(float(x) for x in vals)
    if not vals:
        return None
    if len(vals) == 1:
        return vals[0]
    pos = (len(vals)-1)*q
    lo, hi = math.floor(pos), math.ceil(pos)
    if lo == hi:
        return vals[lo]
    return vals[lo]*(hi-pos)+vals[hi]*(pos-lo)


def pattern_type(username):
    s = username.lower()
    if s.isdigit():
        if len(set(s)) == 1: return 'numeric_repeat'
        if s == s[::-1]: return 'numeric_palindrome'
        return 'numeric'
    if s.isalpha():
        if len(set(s)) == 1: return 'letter_repeat_all'
        if len(s) >= 4 and len(set(s)) <= max(2, len(s)//2): return 'letter_repeat'
        return 'letters'
    if s.isalnum(): return 'alnum'
    return 'other'


def year_factor(year):
    return {2022:0.55, 2023:0.65, 2024:0.80, 2025:0.95, 2026:1.0}.get(year, 0.70)


def weighted_quantile(rows, field, weight_field, q):
    pairs = sorted((float(r[field]), float(r[weight_field])) for r in rows if float(r[weight_field]) > 0)
    if not pairs: return None
    total = sum(w for _,w in pairs)
    target = q * total
    acc = 0.0
    for value, weight in pairs:
        acc += weight
        if acc >= target: return value
    return pairs[-1][0]


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('sales_jsonl')
    ap.add_argument('--out-dir', default='telegram-market-v1')
    args=ap.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)

    sales=[]
    with open(args.sales_jsonl, encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            r=json.loads(line)
            r['sale_price_ton']=float(r['sale_price_ton'])
            r['length']=int(r.get('length') or len(r.get('username') or ''))
            r['pattern']=pattern_type(r.get('username') or '')
            r['price_norm']=round(r['sale_price_ton'], 6)
            try: r['year']=int((r.get('purchased_at') or '')[:4])
            except: r['year']=None
            sales.append(r)

    exact_counts=Counter(r['price_norm'] for r in sales)
    cohorts=defaultdict(list)
    lengths=defaultdict(list)
    for r in sales:
        cohorts[(r['length'],r['pattern'])].append(r['sale_price_ton'])
        lengths[r['length']].append(r['sale_price_ton'])

    cohort_stats={}
    for k,vals in cohorts.items():
        cohort_stats[k]={'count':len(vals),'median':quantile(vals,.5),'p90':quantile(vals,.9),'p95':quantile(vals,.95),'p99':quantile(vals,.99)}
    length_stats={k:{'count':len(v),'median':quantile(v,.5),'p90':quantile(v,.9),'p95':quantile(v,.95),'p99':quantile(v,.99)} for k,v in lengths.items()}

    classes=Counter()
    queue=[]
    cleaned=[]
    for r in sales:
        p=r['sale_price_ton']; l=r['length']; pattern=r['pattern']; count=exact_counts[r['price_norm']]
        cs=cohort_stats[(l,pattern)] if cohort_stats[(l,pattern)]['count'] >= 30 else length_stats[l]
        p95=float(cs['p95'] or 0)
        evidence=1.0
        reasons=[]
        chain_status='not_required'
        wash_risk='low'

        if l == 4 and abs(p-5050.0) < 1e-6:
            cls='structural_floor_cluster'; evidence=0.35
            reasons.append('4-character 5050 TON mass cluster: useful as scarcity floor, weak as semantic market price')
        elif p <= 20:
            cls='technical_floor_candidate'; evidence=0.12
            reasons.append('very low sale price: likely floor / NFT-conversion / low-information transaction')
        elif p <= 50:
            cls='low_price_candidate'; evidence=0.35
            reasons.append('low-price transaction: weak evidence for intrinsic username value')
        else:
            cls='market_candidate'

        if not (l == 4 and abs(p-5050.0) < 1e-6):
            share=count/len(sales)
            if share >= 0.02:
                evidence *= 0.25
                reasons.append('very frequent exact-price cluster')
                if cls == 'market_candidate': cls='mass_price_cluster'
            elif count >= 75:
                evidence *= 0.45
                reasons.append('frequent exact-price cluster')
                if cls == 'market_candidate': cls='mass_price_cluster'
            elif count >= 40:
                evidence *= 0.65
                reasons.append('moderately frequent exact-price cluster')

        if p >= 1000 and p > max(1000.0, 4*p95):
            chain_status='pending'
            wash_risk='high'
            if p > max(5000.0, 10*p95):
                cls='extreme_outlier_unverified'; evidence=min(evidence,0.05)
                reasons.append('extreme statistical outlier (>10x cohort p95): do not use as direct comp before chain check')
            else:
                cls='high_outlier_unverified'; evidence=min(evidence,0.15)
                reasons.append('high statistical outlier (>4x cohort p95): chain check required')

        market_relevance=round(evidence*year_factor(r['year']),4)
        out={
            'username':r.get('username'), 'username_lower':r.get('username_lower'), 'length':l,
            'sale_price_ton':p, 'purchased_at':r.get('purchased_at'), 'year':r['year'],
            'nft_address':r.get('nft_address'), 'nft_index':r.get('nft_index'), 'pattern':pattern,
            'trust_class':cls, 'wash_risk':wash_risk, 'chain_status':chain_status,
            'market_relevance_weight':market_relevance, 'cohort_p95_ton':round(p95,3),
            'exact_price_cluster_count':count, 'reasons':reasons,
        }
        cleaned.append(out); classes[cls]+=1
        if chain_status=='pending': queue.append(out)

    usable=[r for r in cleaned if r['chain_status']!='pending']
    market_only=[r for r in usable if r['trust_class']=='market_candidate']
    by_length={}
    for l in sorted(set(r['length'] for r in usable)):
        all_l=[r for r in usable if r['length']==l]
        market_l=[r for r in market_only if r['length']==l]
        if not all_l: continue
        by_length[str(l)]={
            'usable_count':len(all_l),'clean_market_count':len(market_l),
            'weighted_p25_ton':weighted_quantile(all_l,'sale_price_ton','market_relevance_weight',.25),
            'weighted_median_ton':weighted_quantile(all_l,'sale_price_ton','market_relevance_weight',.50),
            'weighted_p75_ton':weighted_quantile(all_l,'sale_price_ton','market_relevance_weight',.75),
            'clean_market_median_ton':round(statistics.median([r['sale_price_ton'] for r in market_l]),3) if market_l else None,
            'clean_market_p90_ton':round(quantile([r['sale_price_ton'] for r in market_l],.9),3) if market_l else None,
        }

    summary={
        'version':'telegram-market-clean-v1',
        'generated_at':datetime.now(timezone.utc).isoformat(),
        'source_sales_count':len(cleaned),
        'principles':[
            'Fragment sale price is evidence, not ground truth.',
            'Very cheap mass sales are treated mainly as technical/floor signals, not semantic value.',
            'Frequent exact-price clusters are downweighted.',
            '4-character 5050 TON cluster is treated as a structural scarcity-floor signal.',
            'High statistical outliers are excluded from direct calibration until NFT transfer history is checked for circular/self-related ownership patterns.',
            'Recency affects market relevance separately from authenticity risk.'
        ],
        'class_counts':dict(classes),
        'class_share':{k:round(v/len(cleaned),4) for k,v in classes.items()},
        'exact_price_clusters':[{'price_ton':p,'count':c,'share':round(c/len(cleaned),4)} for p,c in exact_counts.most_common(25)],
        'chain_verification_queue_count':len(queue),
        'by_length':by_length,
        'top_chain_verification_queue':[
            {k:r[k] for k in ('username','length','sale_price_ton','purchased_at','nft_address','pattern','trust_class','cohort_p95_ton')}
            for r in sorted(queue,key=lambda x:x['sale_price_ton'],reverse=True)[:150]
        ]
    }

    with open(os.path.join(args.out_dir,'telegram-market-summary-v1.json'),'w',encoding='utf-8') as f:
        json.dump(summary,f,ensure_ascii=False,indent=2)
    with open(os.path.join(args.out_dir,'telegram-market-clean-v1.jsonl'),'w',encoding='utf-8') as f:
        for r in cleaned: f.write(json.dumps(r,ensure_ascii=False)+'\n')
    with open(os.path.join(args.out_dir,'telegram-market-chain-queue-v1.csv'),'w',encoding='utf-8',newline='') as f:
        w=csv.writer(f); w.writerow(['username','length','sale_price_ton','purchased_at','nft_address','pattern','trust_class','cohort_p95_ton'])
        for r in sorted(queue,key=lambda x:x['sale_price_ton'],reverse=True):
            w.writerow([r['username'],r['length'],r['sale_price_ton'],r['purchased_at'],r['nft_address'],r['pattern'],r['trust_class'],r['cohort_p95_ton']])

    report=[]
    report.append('# Telegram market cleaning layer v1')
    report.append('')
    report.append(f"Source sales: {len(cleaned):,}")
    report.append('')
    report.append('## Classification')
    for k,v in classes.most_common(): report.append(f'- {k}: {v:,} ({v/len(cleaned):.1%})')
    report.append('')
    report.append(f"High-price chain verification queue: {len(queue):,}")
    report.append('')
    report.append('## Important interpretation')
    report.append('- `technical_floor_candidate` is not called fake; it is simply low-information evidence for username market value.')
    report.append('- `*_outlier_unverified` is not called wash trading; it is quarantined until transfer-history checks.')
    report.append('- Exact-price clusters are downweighted rather than deleted because they still contain floor/scarcity information.')
    report.append('')
    report.append('## Length calibration (TON)')
    for l,st in by_length.items():
        if int(l)>16: continue
        report.append(f"- {l} chars: usable {st['usable_count']:,}; clean market {st['clean_market_count']:,}; weighted median {st['weighted_median_ton']} TON; clean-market median {st['clean_market_median_ton']} TON; clean-market p90 {st['clean_market_p90_ton']} TON")
    with open(os.path.join(args.out_dir,'telegram-market-report-v1.md'),'w',encoding='utf-8') as f: f.write('\n'.join(report)+'\n')

    print(json.dumps({'ok':True,'sales':len(cleaned),'classes':dict(classes),'chain_queue':len(queue),'out_dir':args.out_dir},ensure_ascii=False))

if __name__=='__main__': main()
