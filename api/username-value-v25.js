import v24Handler from './username-value-v24.js';

const ENGINE_VERSION = 'instagram-v2.5';

function normalizeUsername(value){
  let v=String(value||'').trim();
  v=v.replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i,'');
  v=v.replace(/^@/,'').split(/[/?#]/)[0].trim();
  return v;
}

function enforceThreeCharFloor(payload, username, platform, lang){
  if(platform!=='instagram') return payload;
  const lower=username.toLowerCase();

  // Absolute owner rule: every CLEAN 3-character Instagram username made only
  // from Latin letters/digits has at least $1,500 standalone value because of scarcity.
  // Dots/underscores are intentionally excluded from this floor.
  if(!/^[a-z0-9]{3}$/.test(lower)) return payload;

  const oldMin=Number(payload.priceMin||0);
  const oldMax=Number(payload.priceMax||0);
  payload.priceMin=Math.max(1500, oldMin);
  payload.priceMax=Math.max(payload.priceMin, oldMax);
  if(payload.priceMax===payload.priceMin) payload.priceMax=payload.priceMin+500;

  // Keep composition differences in the upside/quality score; scarcity only sets the floor.
  if(Array.isArray(payload.factors) && payload.factors.length){
    const scarcityText=lang==='en'
      ? 'Any clean 3-character Instagram username has a $1,500 minimum valuation from scarcity alone; composition determines the upside.'
      : 'Любой чистый 3-символьный Instagram username имеет минимальную оценку $1,500 только за счёт редкости; состав определяет потенциал выше этого уровня.';
    payload.factors[0]={title:lang==='en'?'Scarcity floor':'Минимум за редкость',text:scarcityText};
  }

  return payload;
}

export default async function handler(req,res){
  let statusCode=200;
  let payload;
  let ended=false;
  const headers={};

  const shadow={
    setHeader(name,value){ headers[name]=value; },
    status(code){ statusCode=code; return shadow; },
    json(value){ payload=value; ended=true; return shadow; },
    end(){ ended=true; return shadow; }
  };

  await v24Handler(req,shadow);

  for(const [name,value] of Object.entries(headers)) res.setHeader(name,value);
  res.setHeader('X-Sova-Engine-Version',ENGINE_VERSION);

  if(payload && typeof payload==='object'){
    const username=normalizeUsername(req.body?.username);
    const platform=String(req.body?.platform||'instagram').toLowerCase()==='tiktok'?'tiktok':'instagram';
    const lang=String(req.body?.lang||'ru').toLowerCase()==='en'?'en':'ru';
    payload={...payload,engineVersion:ENGINE_VERSION};
    if(statusCode===200) payload=enforceThreeCharFloor(payload,username,platform,lang);
  }

  if(payload!==undefined) return res.status(statusCode).json(payload);
  if(ended) return res.status(statusCode).end();
  return res.status(500).json({error:'Valuation wrapper did not receive a response.'});
}
