const ENGINE_VERSION='telegram-v1.0';
const buckets=globalThis.__sovaTelegramValuationBuckets||(globalThis.__sovaTelegramValuationBuckets=new Map());
const valuationCache=globalThis.__sovaTelegramValuationCache||(globalThis.__sovaTelegramValuationCache=new Map());
const fxCache=globalThis.__sovaTonUsdCache||(globalThis.__sovaTonUsdCache={rate:1.42,at:0,source:'fallback'});

const GLOBAL_BRANDS=new Set(['apple','nike','tesla','google','amazon','microsoft','instagram','facebook','tiktok','adidas','cocacola','samsung','youtube','netflix','spotify','bmw','mercedes','porsche','ferrari','gucci','chanel','rolex','nvidia','openai','mastercard']);

const MARKET_EVIDENCE=`
You classify Telegram usernames for the SovaZone valuation engine. You do NOT set the final price. Return semantic category, demand score, quality score, liquidity and exactly three concise factors.

The backend has a cleaned Fragment market layer from 15,626 historical sales. Treat sale prices as evidence, never ground truth.
- 73.3% of raw sales were classified as technical/floor candidates. Very cheap purchases often reflect NFT conversion or low-information transactions and do not imply intrinsic resale value.
- Frequent exact-price clusters are downweighted rather than treated as independent market prices.
- 4-character clean collectible usernames are structurally scarce: the cleaned market has a strong cluster around 5,050 TON and a clean-market median around 5,923 TON. Four characters therefore deserve a structural premium even when the string is weak.
- For 5+ characters, ordinary clean-market sales are concentrated around roughly 120-150 TON, but meaningless/random strings can have effectively no standalone resale value despite technical NFT-conversion purchases.
- High statistical outliers were quarantined and their NFT transfer histories checked. Do not use suspicious or unverified headline sales as direct calibration.
- Examples with enough transfer history and no ownership cycle detected include trading 51,660 TON, monkey 26,686, white 8,105, moonbirds 7,500, glock 5,000, princess 4,166, phoenix 3,801, brand 3,000 and amazing 2,222. These show that genuinely attractive terms can trade far above ordinary medians, but a single transaction is not a fixed current value.
- Examples such as weird 42,000 and jason 20,000 had ownership cycles near the recorded sale and must not be used as trusted price anchors. Other very large early sales without enough transfer history are also not trusted anchors.

DEMAND SCORE
Score standalone buyer demand from 0 to 100. It should measure how many real Telegram users/businesses would independently want the exact username, not how much one bidder once paid.
0-20: random or almost no identity demand.
21-40: weak/niche term.
41-55: ordinary meaningful word/name with a limited buyer pool.
56-70: useful, memorable term or common identity.
71-84: attractive broad word/name/category.
85-91: very strong international term.
92-96: rare premium term with broad buyer demand.
97-100: exceptional universal identity term; use very sparingly.

RULES
- English generally has broader demand, but personal identity demand matters more than language alone.
- Russian transliterations, names, surnames, geography and other languages can be valuable when the real buyer pool is strong.
- A short full word is usually stronger than a random string of the same length.
- Diminutives, awkward transliterations and weak long phrases should be discounted.
- Repetition and visually clean patterns can create collectible demand even without dictionary meaning.
- Underscores are not comparable to the clean Fragment collectible dataset and should receive a very low demand score unless there is extraordinary reason.
- Globally famous trademarks are special cases and should not receive an ordinary free-market score.
- Do not copy any historical sale price into the score.
`;

function normalizeUsername(value){
  let v=String(value||'').trim();
  v=v.replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me|fragment\.com\/username)\//i,'');
  v=v.replace(/^@/,'').split(/[/?#]/)[0].trim();
  return v;
}

function clientIp(req){
  const f=req.headers['x-forwarded-for'];
  return String(Array.isArray(f)?f[0]:(f||req.socket&&req.socket.remoteAddress||'unknown')).split(',')[0].trim();
}

function rateLimited(req){
  const now=Date.now(),windowMs=60*60*1000,limit=30,ip=clientIp(req);
  let b=buckets.get(ip);
  if(!b||now-b.start>windowMs){b={start:now,count:0};buckets.set(ip,b);}
  b.count++;
  if(buckets.size>2500){for(const [k,v] of buckets){if(now-v.start>windowMs)buckets.delete(k);}}
  return b.count>limit;
}

function outputText(data){
  if(data&&typeof data.output_text==='string'&&data.output_text)return data.output_text;
  for(const item of (data&&data.output||[]))for(const part of (item.content||[]))if(part.type==='output_text'&&part.text)return part.text;
  return '';
}

function niceTon(n){
  n=Math.max(0,Number(n)||0);
  let step=5;
  if(n>=20000)step=1000;
  else if(n>=5000)step=250;
  else if(n>=1000)step=100;
  else if(n>=200)step=25;
  else if(n>=50)step=10;
  return Math.round(n/step)*step;
}

function niceUsd(n){
  n=Math.max(0,Number(n)||0);
  let step=10;
  if(n>=50000)step=5000;
  else if(n>=20000)step=1000;
  else if(n>=5000)step=500;
  else if(n>=1000)step=250;
  else if(n>=200)step=50;
  return Math.round(n/step)*step;
}

async function tonUsdRate(){
  const now=Date.now();
  if(now-fxCache.at<30*60*1000&&fxCache.rate>0)return fxCache;
  const urls=[
    ['https://api.coingecko.com/api/v3/simple/price?ids=gram&vs_currencies=usd','gram'],
    ['https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd','the-open-network']
  ];
  for(const [url,key] of urls){
    try{
      const r=await fetch(url,{headers:{Accept:'application/json'}});
      if(!r.ok)continue;
      const data=await r.json();
      const rate=Number(data&&data[key]&&data[key].usd);
      if(Number.isFinite(rate)&&rate>0){fxCache.rate=rate;fxCache.at=now;fxCache.source='coingecko';return fxCache;}
    }catch{}
  }
  fxCache.at=now;fxCache.source='fallback';
  return fxCache;
}

function baseBand(score){
  score=Math.max(0,Math.min(100,Number(score)||0));
  if(score<=20)return [0,20];
  if(score<=35)return [20,80];
  if(score<=45)return [50,150];
  if(score<=55)return [80,250];
  if(score<=65)return [120,500];
  if(score<=75)return [250,1000];
  if(score<=84)return [500,2500];
  if(score<=90)return [1000,5000];
  if(score<=95)return [2500,10000];
  if(score<=98)return [5000,18000];
  return [10000,30000];
}

function lengthFactor(len){
  if(len<=5)return 1.25;
  if(len===6)return 1.15;
  if(len===7)return 1;
  if(len===8)return .9;
  if(len===9)return .8;
  if(len===10)return .7;
  return .6;
}

function categoryFactor(code){
  if(code==='abbreviation')return 1.25;
  if(code==='english_word')return 1.15;
  if(code==='first_name'||code==='geography')return 1;
  if(code==='russian_word_translit'||code==='surname')return .9;
  if(code==='other_language_word')return .85;
  if(code==='leetspeak')return .75;
  return 1;
}

function patternBand(username,score){
  const s=username.toLowerCase(),len=s.length;
  if(len<5)return null;
  if(/^([a-z0-9])\1+$/.test(s)){
    if(len===5)return [500,3000];
    return [200,1200];
  }
  if(len<=7&&s===s.split('').reverse().join('')&&new Set(s).size<=3)return [250,1500];
  if(len<=7&&new Set(s).size<=Math.max(2,Math.floor(len/2))&&score>=45)return [150,1000];
  return null;
}

function telegramRange(username,classification){
  const lower=username.toLowerCase(),len=lower.length,score=Number(classification.demandScore)||0,code=classification.categoryCode;
  if(lower.includes('_'))return {min:0,max:20,note:'underscore'};

  if(len===4){
    if(score<=45)return {min:5000,max:6500,note:'four-char-floor'};
    if(score<=65)return {min:5000,max:8000,note:'four-char-floor'};
    if(score<=80)return {min:5500,max:10000,note:'four-char-premium'};
    if(score<=88)return {min:6500,max:14000,note:'four-char-premium'};
    if(score<=94)return {min:8000,max:20000,note:'four-char-premium'};
    return {min:10000,max:30000,note:'four-char-premium'};
  }

  if(code==='random'&&score<=25)return {min:0,max:0,note:'random'};
  const p=patternBand(lower,score);
  if(p&&['pattern','random'].includes(code))return {min:p[0],max:p[1],note:'pattern'};

  let [min,max]=baseBand(score);
  const mult=lengthFactor(len)*categoryFactor(code);
  min=niceTon(min*mult);max=niceTon(max*mult);
  if(min>0&&max>min*3)max=niceTon(min*3);
  return {min,max:Math.max(min,max),note:'semantic'};
}

function localizedLiquidity(value,lang){
  if(lang==='en')return value[0].toUpperCase()+value.slice(1);
  return value==='high'?'Высокая':value==='medium'?'Средняя':'Низкая';
}

function brandResponse(username,lang,rate){
  const lower=username.toLowerCase();
  if(!GLOBAL_BRANDS.has(lower))return null;
  return {username,platform:'telegram',engineVersion:ENGINE_VERSION,priceMin:0,priceMax:0,priceMinTon:0,priceMaxTon:0,tonUsdRate:rate,openEnded:false,uncertain:true,specialCase:'global_brand',category:lang==='en'?'Global trademark':'Глобальный товарный знак',categoryCode:'special',qualityScore:95,liquidity:'low',liquidityLabel:localizedLiquidity('low',lang),factors:lang==='en'?[{title:'Trademark',text:'An exact global trademark is not treated as an ordinary freely tradable username.'},{title:'Market evidence',text:'Headline Fragment transactions for famous brands are not used as normal comparables.'},{title:'Risk',text:'Legal, platform and buyer-specific factors make a generic market estimate misleading.'}]:[{title:'Товарный знак',text:'Точное совпадение с глобальным брендом не оценивается как обычный свободно торгуемый username.'},{title:'Данные рынка',text:'Громкие сделки Fragment с известными брендами не используются как обычные аналоги.'},{title:'Риск',text:'Юридические, платформенные и индивидуальные факторы делают обычную рыночную оценку некорректной.'}],disclaimer:lang==='en'?'Special case: no ordinary SovaZone market range is shown.':'Особый случай: обычный рыночный диапазон SovaZone не показывается.'};
}

function applyRange(username,classification,lang,fx){
  const ton=telegramRange(username,classification);
  const minTon=niceTon(ton.min),maxTon=niceTon(ton.max);
  const minUsd=niceUsd(minTon*fx.rate),maxUsd=niceUsd(maxTon*fx.rate);
  const len=username.length;
  let factors=Array.isArray(classification.factors)?classification.factors.slice(0,3):[];
  if(len===4&&factors.length){
    factors[0]={title:lang==='en'?'Four-character scarcity':'Редкость 4 символов',text:lang==='en'?'Clean four-character collectible usernames have a strong Fragment scarcity floor; mass 5,050 TON sales are treated as structural evidence, not as semantic price truth.':'Чистые 4-символьные collectible username имеют сильный минимум редкости на Fragment; массовые сделки по 5 050 TON используются как структурный ориентир, а не как истинная цена смысла ника.'};
  }else if(ton.note==='random'&&factors.length){
    factors[0]={title:lang==='en'?'No standalone demand':'Нет самостоятельного спроса',text:lang==='en'?'Cheap Fragment purchases of meaningless names are treated mainly as NFT-conversion evidence, not resale value.':'Дешёвые покупки бессмысленных ников на Fragment учитываются прежде всего как оформление NFT, а не как их перепродажная стоимость.'};
  }
  while(factors.length<3)factors.push({title:lang==='en'?'Market factor':'Рыночный фактор',text:lang==='en'?'Included in the cleaned Fragment market model.':'Учтён в очищенной модели рынка Fragment.'});
  return {username,platform:'telegram',engineVersion:ENGINE_VERSION,priceMin:minUsd,priceMax:maxUsd,priceMinTon:minTon,priceMaxTon:maxTon,tonUsdRate:Number(fx.rate.toFixed(4)),tonUsdSource:fx.source,openEnded:false,uncertain:Boolean(classification.uncertain),specialCase:'none',category:classification.category,categoryCode:classification.categoryCode,qualityScore:Math.max(0,Math.min(100,Math.round(Number(classification.qualityScore)||0))),demandScore:Math.max(0,Math.min(100,Math.round(Number(classification.demandScore)||0))),liquidity:['low','medium','high'].includes(classification.liquidity)?classification.liquidity:'low',liquidityLabel:localizedLiquidity(classification.liquidity,lang),factors,disclaimer:lang==='en'?'Indicative SovaZone estimate based on a cleaned Fragment market model; historical sales are evidence, not guaranteed current prices.':'Ориентировочная оценка SovaZone по очищенной модели рынка Fragment; исторические сделки используются как данные, а не как гарантированная текущая цена.'};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Sova-Engine-Version',ENGINE_VERSION);
  const origin=String(req.headers.origin||'');
  if(origin==='https://sovazone.com'||origin==='https://www.sovazone.com'){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const body=req.body||{};
  const lang=String(body.lang||'ru').toLowerCase()==='en'?'en':'ru';
  if(body.website)return res.status(400).json({error:'Invalid request'});
  const username=normalizeUsername(body.username);
  if(!username||username.length>32||!/^[A-Za-z0-9_]+$/.test(username))return res.status(400).json({error:lang==='en'?'Invalid Telegram username format.':'Некорректный формат Telegram username.'});
  if(username.length<4)return res.status(400).json({error:lang==='en'?'Telegram collectible valuation currently supports usernames from 4 characters.':'Оценка collectible username Telegram сейчас поддерживает ники от 4 символов.'});

  const fx=await tonUsdRate();
  const brand=brandResponse(username,lang,fx.rate);
  if(brand)return res.status(200).json(brand);

  const cacheKey=`${ENGINE_VERSION}:${lang}:${username.toLowerCase()}:${Math.round(fx.rate*100)/100}`;
  const cached=valuationCache.get(cacheKey);
  if(cached)return res.status(200).json(cached);
  if(rateLimited(req))return res.status(429).json({error:lang==='en'?'Too many estimates. Try again later.':'Слишком много оценок. Попробуйте позже.'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:lang==='en'?'Valuation service is not connected yet.':'Сервис оценки ещё не подключён.'});

  const schema={type:'object',additionalProperties:false,properties:{category:{type:'string'},categoryCode:{type:'string',enum:['english_word','russian_word_translit','other_language_word','first_name','surname','geography','numeric','pattern','leetspeak','abbreviation','random']},demandScore:{type:'integer',minimum:0,maximum:100},qualityScore:{type:'integer',minimum:0,maximum:100},liquidity:{type:'string',enum:['low','medium','high']},uncertain:{type:'boolean'},factors:{type:'array',minItems:3,maxItems:3,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},text:{type:'string'}},required:['title','text']}}},required:['category','categoryCode','demandScore','qualityScore','liquidity','uncertain','factors']};
  const languageRule=lang==='en'?'Return category and factors in concise natural English.':'Верни category и факторы на коротком естественном русском языке.';
  const signals={length:username.length,hasUnderscore:username.includes('_'),allNumeric:/^\d+$/.test(username),lettersOnly:/^[a-z]+$/i.test(username),uniqueChars:new Set(username.toLowerCase()).size};
  const requestBody={model:process.env.VALUATION_MODEL||'gpt-5.6-luna',store:false,reasoning:{effort:'none'},temperature:0,instructions:MARKET_EVIDENCE+'\n'+languageRule,input:`Classify Telegram username @${username}. Deterministic signals: ${JSON.stringify(signals)}. Do not estimate price; only classify demand/quality.`,max_output_tokens:550,text:{verbosity:'low',format:{type:'json_schema',name:'telegram_username_classification_v1',strict:true,schema}}};
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(requestBody)});
    const data=await r.json();
    if(!r.ok){console.error('Telegram valuation OpenAI error',r.status,data&&data.error?data.error.message:data);return res.status(502).json({error:lang==='en'?'Valuation service is temporarily unavailable.':'Сервис оценки временно недоступен.'});}
    const txt=outputText(data);if(!txt)throw new Error('Empty model response');
    const parsed=applyRange(username,JSON.parse(txt),lang,fx);
    valuationCache.set(cacheKey,parsed);if(valuationCache.size>5000){const first=valuationCache.keys().next().value;valuationCache.delete(first);}
    return res.status(200).json(parsed);
  }catch(e){console.error('telegram-username-value error',e);return res.status(500).json({error:lang==='en'?'Could not complete the estimate.':'Не удалось выполнить оценку.'});}
}
