import v23Handler from './username-value-v23.js';

const ENGINE_VERSION = 'instagram-v2.4';
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

function letterFactor(ch){
  if(ch==='a') return 1.20;
  if(WEAK_LETTERS.has(ch)) return 0.80;
  return 1.00;
}

function digitFactor(digit,repeatedLetters){
  if(digit==='1' || digit==='7') return 1.20;
  if(digit==='5') return 1.10;
  if(digit==='8' || digit==='9') return 0.80;
  if(digit==='2') return repeatedLetters ? 1.20 : 0.95;
  return 1.00;
}

function tuneThreeCharMixed(payload,username,lang){
  const m=username.toLowerCase().match(/^([a-z])([a-z])(\d)$/);
  if(!m) return payload;

  const a=m[1], b=m[2], digit=m[3];
  const repeated=a===b;
  const pairFactor=(letterFactor(a)+letterFactor(b))/2;
  const repeatFactor=repeated ? 1.25 : 1.00;
  const dFactor=digitFactor(digit,repeated);
  const totalFactor=pairFactor*repeatFactor*dFactor;

  const baseMin=1000;
  const baseMax=2200;
  let min=round250(baseMin*totalFactor);
  let max=round250(baseMax*totalFactor);

  // 3-character scarcity is valuable, but there is no universal $1,500 floor:
  // weak letters + weak digit combinations can legitimately fall below it.
  min=Math.max(500,min);
  max=Math.max(min+250,max);

  let score=58;
  if(repeated) score+=8;
  if(pairFactor>1) score+=7;
  else if(pairFactor<1) score-=9;
  if(dFactor>1.1) score+=6;
  else if(dFactor<1) score-=7;
  score=Math.max(20,Math.min(95,score));

  const midpoint=(min+max)/2;
  const liquidity=midpoint>=1800?'medium':'low';

  payload.priceMin=min;
  payload.priceMax=max;
  payload.qualityScore=score;
  payload.liquidity=liquidity;
  payload.liquidityLabel=lang==='en'?(liquidity==='medium'?'Medium':'Low'):(liquidity==='medium'?'Средняя':'Низкая');
  payload.category=lang==='en'?'Short mixed username':'Короткий смешанный username';
  payload.categoryCode='short';

  let letterText;
  if(a==='a' && b==='a'){
    letterText=lang==='en'
      ? 'AA is a stronger repeated-letter pair with above-average visual demand.'
      : 'AA — более сильное повторяющееся сочетание с повышенной визуальной привлекательностью.';
  }else if(WEAK_LETTERS.has(a) && WEAK_LETTERS.has(b)){
    letterText=lang==='en'
      ? 'Both letters are from a weaker-demand group, which materially lowers the value.'
      : 'Обе буквы относятся к группе со слабым спросом, поэтому заметно снижают стоимость.';
  }else if(WEAK_LETTERS.has(a) || WEAK_LETTERS.has(b)){
    letterText=lang==='en'
      ? 'One weaker-demand letter slightly reduces the pair quality.'
      : 'Одна буква со слабым спросом немного снижает качество пары.';
  }else if(repeated){
    letterText=lang==='en'
      ? 'The repeated-letter pair improves memorability.'
      : 'Повтор букв повышает запоминаемость сочетания.';
  }else{
    letterText=lang==='en'
      ? 'The letter pair is broadly neutral in demand.'
      : 'Буквенная пара в целом нейтральна по спросу.';
  }

  let digitText;
  if(digit==='1' || digit==='7'){
    digitText=lang==='en'?'Digit '+digit+' has above-average demand.':'Цифра '+digit+' относится к более востребованным.';
  }else if(digit==='5'){
    digitText=lang==='en'?'Digit 5 is relatively attractive.':'Цифра 5 имеет спрос выше среднего.';
  }else if(digit==='8' || digit==='9'){
    digitText=lang==='en'?'Digit '+digit+' has relatively weak demand in this format.':'Цифра '+digit+' имеет сравнительно слабый спрос в таком формате.';
  }else if(digit==='2' && repeated){
    digitText=lang==='en'
      ? 'Digit 2 fits the repeated letters and reads naturally as “two '+a.toUpperCase()+'s”.'
      : 'Цифра 2 уместна рядом с повтором и читается как «два '+a.toUpperCase()+'».';
  }else{
    digitText=lang==='en'?'The ending digit is broadly neutral.':'Цифра в конце в целом нейтральна.';
  }

  payload.factors=lang==='en'
    ? [
        {title:'Scarcity',text:'Three characters remain scarce, but composition quality still matters.'},
        {title:'Letter quality',text:letterText},
        {title:'Digit demand',text:digitText}
      ]
    : [
        {title:'Редкость',text:'Три символа остаются редким форматом, но качество состава тоже влияет на цену.'},
        {title:'Качество букв',text:letterText},
        {title:'Спрос на цифру',text:digitText}
      ];

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

  await v23Handler(req,shadow);

  for(const [name,value] of Object.entries(headers)) res.setHeader(name,value);
  res.setHeader('X-Sova-Engine-Version',ENGINE_VERSION);

  if(payload && typeof payload==='object'){
    const username=normalizeUsername(req.body?.username);
    const platform=String(req.body?.platform||'instagram').toLowerCase()==='tiktok'?'tiktok':'instagram';
    const lang=String(req.body?.lang||'ru').toLowerCase()==='en'?'en':'ru';
    payload={...payload,engineVersion:ENGINE_VERSION};
    if(statusCode===200 && platform==='instagram') payload=tuneThreeCharMixed(payload,username,lang);
  }

  if(payload!==undefined) return res.status(statusCode).json(payload);
  if(ended) return res.status(statusCode).end();
  return res.status(500).json({error:'Valuation wrapper did not receive a response.'});
}
