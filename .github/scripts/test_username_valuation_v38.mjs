import handler,{threeLetterPatternRange} from '../../api/username-value.js';

async function evaluate(username, platform='instagram', lang='ru'){
  let statusCode=200, payload=null;
  const req={method:'POST',headers:{origin:'https://sovazone.com','x-forwarded-for':'127.0.0.1'},body:{username,platform,lang},socket:{remoteAddress:'127.0.0.1'}};
  const res={setHeader(){},status(code){statusCode=code;return this;},json(obj){payload=obj;return obj;},end(){return null;}};
  await handler(req,res);
  if(statusCode!==200)throw new Error(`${username}: HTTP ${statusCode} ${JSON.stringify(payload)}`);
  return payload;
}

const exact={
  aa:[20000,30000], '11':[18000,30000], a1:[18000,25000], ab:[17000,23000], '1a':[16000,22000],
  qy:[15000,20000], ax:[15000,30000], x7:[15000,22000], uy:[15000,20000], q9:[15000,18000],
  '111':[50000,50000], '404':[10000,20000], '555':[10000,15000], '321':[3000,5000], '420':[1500,2000],
  aaaaa:[1500,3000], aaabb:[100,300], aabbb:[100,300], azaza:[100,200], abcde:[0,50], qwert:[0,100]
};

const threeLetterPatterns={
  aaa:[30000,50000],xxx:[30000,50000],zzz:[10000,15000],qqq:[10000,15000],
  abc:[10000,20000],qwe:[6000,10000],aba:[5000,8000],baa:[4000,7000],aab:[3500,6500],bqy:[1500,2000]
};
for(const [u,[min,max]] of Object.entries(threeLetterPatterns)){
  const r=threeLetterPatternRange(u);
  if(!r||r.min!==min||r.max!==max)throw new Error(`${u}: three-letter pattern ${r&&r.min}-${r&&r.max}, expected ${min}-${max}`);
}
if(!(threeLetterPatternRange('aaa').min>threeLetterPatternRange('abc').min&&threeLetterPatternRange('abc').min>threeLetterPatternRange('qwe').min&&threeLetterPatternRange('qwe').min>threeLetterPatternRange('aba').min&&threeLetterPatternRange('aba').min>threeLetterPatternRange('baa').min&&threeLetterPatternRange('baa').min>threeLetterPatternRange('aab').min&&threeLetterPatternRange('aab').min>threeLetterPatternRange('bqy').min))throw new Error('three-letter pattern order regression');

for(const [u,[min,max]] of Object.entries(exact)){
  const r=await evaluate(u);
  if(r.priceMin!==min||r.priceMax!==max)throw new Error(`${u}: got ${r.priceMin}-${r.priceMax}, expected ${min}-${max}`);
  if(r.engineVersion!=='instagram-v4.0')throw new Error(`${u}: wrong engine ${r.engineVersion}`);
}

const tiktok=await evaluate('aa','tiktok');
if(tiktok.priceMin!==4000||tiktok.priceMax!==6000)throw new Error(`TikTok aa scaling: ${tiktok.priceMin}-${tiktok.priceMax}`);
if(tiktok.engineVersion!=='instagram-v4.0')throw new Error(`TikTok aa wrong engine ${tiktok.engineVersion}`);

console.log(`PASS ${Object.keys(exact).length+Object.keys(threeLetterPatterns).length+1} local deterministic valuation controls on instagram-v4.0`);
