import handler from '../../api/username-value.js';

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

for(const [u,[min,max]] of Object.entries(exact)){
  const r=await evaluate(u);
  if(r.priceMin!==min||r.priceMax!==max)throw new Error(`${u}: got ${r.priceMin}-${r.priceMax}, expected ${min}-${max}`);
  if(r.engineVersion!=='instagram-v3.9')throw new Error(`${u}: wrong engine ${r.engineVersion}`);
}

const tiktok=await evaluate('aa','tiktok');
if(tiktok.priceMin!==4000||tiktok.priceMax!==6000)throw new Error(`TikTok aa scaling: ${tiktok.priceMin}-${tiktok.priceMax}`);
if(tiktok.engineVersion!=='instagram-v3.9')throw new Error(`TikTok aa wrong engine ${tiktok.engineVersion}`);

console.log(`PASS ${Object.keys(exact).length+1} local deterministic valuation controls on instagram-v3.9`);
