// Permanent Telegram v1.1 deterministic regression controls.
import handler from '../../api/telegram-username-value.js';

process.env.OPENAI_API_KEY='test-key';

const classifications={
  qzxvna:{category:'Random string',categoryCode:'random',demandScore:10,qualityScore:8,liquidity:'low',uncertain:false},
  aaaa:{category:'Pattern',categoryCode:'pattern',demandScore:50,qualityScore:70,liquidity:'medium',uncertain:false},
  work:{category:'English word',categoryCode:'english_word',demandScore:80,qualityScore:86,liquidity:'high',uncertain:false},
  hello:{category:'English word',categoryCode:'english_word',demandScore:90,qualityScore:92,liquidity:'high',uncertain:false},
  hello_:{category:'Word with underscore',categoryCode:'english_word',demandScore:30,qualityScore:25,liquidity:'low',uncertain:false}
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
  ['qzxvna',0,0,0,0],
  ['aaaa',5000,8000,7000,11500],
  ['work',5500,10000,8000,14000],
  ['hello',1400,4200,2000,6000],
  ['hello_',0,20,0,30]
];
for(const [u,minTon,maxTon,minUsd,maxUsd] of cases){
  const r=await evaluate(u);
  if(r.engineVersion!=='telegram-v1.1')throw new Error(`${u}: wrong engine ${r.engineVersion}`);
  if(r.priceMinTon!==minTon||r.priceMaxTon!==maxTon)throw new Error(`${u}: TON ${r.priceMinTon}-${r.priceMaxTon}, expected ${minTon}-${maxTon}`);
  if(r.priceMin!==minUsd||r.priceMax!==maxUsd)throw new Error(`${u}: USD ${r.priceMin}-${r.priceMax}, expected ${minUsd}-${maxUsd}`);
}
const brand=await evaluate('adidas');
if(brand.specialCase!=='global_brand'||brand.priceMin!==0||brand.priceMax!==0)throw new Error('Brand special case failed');
console.log('PASS 6 Telegram valuation controls on telegram-v1.1');
globalThis.fetch=originalFetch;
