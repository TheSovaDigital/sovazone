import baseHandler from './username-value.js';

const ENGINE_VERSION = 'instagram-v2.2';

function normalizeUsername(value){
  let v=String(value||'').trim();
  v=v.replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i,'');
  v=v.replace(/^@/,'').split(/[/?#]/)[0].trim();
  return v;
}

function digitTier(digit){
  if(digit==='7' || digit==='1') return 'strong';
  if(digit==='5') return 'good';
  if(digit==='8' || digit==='9') return 'weak';
  if(digit==='3' || digit==='4' || digit==='6') return 'neutral';
  if(digit==='2') return 'context';
  return 'neutral';
}

function tuneThreeCharMixed(payload,username,lang){
  const lower=username.toLowerCase();
  const m=lower.match(/^([a-z])([a-z])(\d)$/);
  if(!m) return payload;

  const a=m[1], b=m[2], digit=m[3];
  const repeatedLetters=a===b;
  const tier=digitTier(digit);

  let min=1000, max=2500, score=62;

  if(tier==='strong'){
    min=1500; max=3500; score=70;
  }else if(tier==='good'){
    min=1300; max=3000; score=66;
  }else if(tier==='weak'){
    min=1000; max=2000; score=56;
  }else if(tier==='context' && repeatedLetters){
    min=1500; max=3500; score=69;
  }else if(tier==='context'){
    min=1100; max=2600; score=61;
  }

  payload.priceMin=min;
  payload.priceMax=max;
  payload.qualityScore=score;
  payload.liquidity='medium';
  payload.liquidityLabel=lang==='en'?'Medium':'Средняя';
  payload.category=lang==='en'?'Short mixed username':'Короткий смешанный username';
  payload.categoryCode='short';

  const digitText = tier==='strong'
    ? (lang==='en'?'The ending digit has above-average demand in this format.':'Цифра в конце имеет повышенный спрос для такого формата.')
    : tier==='good'
      ? (lang==='en'?'The ending digit is relatively attractive and supports demand.':'Цифра в конце относится к более привлекательным и поддерживает спрос.')
      : tier==='weak'
        ? (lang==='en'?'The ending digit has relatively weak demand and does not add a premium.':'Цифра в конце имеет сравнительно низкий спрос и не даёт премии.')
        : tier==='context' && repeatedLetters
          ? (lang==='en'?'Digit 2 fits the repeated-letter pattern and reads naturally as “two '+a.toUpperCase()+'s”.':'Цифра 2 уместна рядом с повторяющимися буквами и читается как «два '+a.toUpperCase()+'».')
          : (lang==='en'?'The ending digit is broadly neutral in this format.':'Цифра в конце в таком формате в целом нейтральна.');

  payload.factors = lang==='en'
    ? [
        {title:'Scarcity',text:'A clean 3-character username has strong baseline scarcity.'},
        {title:repeatedLetters?'Pattern':'Structure',text:repeatedLetters?'The repeated letters improve memorability.':'The two-letter + digit structure is compact and easy to read.'},
        {title:'Digit demand',text:digitText}
      ]
    : [
        {title:'Редкость',text:'Чистый username из 3 символов имеет высокую базовую редкость.'},
        {title:repeatedLetters?'Паттерн':'Структура',text:repeatedLetters?'Повтор букв повышает запоминаемость.':'Формат две буквы + цифра остаётся компактным и читаемым.'},
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

  await baseHandler(req,shadow);

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
