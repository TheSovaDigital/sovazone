import v25Handler from './username-value-v25.js';

const ENGINE_VERSION = 'instagram-v2.6';

function normalizeUsername(value){
  let v=String(value||'').trim();
  v=v.replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i,'');
  v=v.replace(/^@/,'').split(/[/?#]/)[0].trim();
  return v;
}

function shortFloor(length){
  if(length<=1) return 15000;
  if(length===2) return 15000;
  if(length===3) return 1500;
  if(length===4) return 100;
  return 0;
}

function shortUpsideFloor(length){
  if(length<=1) return 25000;
  if(length===2) return 20000;
  if(length===3) return 2000;
  if(length===4) return 250;
  return 0;
}

function enforceShortScarcity(payload,username,platform,lang){
  if(platform!=='instagram') return payload;
  const lower=username.toLowerCase();
  if(!/^[a-z0-9._]{1,4}$/.test(lower)) return payload;

  const len=[...lower].length;
  const floor=shortFloor(len);
  const upsideFloor=shortUpsideFloor(len);
  const hasSeparator=/[._]/.test(lower);

  const oldMin=Number(payload.priceMin||0);
  const oldMax=Number(payload.priceMax||0);
  payload.priceMin=Math.max(floor,oldMin);
  payload.priceMax=Math.max(payload.priceMin,oldMax,upsideFloor);

  // Dots/underscores reduce quality versus the same short clean combination,
  // but DO NOT erase scarcity value for 1-4 character usernames.
  if(hasSeparator){
    payload.qualityScore=Math.max(15,Math.round((Number(payload.qualityScore)||45)-10));
    payload.category=lang==='en'?'Short scarce username':'Короткий редкий username';
    payload.categoryCode='short';
    if(len===3){
      // Owner calibration: even a weak 3-char separator example such as q_9
      // still has a $1,500 minimum valuation because the 3-character supply is scarce.
      payload.priceMin=Math.max(1500,payload.priceMin);
      payload.priceMax=Math.max(2000,payload.priceMax);
    }
  }

  if(Array.isArray(payload.factors) && payload.factors.length){
    const scarcityText = lang==='en'
      ? `At ${len} characters, scarcity remains valuable even when the username contains a dot or underscore.`
      : `При длине ${len} символа редкость сохраняет ценность даже при наличии точки или подчёркивания.`;
    payload.factors[0]={title:lang==='en'?'Short-format scarcity':'Редкость короткого формата',text:scarcityText};

    if(hasSeparator && payload.factors.length>1){
      payload.factors[1]={
        title:lang==='en'?'Separator discount':'Поправка за символ',
        text:lang==='en'
          ? 'A dot or underscore lowers visual quality and demand versus an equally short clean username, but it does not make a 1-4 character username worthless.'
          : 'Точка или подчёркивание снижают визуальное качество и спрос относительно такого же короткого чистого username, но не обнуляют ценность ника длиной 1–4 символа.'
      };
    }
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

  await v25Handler(req,shadow);

  for(const [name,value] of Object.entries(headers)) res.setHeader(name,value);
  res.setHeader('X-Sova-Engine-Version',ENGINE_VERSION);

  if(payload && typeof payload==='object'){
    const username=normalizeUsername(req.body?.username);
    const platform=String(req.body?.platform||'instagram').toLowerCase()==='tiktok'?'tiktok':'instagram';
    const lang=String(req.body?.lang||'ru').toLowerCase()==='en'?'en':'ru';
    payload={...payload,engineVersion:ENGINE_VERSION};
    if(statusCode===200) payload=enforceShortScarcity(payload,username,platform,lang);
  }

  if(payload!==undefined) return res.status(statusCode).json(payload);
  if(ended) return res.status(statusCode).end();
  return res.status(500).json({error:'Valuation wrapper did not receive a response.'});
}
