import handler from '../../api/username-value.js';

async function evaluate(username, platform='instagram'){
  let payload=null,statusCode=200;
  const req={
    method:'POST',
    headers:{origin:'https://sovazone.com','x-forwarded-for':'127.0.0.1'},
    body:{username,platform,lang:'ru',website:''},
    socket:{remoteAddress:'127.0.0.1'}
  };
  const res={
    setHeader(){},
    status(code){statusCode=code;return this;},
    json(data){payload=data;return data;},
    end(){return null;}
  };
  await handler(req,res);
  if(statusCode!==200||!payload)throw new Error(`${username}: HTTP ${statusCode}`);
  return payload;
}

const expected={
  '111':[50000,50000,true],
  '777':[50000,50000,true],
  '000':[50000,50000,true],
  '404':[10000,20000,false],
  '555':[10000,15000,false],
  '123':[10000,15000,false],
  '007':[5000,10000,false],
  '321':[3000,5000,false],
  '101':[7000,10000,false],
  '707':[5000,8000,false],
  '789':[3000,5000,false],
  '928':[1500,2000,false],
  '666':[10000,15000,false],
  '100':[10000,15000,false],
  '999':[10000,15000,false],
  '888':[7000,12000,false],
  '200':[5000,10000,false],
  '911':[3000,5000,false],
  '420':[1500,2000,false]
};

for(const [u,want] of Object.entries(expected)){
  const got=await evaluate(u);
  const actual=[got.priceMin,got.priceMax,got.openEnded];
  if(JSON.stringify(actual)!==JSON.stringify(want)){
    throw new Error(`${u}: expected ${JSON.stringify(want)}, got ${JSON.stringify(actual)}`);
  }
  if(got.engineVersion!=='instagram-v3.4')throw new Error(`${u}: wrong engine ${got.engineVersion}`);
}

const tiktok=await evaluate('555','tiktok');
if(tiktok.priceMin!==2500||tiktok.priceMax!==3750){
  throw new Error(`TikTok 555 scaling mismatch: ${tiktok.priceMin}-${tiktok.priceMax}`);
}

console.log('all numeric v3.4 regression cases passed');
