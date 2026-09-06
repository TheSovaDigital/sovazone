#!/usr/bin/env python3
import argparse, csv, json, math, os, time
from collections import Counter, defaultdict
from datetime import datetime, timezone

import requests

BASE='https://toncenter.com/api/v3/nft/transfers'


def parse_ts(value):
    if not value: return None
    try: return int(datetime.fromisoformat(value.replace('Z','+00:00')).timestamp())
    except Exception: return None


def fetch_batch(session, addresses, delay=1.1):
    params=[('item_address',a) for a in addresses]
    params += [('limit','1000'),('offset','0'),('sort','asc')]
    r=session.get(BASE,params=params,timeout=60)
    if r.status_code==200:
        return r.json().get('nft_transfers') or []
    if r.status_code in (400,414):
        out=[]
        for a in addresses:
            q=session.get(BASE,params={'item_address':a,'limit':1000,'offset':0,'sort':'asc'},timeout=60)
            q.raise_for_status(); out.extend(q.json().get('nft_transfers') or [])
            time.sleep(delay)
        return out
    r.raise_for_status()


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('queue_csv')
    ap.add_argument('--out',default='telegram-transfer-risk-v1.json')
    ap.add_argument('--batch-size',type=int,default=20)
    args=ap.parse_args()

    api_key=os.environ.get('TONCENTER_API_KEY','').strip()
    rows=list(csv.DictReader(open(args.queue_csv,encoding='utf-8')))
    by_addr={r['nft_address']:r for r in rows if r.get('nft_address')}
    addresses=list(by_addr)
    session=requests.Session(); session.headers.update({'Accept':'application/json'})
    if api_key: session.headers.update({'X-API-Key':api_key})
    request_delay=0.20 if api_key else 1.15
    transfers=[]; errors=[]
    for i in range(0,len(addresses),args.batch_size):
        batch=addresses[i:i+args.batch_size]
        try: transfers.extend(fetch_batch(session,batch,request_delay))
        except Exception as e: errors.append({'addresses':batch,'error':repr(e)})
        time.sleep(request_delay)

    per=defaultdict(list)
    address_nfts=defaultdict(set)
    for t in transfers:
        nft=t.get('nft_address')
        if not nft: continue
        per[nft].append(t)
        for a in (t.get('old_owner'),t.get('new_owner')):
            if a: address_nfts[a].add(nft)
    common_threshold=max(6,math.ceil(len(addresses)*0.08))
    common={a for a,s in address_nfts.items() if len(s)>=common_threshold}

    results=[]
    for addr,row in by_addr.items():
        ts=sorted(per.get(addr,[]),key=lambda x:int(x.get('transaction_now') or 0))
        sale_ts=parse_ts(row.get('purchased_at'))
        raw=[]
        for t in ts:
            old=t.get('old_owner'); new=t.get('new_owner'); now=int(t.get('transaction_now') or 0)
            if old and new: raw.append((old,new,now))
        near=[x for x in raw if sale_ts is not None and abs(x[2]-sale_ts)<=45*86400]

        # Strongest observable signal: A -> intermediary -> A close to the recorded sale.
        # Fragment may use per-auction contracts, so the intermediary does not have to be globally common.
        direct_roundtrips=[]
        for i in range(len(near)-1):
            a,b,t1=near[i]; b2,a2,t2=near[i+1]
            if b==b2 and a==a2 and a!=b and 0 <= t2-t1 <= 45*86400:
                direct_roundtrips.append({'owner':a,'intermediary':b,'start':t1,'end':t2,'seconds':t2-t1})

        # Broader owner-cycle signal, while ignoring marketplace addresses shared across many NFTs.
        owners=[]; owner_times=[]
        for old,new,now in raw:
            for a in (old,new):
                if not a or a in common: continue
                if not owners or owners[-1]!=a:
                    owners.append(a); owner_times.append(now)
        repeats=[]
        first={}
        for i,a in enumerate(owners):
            if a in first and i-first[a]>=2:
                start=owner_times[first[a]]; end=owner_times[i]
                repeats.append({'owner':a,'steps':i-first[a],'start':start,'end':end,'seconds':max(0,end-start)})
            else:
                first[a]=i

        # Any short owner cycle near the recorded sale is elevated, even if the intermediary contract is unique.
        near_cycles=[]
        if sale_ts is not None:
            for cyc in repeats:
                if abs(cyc['start']-sale_ts)<=45*86400 or abs(cyc['end']-sale_ts)<=45*86400:
                    near_cycles.append(cyc)

        if direct_roundtrips:
            risk='high'; status='near_sale_direct_roundtrip'
        elif near_cycles:
            risk='high'; status='near_sale_owner_cycle'
        elif repeats:
            risk='medium'; status='owner_cycle_detected'
        elif len(raw)>=2:
            risk='low'; status='no_cycle_detected'
        elif len(raw)==1:
            risk='unknown'; status='limited_transfer_history'
        else:
            risk='unknown'; status='no_transfer_history'
        results.append({
            'username':row.get('username'),'nft_address':addr,'sale_price_ton':float(row.get('sale_price_ton') or 0),
            'purchased_at':row.get('purchased_at'),'transfer_count':len(raw),'noncommon_owner_sequence_count':len(owners),
            'chain_wash_risk':risk,'chain_status':status,'near_sale_direct_roundtrips':direct_roundtrips[:5],
            'near_sale_owner_cycles':near_cycles[:5],'owner_cycles':repeats[:8]
        })

    summary={
        'version':'telegram-transfer-risk-v1.1','generated_at':datetime.now(timezone.utc).isoformat(),
        'public_api_without_key':not bool(api_key),
        'requested':len(addresses),'transfers_loaded':len(transfers),'errors':errors,
        'common_intermediary_threshold_nfts':common_threshold,'common_intermediary_count':len(common),
        'status_counts':dict(Counter(r['chain_status'] for r in results)),
        'risk_counts':dict(Counter(r['chain_wash_risk'] for r in results)),
        'results':sorted(results,key=lambda r:r['sale_price_ton'],reverse=True)
    }
    with open(args.out,'w',encoding='utf-8') as f: json.dump(summary,f,ensure_ascii=False,indent=2)
    print(json.dumps({k:summary[k] for k in ('version','public_api_without_key','requested','transfers_loaded','common_intermediary_count','status_counts','risk_counts')},ensure_ascii=False))

if __name__=='__main__': main()
