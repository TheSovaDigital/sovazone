import v22Handler from './username-value-v22.js';

const ENGINE_VERSION = 'instagram-v2.3';
const WEAK_LETTERS = new Set(['u','y','q','b','d']);

function normalizeUsername(value){
  let v=String(value||'').trim();
  v=v.replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i,'');
  v=v.replace(/^@/,'').split(/[/?#]/)[0].trim();
  return v;
}

function round250(n){
  return Math.max(0,Math.round((Number(n)||0)/250)*250);
}

function letterWeight(ch){
  if(ch==='a') return 1.25;
  if(WEAK_LETTERS.has(ch)) return 0.75;
  return 1;
}

function tuneLetterDemand(payload,username,lang){
  const m=username.toLowerCase().match(/^([a-z])([a-z])(\d)$/);
  if(!m) return payload;

  const a=m[1], b=m[2];
  const repeated=a===b;
  const pairWeight=(letterWeight(a)+letterWeight(b))/2;

  payload.priceMin=round250(payload.priceMin*pairWeight);
  payload.priceMax=round250(payload.priceMax*pairWeight);
  payload.priceMin=Math.max(1000,payload.priceMin);
  payload.priceMax=Math.max(payload.priceMin,payload.priceMax);

  let scoreShift=0;
  if(pairWeight>1) scoreShift=7;
  else if(pairWeight<1) scoreShift=-8;
  payload.qualityScore=Math.max(0,Math.min(100,Math.round((Number(payload.qualityScore)||0)+scoreShift)));

  if(repeated){
    let text;
    if(a==='a'){
      text=lang==='en'
        ? 'AA has above-average visual appeal and demand among repeated-letter pairs.'
        : 'AA относится к более привлекательным повторяющимся буквенным сочетаниям и имеет повышенный спрос.';
    }else if(WEAK_LETTERS.has(a)){
      text=lang==='en'
        ? a.toUpperCase()+a.toUpperCase()+' is a weaker repeated-letter pair and trades below stronger letters in the same format.'
        : a.toUpperCase()+a.toUpperCase()+' относится к более слабым повторяющимся буквенным сочетаниям и обычно стоит ниже сильных букв в том же формате.';
    }else{
      text=lang==='en'
        ? a.toUpperCase()+a.toUpperCase()+' is a solid neutral repeated-letter pair.'
        : a.toUpperCase()+a.toUpperCase()+' — хорошее нейтральное повторяющееся буквенное сочетание.';
    }

    if(Array.isArray(payload.factors) && payload.factors.length>=2){
      payload.factors[1]={title:lang==='en'?'Letter quality':'Качество букв',text};
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

  await v22Handler(req,shadow);

  for(const [name,value] of Object.entries(headers)) res.setHeader(name,value);
  res.setHeader('X-Sova-Engine-Version',ENGINE_VERSION);

  if(payload && typeof payload==='object'){
    const username=normalizeUsername(req.body?.username);
    const platform=String(req.body?.platform||'instagram').toLowerCase()==='tiktok'?'tiktok':'instagram';
    const lang=String(req.body?.lang||'ru').toLowerCase()==='en'?'en':'ru';

    payload={...payload,engineVersion:ENGINE_VERSION};
    if(statusCode===200 && platform==='instagram') payload=tuneLetterDemand(payload,username,lang);
  }

  if(payload!==undefined) return res.status(statusCode).json(payload);
  if(ended) return res.status(statusCode).end();
  return res.status(500).json({error:'Valuation wrapper did not receive a response.'});
}
