// Permanent Telegram v1.2 deterministic regression controls.
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
  hel_lo:{category:'English word',categoryCode:'english_word',marketTier:'medium',archetype:'generic',demandScore:40,qualityScore:35,liquidity:'low',uncertain:false}
};

const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,opts={})=>{
  const s=String(url);
  if(s.includes('api.coingecko.com'))return {ok:true,json:async()=>({'the-open-network':{usd:1.42}})};
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
  ['qzxvna',0,0],['aaaa',5000,10000],['work',10000,20000],['alex',5000,15000],
  ['volk',5000,10000],['hello',2000,5000],['money',10000,30000],['cloud',10000,20000],
  ['dream',10000,20000],['love',5000,10000],['pavel',20000,50000],['pasha',1000,3000],
  ['paris',500,1000],['monkey',30000,50000],['trading',3000,5000],['hel_lo',0,30]
];
for(const [u,minTon,maxTon] of cases){
  const r=await evaluate(u);
  if(r.engineVersion!=='telegram-v1.2')throw new Error(`${u}: wrong engine ${r.engineVersion}`);
  if(r.priceMinTon!==minTon||r.priceMaxTon!==maxTon)throw new Error(`${u}: TON ${r.priceMinTon}-${r.priceMaxTon}, expected ${minTon}-${maxTon}`);
  if(maxTon>0&&!(Number(r.priceMax)>0))throw new Error(`${u}: missing USD conversion`);
}
const invalid=await evaluate('hello_');
if(invalid.specialCase!=='invalid_username'||invalid.priceMinTon!==0||invalid.priceMaxTon!==0)throw new Error(`hello_: invalid edge underscore rule failed ${JSON.stringify(invalid)}`);
const brand=await evaluate('adidas');
if(brand.specialCase!=='global_brand'||brand.priceMin!==0||brand.priceMax!==0)throw new Error('Brand special case failed');
console.log('PASS 18 Telegram valuation controls on telegram-v1.2');
globalThis.fetch=originalFetch;
