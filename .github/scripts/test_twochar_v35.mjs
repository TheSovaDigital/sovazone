import handler from '../../api/username-value.js';

async function evaluate(username, platform='instagram', lang='ru'){
  let statusCode=200, payload=null;
  const req={method:'POST',headers:{origin:'https://sovazone.com','x-forwarded-for':'127.0.0.1'},body:{username,platform,lang},socket:{remoteAddress:'127.0.0.1'}};
  const res={
    setHeader(){},
    status(code){statusCode=code;return this;},
    json(obj){payload=obj;return obj;},
    end(){return null;}
  };
  await handler(req,res);
  if(statusCode!==200)throw new Error(`${username}: HTTP ${statusCode} ${JSON.stringify(payload)}`);
  return payload;
}

const expected={
  aa:[20000,30000],
  '11':[18000,30000],
  a1:[18000,25000],
  ab:[17000,23000],
  '1a':[16000,22000],
  qy:[15000,20000],
  ax:[15000,30000],
  x7:[15000,22000],
  uy:[15000,20000],
  q9:[15000,18000],
};

for(const [u,[min,max]] of Object.entries(expected)){
  const r=await evaluate(u);
  if(r.priceMin!==min||r.priceMax!==max)throw new Error(`${u}: got ${r.priceMin}-${r.priceMax}, expected ${min}-${max}`);
  if(r.engineVersion!=='instagram-v3.7')throw new Error(`${u}: wrong engine ${r.engineVersion}`);
  if(r.categoryCode!=='short')throw new Error(`${u}: wrong category ${r.categoryCode}`);
}

for(const [u,[min,max]] of Object.entries({
  '111':[50000,50000],
  '404':[10000,20000],
  '555':[10000,15000],
  '321':[3000,5000],
  '420':[1500,2000],
})){
  const r=await evaluate(u);
  if(r.priceMin!==min||r.priceMax!==max)throw new Error(`numeric regression ${u}: got ${r.priceMin}-${r.priceMax}, expected ${min}-${max}`);
}

const tiktok=await evaluate('aa','tiktok');
if(tiktok.priceMin!==5000||tiktok.priceMax!==7500)throw new Error(`TikTok aa scaling: ${tiktok.priceMin}-${tiktok.priceMax}`);

console.log('v3.7 structural regression tests passed');
