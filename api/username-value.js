const buckets = globalThis.__sovaValuationBuckets || (globalThis.__sovaValuationBuckets = new Map());

const ENGINE_VERSION = 'instagram-v2';

const OWNER_ANCHORS = {
  cat:[20000,30000], m8x:[1500,2000], '777':[50000,100000], aaaaa:[2000,3000], '88888':[1000,2000],
  home:[15000,30000], love:[15000,30000], cloud:[30000,50000], storm:[10000,20000], haus:[1000,2000],
  david:[6000,8000], alexander:[2500,3500], alex:[9000,12000], anna:[2000,3000], sofia:[2000,3000],
  petrov:[1500,2500], tv:[45000,55000], x7:[15000,20000], qqq:[10000,15000], '123':[20000,30000],
  car:[20000,30000], money:[50000,80000], hotel:[8000,12000], paris:[3000,5000], armenia:[1000,2000],
  ivan:[4000,6000], ahmed:[4000,7000], smith:[4000,6000], miller:[4000,6000], bella:[2500,3500],
  max:[10000,20000], one:[50000,80000], go:[20000,30000], ai:[20000,50000], vip:[20000,30000],
  xxx:[30000,50000], '999':[10000,20000], '007':[5000,10000], gold:[30000,50000], shop:[20000,30000],
  black:[30000,50000], berlin:[1000,2000], dubai:[20000,50000], john:[3000,5000], maria:[1500,2500],
  brown:[400,700], web:[5000,15000], app:[10000,20000], pro:[4000,6000], win:[30000,50000],
  red:[15000,30000], green:[4000,6000], king:[50000,80000], queen:[5000,15000], music:[10000,20000],
  crypto:[50000,80000], london:[4000,6000], tokyo:[2500,3500], leo:[10000,20000], sara:[1500,2500],
  johnson:[1500,2500], sex:[10000,20000], fun:[15000,30000], lux:[50000,80000], boss:[50000,80000],
  work:[10000,20000], fast:[15000,20000], blue:[2000,3000], apple:[50000,80000], doctor:[4000,6000],
  lawyer:[5000,10000], moscow:[5000,10000], yerevan:[500,1000], adam:[16000,24000], eva:[4000,6000],
  garcia:[750,1250], it:[20000,30000], '7x':[15000,20000], zzz:[10000,15000], '555':[10000,15000],
  job:[10000,20000], buy:[15000,20000], game:[20000,30000], pink:[5000,10000], water:[5000,10000],
  market:[5000,10000], rome:[2000,5000], monaco:[2000,5000], georgia:[1500,2500], mark:[5000,10000],
  daniel:[4000,6000], emma:[1500,2500], robert:[3000,5000], taylor:[2000,3000], wilson:[1000,2000],
  rrrrr:[1000,2000], sun:[15000,25000], '888':[10000,20000], top:[20000,30000], best:[20000,30000],
  phone:[5000,10000], dream:[10000,20000], mike:[5000,10000], alice:[2000,3000], madrid:[1000,2000]
};

const FIRST_NAME_ANCHORS = new Set(['david','alexander','alex','anna','sofia','ivan','ahmed','bella','max','john','maria','leo','sara','adam','eva','mark','daniel','emma','robert','mike','alice']);
const SURNAME_ANCHORS = new Set(['petrov','smith','miller','brown','johnson','garcia','taylor','wilson']);
const GEO_ANCHORS = new Set(['paris','armenia','berlin','dubai','london','tokyo','moscow','yerevan','rome','monaco','georgia','madrid']);

function anchorCategoryCode(username){
  const lower=username.toLowerCase();
  if(/^\d+$/.test(lower)) return new Set(lower).size===1 || lower.length<=3 ? 'numeric' : 'pattern';
  if(lower.length<=3) return 'short';
  if(FIRST_NAME_ANCHORS.has(lower)) return 'first_name';
  if(SURNAME_ANCHORS.has(lower)) return 'surname';
  if(GEO_ANCHORS.has(lower)) return 'geography';
  if(new Set(lower).size===1) return 'pattern';
  return 'english_word';
}

const CALIBRATION = `
You are the SovaZone Username Valuation engine, version 2. Estimate the value of a social-media username using the owner's pricing logic. There is no transparent liquid market, so this is an informed valuation range, not a market quote.

CORE INSTAGRAM LOGIC
- Clean 2-character username: never below about $15,000. Even mixed forms like x7 remain valuable. Quality can push much higher.
- Clean 3-character username: never below about $1,000. Strong words, abbreviations, patterns and digits can be far higher.
- Clean 4-character username: base floor about $100, but meaning/quality often dominates.
- Random 5+ character strings normally have little standalone resale value unless they are words, names, surnames, geography, highly memorable patterns, repeated characters, or culturally meaningful numeric forms.
- Usernames containing a dot or underscore have essentially no standalone resale value.
- English dictionary words are the strongest semantic category. Short universal/common words can be worth tens of thousands.
- Russian words written in Latin transliteration are a real semantic category and MUST NOT be mistaken for random strings. Examples of transliterated Russian forms include pricheska, shtopor, podlets, tekstura, koketka and sledopyt. Value them below equivalent high-demand English words unless global demand justifies otherwise.
- Words in European or regional languages can still have value but generally less than equivalent English words. Smaller-language/market demand generally means lower valuation.
- Names and surnames have value. Popular male names are generally more valuable than female names. Very common/global male first names can be $5k+; popular short forms can be much higher. Female names are often around $2k-$3k unless unusually strong/global/short.
- Surnames are usually below top first names, but globally common or strong surnames can reach several thousand.
- Geography depends on real global demand: major international hubs/tourism/wealth centers can be strong; smaller or less internationally demanded cities/countries are lower.
- Ordinary digits usually reduce broad-market value, but attractive number patterns can increase value dramatically. Numeric usernames can be substantially more attractive to Arab/Gulf buyers when the pattern is genuinely culturally attractive.
- Repeated characters/numbers are a distinct collectible category. Five repeated characters can still be valuable because supply is exceptionally scarce; character choice matters.
- Commercial meaning is secondary. Do NOT simply price a username high because a business might monetize the word.
- Leetspeak is discounted versus the clean word. Example: M4D evokes MAD but is worth less than MAD.
- TikTok valuation should normally be about 20%-30% of the equivalent Instagram valuation.
- Use rounded, realistic ranges. Do not create false precision.

CLASSIFICATION
Return one stable categoryCode from:
short, english_word, russian_word_translit, other_language_word, first_name, surname, geography, numeric, pattern, leetspeak, random.

LIQUIDITY
Return low, medium, or high. Liquidity means breadth of realistic buyer demand, not merely theoretical scarcity. A very rare random string can have low liquidity.

QUALITY SCORE
Return integer 0-100. Score visual cleanliness, memorability, scarcity, semantics, and breadth of demand together. Do not let commercial monetization alone inflate it.

VALUATION METHOD
1. Normalize and classify the username.
2. Use the supplied deterministic format signals.
3. Start from scarcity by clean length, then let semantic/global demand and pattern quality dominate where justified.
4. Compare to several owner anchors internally, not just one nearest example.
5. Return a conservative-to-realistic range, not an aspirational listing price.
6. Random 5+ character strings should normally stay low. Do not invent value from pronounceability alone.
7. Transliteration must be recognized when it clearly represents a Russian word.
8. Give exactly three short factors.
`;

function normalizeUsername(value){
  let v=String(value||'').trim();
  v=v.replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i,'');
  v=v.replace(/^@/,'').split(/[/?#]/)[0].trim();
  return v;
}

function clientIp(req){
  const f=req.headers['x-forwarded-for'];
  return String(Array.isArray(f)?f[0]:(f||req.socket?.remoteAddress||'unknown')).split(',')[0].trim();
}

function rateLimited(req){
  const now=Date.now(), windowMs=60*60*1000, limit=25, ip=clientIp(req);
  let b=buckets.get(ip);
  if(!b || now-b.start>windowMs){b={start:now,count:0};buckets.set(ip,b);}
  b.count++;
  if(buckets.size>2500){ for(const [k,v] of buckets){ if(now-v.start>windowMs) buckets.delete(k); } }
  return b.count>limit;
}

function outputText(data){
  for(const item of (data.output||[])) for(const part of (item.content||[])) if(part.type==='output_text' && part.text) return part.text;
  return '';
}

function languageRules(lang){
  return lang==='en'
    ? 'Return category, factor titles/text and disclaimer in concise natural English.'
    : 'Верни category, названия факторов, пояснения и disclaimer на коротком естественном русском языке.';
}

function formatSignals(username){
  const lower=username.toLowerCase();
  const chars=[...lower];
  const allNumeric=/^\d+$/.test(lower);
  const lettersOnly=/^[a-z]+$/.test(lower);
  const mixedLettersDigits=/[a-z]/.test(lower)&&/\d/.test(lower);
  const sameChar=chars.length>1 && chars.every(c=>c===chars[0]);
  const alternating=chars.length>=4 && chars.every((c,i)=>c===chars[i%2]);
  const repeatedBlock=chars.length>=4 && (() => {
    for(let size=1;size<=Math.floor(chars.length/2);size++){
      if(chars.length%size) continue;
      const block=lower.slice(0,size);
      if(block.repeat(chars.length/size)===lower) return true;
    }
    return false;
  })();
  return {
    length:chars.length,
    allNumeric,
    lettersOnly,
    mixedLettersDigits,
    sameChar,
    alternating,
    repeatedBlock,
    startsWithZero:/^0/.test(lower),
    uniqueChars:new Set(chars).size
  };
}

function niceRound(n){
  n=Math.max(0,Number(n)||0);
  let step=10;
  if(n>=20000) step=1000;
  else if(n>=5000) step=500;
  else if(n>=1000) step=250;
  else if(n>=200) step=50;
  return Math.round(n/step)*step;
}

function qualityFromAnchor(min,max,username){
  const mid=(min+max)/2;
  const len=username.length;
  let score=45;
  if(len===2) score=90;
  else if(len===3) score=78;
  else if(len===4) score=68;
  else if(len<=6) score=58;
  if(mid>=50000) score=Math.max(score,94);
  else if(mid>=20000) score=Math.max(score,86);
  else if(mid>=10000) score=Math.max(score,78);
  else if(mid>=5000) score=Math.max(score,68);
  return Math.min(99,score);
}

function liquidityFromAnchor(min,max){
  const mid=(min+max)/2;
  if(mid>=15000) return 'high';
  if(mid>=2500) return 'medium';
  return 'low';
}

function localizedLiquidity(value,lang){
  if(lang==='en') return value[0].toUpperCase()+value.slice(1);
  return value==='high'?'Высокая':value==='medium'?'Средняя':'Низкая';
}

function anchorResponse(username,platform,lang){
  if(platform!=='instagram') return null;
  const anchor=OWNER_ANCHORS[username.toLowerCase()];
  if(!anchor) return null;
  const [priceMin,priceMax]=anchor;
  const score=qualityFromAnchor(priceMin,priceMax,username);
  const liquidity=liquidityFromAnchor(priceMin,priceMax);
  return {
    username, platform, engineVersion:ENGINE_VERSION,
    priceMin, priceMax,
    category:lang==='en'?'Owner calibration anchor':'Калибровочный ориентир',
    categoryCode:anchorCategoryCode(username),
    qualityScore:score,
    liquidity,
    liquidityLabel:localizedLiquidity(liquidity,lang),
    factors:lang==='en'
      ? [{title:'Calibration',text:'Matches a SovaZone owner pricing anchor.'},{title:'Scarcity',text:`Clean ${username.length}-character handle.`},{title:'Demand',text:'Range reflects the owner pricing model.'}]
      : [{title:'Калибровка',text:'Совпадает с ценовым ориентиром SovaZone.'},{title:'Редкость',text:`Чистый username из ${username.length} символов.`},{title:'Спрос',text:'Диапазон соответствует ценовой модели владельца.'}],
    disclaimer:lang==='en'?'Indicative SovaZone estimate, not a guaranteed sale price.':'Ориентировочная оценка SovaZone, не гарантия цены сделки.'
  };
}

function applyGuardrails(parsed,username,platform,lang){
  parsed.username=username;
  parsed.platform=platform;
  parsed.engineVersion=ENGINE_VERSION;

  let min=Math.max(0,Number(parsed.priceMin)||0);
  let max=Math.max(0,Number(parsed.priceMax)||0);
  if(min>max){const x=min;min=max;max=x;}

  const cleanLength=username.length;
  const floor=platform==='instagram'
    ? (cleanLength===2?15000:cleanLength===3?1000:cleanLength===4?100:0)
    : (cleanLength===2?3000:cleanLength===3?200:cleanLength===4?20:0);

  if(floor){
    min=Math.max(min,floor);
    max=Math.max(max,min);
  }

  if(parsed.categoryCode==='random' && cleanLength>=5){
    const cap=platform==='instagram'?300:75;
    min=Math.min(min,cap);
    max=Math.min(Math.max(max,min),cap);
  }

  min=niceRound(min);
  max=niceRound(Math.max(max,min));

  parsed.priceMin=min;
  parsed.priceMax=max;
  parsed.qualityScore=Math.max(0,Math.min(100,Math.round(Number(parsed.qualityScore)||0)));
  if(!['low','medium','high'].includes(parsed.liquidity)) parsed.liquidity='low';
  parsed.liquidityLabel=localizedLiquidity(parsed.liquidity,lang);
  return parsed;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');

  const origin=String(req.headers.origin||'');
  const allowedOrigins=new Set(['https://sovazone.com','https://www.sovazone.com']);
  if(allowedOrigins.has(origin)){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
  }
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const body=req.body||{};
  if(body.website) return res.status(400).json({error:'Invalid request'});
  const username=normalizeUsername(body.username);
  const platform=String(body.platform||'instagram').toLowerCase()==='tiktok'?'tiktok':'instagram';
  const lang=String(body.lang||'ru').toLowerCase()==='en'?'en':'ru';

  if(!username || username.length>30 || !/^[A-Za-z0-9._]+$/.test(username)){
    return res.status(400).json({error:lang==='en'?'Invalid username format.':'Некорректный формат username.'});
  }

  if(/[._]/.test(username)){
    return res.status(200).json({
      username,platform,engineVersion:ENGINE_VERSION,priceMin:0,priceMax:0,
      category:lang==='en'?'Dot / underscore':'Точка / подчёркивание',
      categoryCode:'random',qualityScore:5,liquidity:'low',liquidityLabel:localizedLiquidity('low',lang),
      factors:lang==='en'
        ? [{title:'Format',text:'Dot or underscore removes standalone resale value.'},{title:'Scarcity',text:'Clean handles are valued much higher.'},{title:'Demand',text:'Broad buyer demand is very low.'}]
        : [{title:'Формат',text:'Точка или _ убирают самостоятельную ценность.'},{title:'Редкость',text:'Чистые username ценятся заметно выше.'},{title:'Спрос',text:'Широкий спрос покупателей очень низкий.'}],
      disclaimer:lang==='en'?'Indicative SovaZone estimate, not a guaranteed sale price.':'Ориентировочная оценка SovaZone, не гарантия цены сделки.'
    });
  }

  const anchor=anchorResponse(username,platform,lang);
  if(anchor) return res.status(200).json(anchor);

  if(rateLimited(req)) return res.status(429).json({error:lang==='en'?'Too many estimates. Try again later.':'Слишком много оценок. Попробуйте позже.'});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:lang==='en'?'Valuation service is not connected yet.':'Сервис оценки ещё не подключён.'});

  const schema={
    type:'object',additionalProperties:false,
    properties:{
      username:{type:'string'},
      platform:{type:'string',enum:['instagram','tiktok']},
      priceMin:{type:'integer',minimum:0},
      priceMax:{type:'integer',minimum:0},
      category:{type:'string'},
      categoryCode:{type:'string',enum:['short','english_word','russian_word_translit','other_language_word','first_name','surname','geography','numeric','pattern','leetspeak','random']},
      qualityScore:{type:'integer',minimum:0,maximum:100},
      liquidity:{type:'string',enum:['low','medium','high']},
      factors:{type:'array',minItems:3,maxItems:3,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},text:{type:'string'}},required:['title','text']}},
      disclaimer:{type:'string'}
    },
    required:['username','platform','priceMin','priceMax','category','categoryCode','qualityScore','liquidity','factors','disclaimer']
  };

  const signals=formatSignals(username);
  const requestBody={
    model:process.env.VALUATION_MODEL||'gpt-5.6-luna',
    store:false,
    reasoning:{effort:'low'},
    instructions:CALIBRATION+'\n'+languageRules(lang),
    input:`Evaluate @${username} for ${platform.toUpperCase()}.
Deterministic format signals: ${JSON.stringify(signals)}
Return the SovaZone valuation range and stable classification.`,
    max_output_tokens:600,
    text:{verbosity:'low',format:{type:'json_schema',name:'username_valuation_v2',strict:true,schema}}
  };

  try{
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify(requestBody)
    });
    const data=await r.json();
    if(!r.ok){
      console.error('OpenAI valuation error',r.status,data?.error?.message||data);
      return res.status(502).json({error:lang==='en'?'Valuation service is temporarily unavailable.':'Сервис оценки временно недоступен.'});
    }
    const txt=outputText(data);
    const parsed=JSON.parse(txt);
    return res.status(200).json(applyGuardrails(parsed,username,platform,lang));
  }catch(e){
    console.error('username-value error',e);
    return res.status(500).json({error:lang==='en'?'Could not complete the estimate.':'Не удалось выполнить оценку.'});
  }
}
