// Permanent Telegram v1.3 deterministic regression controls.
import handler from '../../api/telegram-username-value.js';

process.env.OPENAI_API_KEY='test-key';

const classifications={
  qzxvna:{category:'Random string',categoryCode:'random',marketTier:'zero',archetype:'random',demandScore:4,qualityScore:8,liquidity:'low',uncertain:false},
  aaaa:{category:'Pattern',categoryCode:'pattern',marketTier:'strong',archetype:'pattern',demandScore:68,qualityScore:70,liquidity:'high',uncertain:false},
  work:{category:'English word',categoryCode:'english_word',marketTier:'premium',archetype:'commercial',demandScore:88,qualityScore:90,liquidity:'high',uncertain:false},
  alex:{category:'First name',categoryCode:'first_name',marketTier:'strong',archetype:'name',demandScore:91,qualityScore:92,liquidity:'high',uncertain:false},
  volk:{category:'Russian transliteration',categoryCode:'russian_word_translit',marketTier:'strong',archetype:'generic',demandScore:78,qualityScore:86,liquidity:'high',uncertain:false},
  hello:{category:'English word',categoryCode:'english_word',marketTier:'medium',archetype:'greeting',demandScore:82,qualityScore:88,liquidity:'high',uncertain:false},
  money:{category:'English word',categoryCode:'english_word',marketTier:'premium',archetype:'finance',demandScore:94,qualityScore:94,liquidity:'high',uncertain:false},
  cloud:{category:'English word',categoryCode:'english_word',marketTier:'premium',archetype:'generic',demandScore:92,qualityScore:92,liquidity:'high',uncertain:false},
  dream:{category:'English word',categoryCode:'english_word',marketTier:'premium',archetype:'generic',demandScore:92,qualityScore:92,liquidity:'high',uncertain:false},
  love:{category:'English word',categoryCode:'english_word',marketTier:'strong',archetype:'generic',demandScore:88,qualityScore:90,liquidity:'high',uncertain:false},
  pavel:{category:'First name',categoryCode:'first_name',marketTier:'elite',archetype:'platform_identity',demandScore:98,qualityScore:96,liquidity:'high',uncertain:false},
  pasha:{category:'First name',categoryCode:'first_name',marketTier:'low',archetype:'name',demandScore:68,qualityScore:75,liquidity:'medium',uncertain:false},
  paris:{category:'Geography',categoryCode:'geography',marketTier:'micro',archetype:'geography',demandScore:60,qualityScore:82,liquidity:'medium',uncertain:false},
  monkey:{category:'English word',categoryCode:'english_word',marketTier:'elite',archetype:'animal',demandScore:98,qualityScore:96,liquidity:'high',uncertain:false},
  trading:{category:'English word',categoryCode:'english_word',marketTier:'medium',archetype:'commercial',demandScore:82,qualityScore:84,liquidity:'medium',uncertain:false},
  hel_lo:{category:'English word',categoryCode:'english_word',marketTier:'medium',archetype:'generic',demandScore:40,qualityScore:35,liquidity:'low',uncertain:false},
  aaaaa:{category:'Pattern',categoryCode:'pattern',marketTier:'strong',archetype:'pattern',demandScore:78,qualityScore:78,liquidity:'medium',uncertain:false},
  zzqzx65:{category:'Random letters',categoryCode:'random',marketTier:'premium',archetype:'random',demandScore:97,qualityScore:95,liquidity:'high',uncertain:false},
  smart123:{category:'Commercial name',categoryCode:'english_word',marketTier:'premium',archetype:'commercial',demandScore:95,qualityScore:95,liquidity:'high',uncertain:false},
  num284693:{category:'Number with a prefix',categoryCode:'numeric',marketTier:'premium',archetype:'generic',demandScore:95,qualityScore:95,liquidity:'high',uncertain:false},
  weakbrandword:{category:'Weak brand',categoryCode:'english_word',marketTier:'elite',archetype:'generic',demandScore:30,qualityScore:40,liquidity:'medium',uncertain:false},
  modest:{category:'General term',categoryCode:'english_word',marketTier:'medium',archetype:'generic',demandScore:60,qualityScore:65,liquidity:'medium',uncertain:false}
};

const originalFetch=globalThis.fetch;
let fxApiDown=false;
globalThis.fetch=async (url,opts={})=>{
  const s=String(url);
  if(s.includes('api.coingecko.com')){
    if(fxApiDown)throw new Error('simulated FX outage');
    return {ok:true,json:async()=>({'the-open-network':{usd:1.42}})};
  }
  if(s.includes('api.coinbase.com'))throw new Error('simulated backup FX outage');
  if(s.includes('api.openai.com')){
    const body=JSON.parse(opts.body||'{}');
    const input=String(body.input||'');
    const m=input.match(/@([A-Za-z0-9_]+)/);
    const username=(m&&m[1]||'').toLowerCase();
    const c=classifications[username];
    if(!c)throw new Error(`Missing mock classification for ${username}`);
    const factors=[{title:'Demand',text:'Mock demand factor.'},{title:'Structure',text:'Mock structure factor.'},{title:'Market',text:'Mock market factor.'}];
    return {ok:true,json:async()=>({output_text:JSON.stringify({...c,factors})})};
  }
  throw new Error(`Unexpected fetch ${s}`);
};

async function evaluate(username){
  let statusCode=200,payload=null;
  const req={method:'POST',headers:{origin:'https://sovazone.com','x-forwarded-for':`127.0.0.${Math.floor(Math.random()*200)+1}`},body:{username,lang:'en',website:''},socket:{remoteAddress:'127.0.0.1'}};
  const res={setHeader(){},status(code){statusCode=code;return this;},json(obj){payload=obj;return obj;},end(){return null;}};
  await handler(req,res);
  if(statusCode!==200)throw new Error(`${username}: HTTP ${statusCode} ${JSON.stringify(payload)}`);
  return payload;
}

const cases=[
  ['qzxvna',0,0],['aaaa',5000,10000],['work',10000,20000],['alex',5000,10000],
  ['volk',5000,10000],['hello',20,120],['money',1000,7000],['cloud',500,3000],
  ['dream',500,3000],['love',100,600],['pavel',10000,30000],['pasha',5,30],
  ['paris',0,10],['monkey',10000,30000],['trading',20,120],['hel_lo',0,5],
  ['aaaaa',100,600],['zzqzx65',0,5],['smart123',0,20],
  ['num284693',0,20],['weakbrandword',5,30]
];
for(const [u,minTon,maxTon] of cases){
  const r=await evaluate(u);
  if(r.engineVersion!=='telegram-v1.3')throw new Error(`${u}: wrong engine ${r.engineVersion}`);
  if(r.priceMinTon!==minTon||r.priceMaxTon!==maxTon)throw new Error(`${u}: TON ${r.priceMinTon}-${r.priceMaxTon}, expected ${minTon}-${maxTon}`);
  if(maxTon>0&&!(Number(r.priceMax)>0))throw new Error(`${u}: missing USD conversion`);
}
const invalid=await evaluate('hello_');
if(invalid.specialCase!=='invalid_username'||invalid.priceMinTon!==0||invalid.priceMaxTon!==0)throw new Error(`hello_: invalid edge underscore rule failed ${JSON.stringify(invalid)}`);
const brand=await evaluate('adidas');
if(brand.specialCase!=='global_brand'||brand.priceMin!==0||brand.priceMax!==0)throw new Error('Brand special case failed');
// A lost FX feed must never substitute an invented fixed $3/TON rate.
Object.assign(globalThis.__sovaTonUsdCache,{rate:null,at:0,lastSuccessAt:0,source:'unavailable'});
fxApiDown=true;
const fxOutage=await evaluate('modest');
if(fxOutage.priceMin!==null||fxOutage.priceMax!==null||fxOutage.tonUsdRate!==null||fxOutage.tonUsdSource!=='unavailable')
  throw new Error('FX outage must result in null USD fields, not a stale invented rate');
if(!(fxOutage.priceMaxTon>0))throw new Error('TON valuation must remain available without USD FX');
console.log('PASS 21 Telegram valuation cases plus FX outage regression on telegram-v1.3');
globalThis.fetch=originalFetch;
