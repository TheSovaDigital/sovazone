const buckets = globalThis.__sovaValuationBucketsV32 || (globalThis.__sovaValuationBucketsV32 = new Map());
const valuationCache = globalThis.__sovaValuationCacheV32 || (globalThis.__sovaValuationCacheV32 = new Map());

const ENGINE_VERSION = 'instagram-v3.2';
const STRONG_LETTERS = new Set(['a','x','s','z']);
const WEAK_LETTERS = new Set(['b','d','j','q','u','y']);
const STRONG_DIGITS = new Set(['0','1','5','7']);
const WEAK_DIGITS = new Set(['8','9']);
const GLOBAL_BRANDS = new Set([
  'apple','nike','tesla','google','amazon','microsoft','instagram','facebook','tiktok',
  'adidas','cocacola','samsung','youtube','netflix','spotify','bmw','mercedes','porsche',
  'ferrari','gucci','chanel','rolex','nvidia','openai'
]);

const CALIBRATION = `
You are the SovaZone username valuation classifier. Estimate the standalone resale value of an Instagram username from real buyer demand, not an aspirational listing price.

IMPORTANT
- Examples below are calibration evidence, never direct lookup prices. Even if the exact evaluated username appears below, reason from all factors and estimate independently.
- Historical sale evidence is not a current fixed price. Example: volk sold historically for $13,500; current owner view is roughly $15,000-$20,000.
- Most buyers are individuals buying a username for themselves. Personal desirability and buyer-pool quality usually matter more than generic commercial brandability.

SCARCITY
- Instagram 1 character: absolute floor $50,000.
- Instagram 2 characters: absolute floor $15,000.
- Instagram 3 characters: absolute floor $1,500.
- Instagram 4 characters: absolute floor $500.
- Floors apply even with dot or underscore. q_9 is still at least $1,500; q_9a is around the $500 floor.
- For 5+ characters there is no scarcity floor. Meaningless random strings are normally $0.

DOT / UNDERSCORE
- At 1-4 chars separators reduce quality/liquidity but cannot remove the scarcity floor.
- At 5+ chars separators heavily reduce value: hello about $20k-$30k while hel_lo/hel.lo are around $100-$300; pricheska about $400-$800 while pri_cheska is around $0-$50; random qz_xvna is $0.

LETTERS / DIGITS
- Strong letters: A X S Z. Weak letters: B D J Q U Y. Others medium.
- Strong digits: 0 1 5 7. Weak digits: 8 9. Others medium/contextual.
- Context can dominate: aa2/kk2 gets a boost because 2 matches two repeated letters; aaa3 gets a 3-context boost; oo0 gets a strong visual boost; one1 is strong; two2 is stronger than two1.
- Position matters mildly: aa1 about $2k-$3k; 1aa about $1.8k-$2.7k; a1a about $1.7k-$2.6k.
- Two-digit structure order: 1a1 > a11 > 11a > 17a > a17 > 1a7.

SHORT PATTERNS
- 4-letter order: aaaa > aabb > aaab > abba > abab > baaa > abbb > abca > abcd.
- 3-letter order: aaa > abc > qwe > aba > baa > aab > bqy.
- 2-char general: aa > 11 > a1 > ab > 1a > qy > a_ > _a.
- Concrete 2-char: aa > 11 > xx > zz > 77 > 00 > ss > kk > 55 > 88 > 99 > qy.
- Mixed 2-char: a1 > a7 > x7 > k1 > z1 > a0 > 1a > 7x > 0a > q9 > 9q.
- 1-char: 1 > A > X > Z > 7 > S > K > 5 > 0 > Q > 9 > 8 > . > _.
- Weak 4-char examples: azaz about $500-$800, bqdy $500-$700, xq7s $500-$600, q_9a around $500.

5+ PATTERNS
- Random 5+ with no meaning or collectible pattern: $0.
- aaaaa about $1,500-$3,000.
- aaabb/aabbb about $100-$300.
- azaza about $100-$200.
- abcde about $0-$50.
- qwert about $0-$100.

WORDS / LANGUAGES
- Judge whether real people would want to identify with the word: meaning, cultural association, length, memorability, visual form, language, audience size and buyer quality.
- English often has a broader pool, but weak English does not automatically beat an attractive local word.
- Owner preference examples: King > Money > Cloud > Gold > Dream > Hello > Fast > Love > Work.
- wolf is strong and broad, roughly $15k-$25k; volk roughly $15k-$20k currently.
- deer is a normal attractive English word, while Russian transliteration olen can have an insulting association and should be discounted.
- Russian transliterations are a real semantic category and can sell close to foreign words when personally attractive to Russian-speaking buyers.
- European-language words generally have broader buyer pools than comparable words in smaller Asian/Indian-language markets, but demand is case-specific.

NAMES / SURNAMES
- Do not assume the full legal name is most valuable. Actual usage, length, attractiveness, number of bearers, international reach, gender mix and buyer demand matter.
- Buyers are predominantly male, so male names are usually somewhat stronger, but this is only one factor.
- Alex > Sasha > Alexander. Den > Denis > Denchik. Pavel > Pasha > Pashka. Stepa > Stepan > Stepashka. Kolyan > Kolya > Nikolay > Kolyanchik. Nastya > Anastasia > Nastenka.
- Alex current calibration is roughly $10k-$15k.
- Diminutive/childish forms often lose value.
- Slastenka is below Nastya as a direct name but gains demand from double meaning and use by girls named Nastya.
- Surname demand is real. Positive/neutral double meaning expands the buyer pool; negative secondary meaning can reduce it.
- Orel > Orlov because orel is a stronger standalone image. Baranov > Baran because baran has an insulting association while Baranov is a normal surname.

BUYER DEMAND
Apply this to ALL semantic categories: words, names, surnames, geography, professions, abbreviations, languages and cultural terms.
Consider audience size, purchasing power, IT/digital/crypto/startup/social-media concentration, willingness to buy digital identity, Instagram activity and status value. A smaller digitally affluent audience can create more real username demand than a larger wealthy audience concentrated in offline industries.

GEOGRAPHY
Population alone is not enough. Consider connected population, wealth, digital/IT affinity, visibility, tourism/prestige and actual demand. Country/city/resort status by itself gives little automatic premium.

LEETSPEAK / ABBREVIATIONS / RISK
- No fixed leetspeak discount: value depends on underlying term and how natural the substitution looks. M4D can be strong; h0me is much weaker.
- VIP, CEO and USA are strong universal abbreviations; BMW has less general independent demand.
- Explicit/drug terms can face platform-risk discounts. Edgy identity terms such as killer/devil can still be desirable and expensive.
- Exact matches for globally famous brands are special cases and should not receive an ordinary free-market range.

RANGE DISCIPLINE
- Confident normal range: upper bound usually no more than 2x lower bound.
- Genuinely uncertain case: up to 3x.
- $20k-$30k is acceptable; $20k-$40k normally is not.
- For very expensive usernames without a defensible upper cap, use $40k+ or $50k+.

CLASSIFICATION
Return categoryCode from: short, english_word, russian_word_translit, other_language_word, first_name, surname, geography, numeric, pattern, leetspeak, abbreviation, random.

LIQUIDITY
Compute separately from price. High = broad real buyer pool; medium = clear value but narrower pool; low = niche/scarcity value and potentially long sale time.

METHOD
1. Classify semantics and demand.
2. Estimate an Instagram-equivalent value first.
3. Use short scarcity, pattern, symbol quality, semantics and Buyer Demand together.
4. Use calibration examples comparatively, never as exact lookup answers.
5. Give exactly three concise factors.
`;

function normalizeUsername(value){
  let v=String(value||'').trim();
  v=v.replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i,'');
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
  for(const item of (data&&data.output||[])){
    for(const part of (item.content||[])){
      if(part.type==='output_text'&&part.text)return part.text;
    }
  }
  return '';
}

function languageRules(lang){
  return lang==='en'
    ? 'Return category, factor titles/text and disclaimer in concise natural English.'
    : 'Верни category, названия факторов, пояснения и disclaimer на коротком естественном русском языке.';
}

function shortFloor(len){
  if(len===1)return 50000;
  if(len===2)return 15000;
  if(len===3)return 1500;
  if(len===4)return 500;
  return 0;
}

function symbolTier(ch){
  if(/[a-z]/.test(ch)){
    if(STRONG_LETTERS.has(ch))return 1;
    if(WEAK_LETTERS.has(ch))return -1;
    return 0;
  }
  if(/\d/.test(ch)){
    if(STRONG_DIGITS.has(ch))return 1;
    if(WEAK_DIGITS.has(ch))return -1;
    return 0;
  }
  return -1;
}

function niceRound(n){
  n=Math.max(0,Number(n)||0);
  let step=10;
  if(n>=50000)step=5000;
  else if(n>=20000)step=1000;
  else if(n>=5000)step=500;
  else if(n>=1000)step=250;
  else if(n>=200)step=50;
  return Math.round(n/step)*step;
}

function localizedLiquidity(value,lang){
  if(lang==='en')return value[0].toUpperCase()+value.slice(1);
  return value==='high'?'Высокая':value==='medium'?'Средняя':'Низкая';
}

function numericSignals(lower){
  const chars=[...lower],nums=chars.map(Number);
  const allSame=chars.every(c=>c===chars[0]);
  const palindrome=lower===chars.slice().reverse().join('');
  const ascending=nums.length>1&&nums.every((v,i)=>i===0||v===nums[i-1]+1);
  const descending=nums.length>1&&nums.every((v,i)=>i===0||v===nums[i-1]-1);
  const pairPrefix=chars.length>=2&&chars[0]===chars[1];
  const pairSuffix=chars.length>=2&&chars[chars.length-1]===chars[chars.length-2];
  return {chars,allSame,palindrome,ascending,descending,pairPrefix,pairSuffix};
}

function numericScore3(lower){
  const s=numericSignals(lower),chars=s.chars;
  let score=chars.reduce((a,c)=>a+symbolTier(c),0)/3;
  if(s.allSame)score+=5;
  if(s.palindrome&&!s.allSame)score+=2;
  if(s.ascending)score+=4;
  if(s.descending)score+=3.5;
  if(s.pairPrefix||s.pairSuffix)score+=1;
  if(s.allSame&&['1','7','0'].includes(chars[0]))score+=3;
  const culture={'404':4,'007':1,'666':2.5,'100':2,'999':0.5,'888':0.4,'200':1.2,'911':0.7,'420':0.3};
  if(Object.prototype.hasOwnProperty.call(culture,lower))score+=culture[lower];
  return score;
}

function structuralResult(username,platform,lang){
  const lower=username.toLowerCase(),len=[...lower].length;
  const scale=platform==='tiktok'?0.25:1;
  function make(min,max,open,category,code,score,liq,factors){
    if(scale!==1){min=niceRound(min*scale);max=open?min:niceRound(max*scale);open=false;}
    return {username,platform,engineVersion:ENGINE_VERSION,priceMin:min,priceMax:max,openEnded:Boolean(open),uncertain:false,specialCase:'none',category,categoryCode:code,qualityScore:score,liquidity:liq,liquidityLabel:localizedLiquidity(liq,lang),factors,disclaimer:lang==='en'?'Indicative SovaZone estimate, not a guaranteed transaction price.':'Ориентировочная оценка SovaZone, не гарантия цены сделки.'};
  }

  if(/^\d{3}$/.test(lower)){
    const s=numericScore3(lower);let min,max,open=false,score,liq;
    if(s>=8.5){min=50000;max=50000;open=true;score=94;liq='high';}
    else if(s>=6.15){min=10000;max=20000;score=86;liq='high';}
    else if(s>=4){min=10000;max=15000;score=80;liq='high';}
    else if(s>=2.5){min=5000;max=10000;score=72;liq='medium';}
    else if(s>=1.5){min=3000;max=6000;score=64;liq='medium';}
    else{min=1500;max=3500;score=55;liq='low';}
    const factors=lang==='en'
      ? [{title:'Numeric scarcity',text:'Three-digit handles are scarce; pattern quality determines the premium.'},{title:'Pattern',text:'Repetition, symmetry, sequence, digit quality and cultural meaning are scored together.'},{title:'Demand',text:liq==='high'?'The number pattern has broad real buyer appeal.':liq==='medium'?'The pattern has clear but narrower demand.':'Scarcity remains, but the pattern itself is comparatively weak.'}]
      : [{title:'Редкость',text:'Трёхзначные ники редки; премию определяет качество числового паттерна.'},{title:'Паттерн',text:'Повторы, симметрия, последовательность, качество цифр и культурный смысл учитываются вместе.'},{title:'Спрос',text:liq==='high'?'У числового паттерна широкий реальный спрос.':liq==='medium'?'У паттерна заметный, но более узкий спрос.':'Редкость сохраняется, но сам паттерн сравнительно слабый.'}];
    return make(min,max,open,lang==='en'?'Numeric username':'Цифровой username','numeric',score,liq,factors);
  }

  if(/^\d{4}$/.test(lower)){
    const s=numericSignals(lower);
    if(s.allSame){
      let min=2500,max=5000,score=75;
      if(lower==='1111'){min=10000;max=20000;score=94;}
      else if(lower==='0000'){min=9000;max=18000;score=91;}
      else if(lower==='7777'){min=7500;max=15000;score=88;}
      else if(lower==='5555'){min=5000;max=10000;score=84;}
      const factors=lang==='en'
        ? [{title:'Scarcity',text:'Four-digit numeric usernames have standalone scarcity.'},{title:'Repetition',text:'Four identical digits create a strong collectible pattern.'},{title:'Demand',text:'Digit choice determines how wide the buyer pool is.'}]
        : [{title:'Редкость',text:'Четырёхзначные цифровые ники имеют самостоятельную редкость.'},{title:'Повтор',text:'Четыре одинаковые цифры создают сильный коллекционный паттерн.'},{title:'Спрос',text:'Выбор цифры определяет ширину аудитории покупателей.'}];
      return make(min,max,false,lang==='en'?'Numeric pattern':'Цифровой паттерн','numeric',score,min>=5000?'high':'medium',factors);
    }
  }

  if(len>=5&&!/[._]/.test(lower)&&/^[a-z]+$/.test(lower)){
    let min=null,max=null;
    if(len===5&&/^([a-z])\1{4}$/.test(lower)){min=1500;max=3000;}
    else if(len===5&&(/^([a-z])\1\1([a-z])\2$/.test(lower)||/^([a-z])\1([a-z])\2\2$/.test(lower))){min=100;max=300;}
    else if(len===5&&/^([a-z])([a-z])\1\2\1$/.test(lower)){min=100;max=200;}
    else if(lower==='qwert'){min=0;max=100;}
    else if(lower==='abcde'){min=0;max=50;}
    if(min!==null){
      const factors=lang==='en'
        ? [{title:'Pattern',text:'The repeated/keyboard structure creates some collectible value.'},{title:'Length',text:'At five or more characters, length alone does not create a price floor.'},{title:'Demand',text:'The pattern has a narrower buyer pool than a real word or name.'}]
        : [{title:'Паттерн',text:'Повторяющаяся или клавиатурная структура создаёт некоторую коллекционную ценность.'},{title:'Длина',text:'Начиная с пяти символов сама длина уже не создаёт ценовой минимум.'},{title:'Спрос',text:'У такого паттерна аудитория уже, чем у полноценного слова или имени.'}];
      return make(min,max,false,lang==='en'?'Rare pattern':'Редкий паттерн','pattern',min>=1000?60:35,'low',factors);
    }
  }
  return null;
}

function specialBrandResponse(username,platform,lang){
  if(!GLOBAL_BRANDS.has(username.toLowerCase()))return null;
  return {username,platform,engineVersion:ENGINE_VERSION,priceMin:0,priceMax:0,openEnded:false,uncertain:true,specialCase:'global_brand',category:lang==='en'?'Special case — global brand':'Особый случай — глобальный бренд',categoryCode:'abbreviation',qualityScore:95,liquidity:'low',liquidityLabel:localizedLiquidity('low',lang),factors:lang==='en'?[{title:'Special case',text:'Exact match for a globally famous brand.'},{title:'Market',text:'It is not comparable with the ordinary username resale market.'},{title:'Valuation',text:'A normal free-market range would be misleading.'}]:[{title:'Особый случай',text:'Точное совпадение со всемирно известным брендом.'},{title:'Рынок',text:'Его нельзя корректно сравнивать с обычным рынком перепродажи username.'},{title:'Оценка',text:'Обычный свободный ценовой диапазон здесь был бы вводящим в заблуждение.'}],disclaimer:lang==='en'?'Special-case classification: no ordinary market valuation is shown.':'Особый случай: обычная рыночная оценка не указывается.'};
}

function applyInstagramGuardrails(parsed,username,lang){
  const lower=username.toLowerCase(),len=[...lower].length,floor=shortFloor(len),hasSeparator=/[._]/.test(lower);
  let min=Math.max(0,Number(parsed.priceMin)||0),max=Math.max(0,Number(parsed.priceMax)||0);
  if(min>max){const t=min;min=max;max=t;}

  if(len<=4){
    min=Math.max(min,floor);max=Math.max(max,min);
    if(['random','short','pattern'].includes(parsed.categoryCode)){
      if(len===4){
        if(hasSeparator){min=floor;max=floor;}
        else if(parsed.categoryCode==='random'||parsed.categoryCode==='short'){
          const repeating=/^(.)(.)\1\2$/.test(lower)||/^(.)(.)\2\1$/.test(lower);
          max=Math.max(min,Math.min(max,repeating?800:700));
        }
      }
      if(len===3&&!/^\d{3}$/.test(lower)){
        if(hasSeparator)max=Math.max(min,Math.min(max,1750));
        else{
          const tiers=[...lower].map(symbolTier),avg=tiers.reduce((a,b)=>a+b,0)/tiers.length;
          max=Math.max(min,Math.min(max,avg<=-0.66?2000:avg>=0.66?3500:3000));
        }
      }
    }
    if(len===3&&/^([a-z])\1(\d)$/.test(lower)&&['short','random','pattern'].includes(parsed.categoryCode)){
      const m=lower.match(/^([a-z])\1(\d)$/),letter=m[1],digit=m[2],lt=symbolTier(letter),dt=symbolTier(digit);
      const context=digit==='2'?1:0;
      if(lt===1&&dt+context>=1){min=Math.max(min,2000);max=Math.max(min,Math.min(max||3000,3000));}
      else if(lt===0&&dt+context>=1){min=Math.max(min,1750);max=Math.max(min,Math.min(max||2800,3000));}
      else if(lt===-1&&dt+context>=1){min=Math.max(min,1500);max=Math.max(min,Math.min(max||2400,2500));}
    }
    if(hasSeparator)parsed.qualityScore=Math.max(10,Math.round((Number(parsed.qualityScore)||45)-8));
  }

  if(len>=5&&hasSeparator){
    if(parsed.categoryCode==='random'){
      min=0;max=0;parsed.qualityScore=Math.min(Number(parsed.qualityScore)||0,10);parsed.liquidity='low';
    }else{
      min=Math.min(100,niceRound(min*0.015));
      max=Math.min(300,Math.max(min,niceRound(max*0.02)));
      parsed.qualityScore=Math.max(5,Math.round((Number(parsed.qualityScore)||45)-25));parsed.liquidity='low';
    }
  }

  if(len>=5&&parsed.categoryCode==='random'&&!hasSeparator){min=0;max=0;parsed.qualityScore=Math.min(Number(parsed.qualityScore)||0,10);parsed.liquidity='low';}

  parsed.priceMin=min;parsed.priceMax=max;
  if(len<=4&&Array.isArray(parsed.factors)&&parsed.factors.length){
    parsed.factors[0]={title:lang==='en'?'Scarcity floor':'Минимум за редкость',text:lang==='en'?`${len}-character Instagram usernames retain at least $${floor.toLocaleString('en-US')} of scarcity value.`:`Instagram username длиной ${len} символа сохраняет минимум $${floor.toLocaleString('en-US')} за редкость.`};
  }
  return parsed;
}

function applyRange(parsed){
  let min=Math.max(0,Number(parsed.priceMin)||0),max=Math.max(0,Number(parsed.priceMax)||0);
  if(min>max){const t=min;min=max;max=t;}
  if(parsed.openEnded&&min>=40000){parsed.priceMin=niceRound(min);parsed.priceMax=parsed.priceMin;return parsed;}
  if(min>0){const mult=parsed.uncertain?3:2;max=Math.min(max,min*mult);}
  parsed.priceMin=niceRound(min);parsed.priceMax=niceRound(Math.max(min,max));
  return parsed;
}

function applyPlatform(parsed,username,platform,lang){
  parsed.username=username;parsed.platform=platform;parsed.engineVersion=ENGINE_VERSION;
  parsed.specialCase=parsed.specialCase==='global_brand'?'global_brand':'none';
  parsed.openEnded=Boolean(parsed.openEnded);parsed.uncertain=Boolean(parsed.uncertain);
  if(parsed.specialCase==='global_brand')return parsed;

  if(platform==='instagram')parsed=applyInstagramGuardrails(parsed,username,lang);
  else{
    const base=applyInstagramGuardrails({...parsed,platform:'instagram'},username,lang);
    base.priceMin=niceRound((Number(base.priceMin)||0)*0.25);
    base.priceMax=base.openEnded?base.priceMin:niceRound((Number(base.priceMax)||0)*0.25);
    base.openEnded=false;base.platform='tiktok';
    parsed=base;
  }
  parsed=applyRange(parsed);
  parsed.qualityScore=Math.max(0,Math.min(100,Math.round(Number(parsed.qualityScore)||0)));
  if(!['low','medium','high'].includes(parsed.liquidity))parsed.liquidity='low';
  parsed.liquidityLabel=localizedLiquidity(parsed.liquidity,lang);
  return parsed;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Sova-Engine-Version',ENGINE_VERSION);
  const origin=String(req.headers.origin||'');
  if(origin==='https://sovazone.com'||origin==='https://www.sovazone.com'){
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  }
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const body=req.body||{};
  if(body.website)return res.status(400).json({error:'Invalid request'});
  const username=normalizeUsername(body.username);
  const platform=String(body.platform||'instagram').toLowerCase()==='tiktok'?'tiktok':'instagram';
  const lang=String(body.lang||'ru').toLowerCase()==='en'?'en':'ru';
  if(!username||username.length>30||!/^[A-Za-z0-9._]+$/.test(username))return res.status(400).json({error:lang==='en'?'Invalid username format.':'Некорректный формат username.'});

  const brand=specialBrandResponse(username,platform,lang);
  if(brand)return res.status(200).json(brand);
  const structural=structuralResult(username,platform,lang);
  if(structural)return res.status(200).json(structural);

  const cacheKey=`${ENGINE_VERSION}:${platform}:${lang}:${username.toLowerCase()}`;
  const cached=valuationCache.get(cacheKey);
  if(cached)return res.status(200).json(cached);
  if(rateLimited(req))return res.status(429).json({error:lang==='en'?'Too many estimates. Try again later.':'Слишком много оценок. Попробуйте позже.'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:lang==='en'?'Valuation service is not connected yet.':'Сервис оценки ещё не подключён.'});

  const schema={type:'object',additionalProperties:false,properties:{username:{type:'string'},platform:{type:'string',enum:['instagram','tiktok']},priceMin:{type:'integer',minimum:0},priceMax:{type:'integer',minimum:0},openEnded:{type:'boolean'},uncertain:{type:'boolean'},specialCase:{type:'string',enum:['none','global_brand']},category:{type:'string'},categoryCode:{type:'string',enum:['short','english_word','russian_word_translit','other_language_word','first_name','surname','geography','numeric','pattern','leetspeak','abbreviation','random']},qualityScore:{type:'integer',minimum:0,maximum:100},liquidity:{type:'string',enum:['low','medium','high']},factors:{type:'array',minItems:3,maxItems:3,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},text:{type:'string'}},required:['title','text']}},disclaimer:{type:'string'}},required:['username','platform','priceMin','priceMax','openEnded','uncertain','specialCase','category','categoryCode','qualityScore','liquidity','factors','disclaimer']};

  const chars=[...username.toLowerCase()];
  const signals={length:chars.length,hasSeparator:/[._]/.test(username),allNumeric:/^\d+$/.test(username),lettersOnly:/^[a-z]+$/i.test(username),uniqueChars:new Set(chars).size,strongSymbols:chars.filter(c=>symbolTier(c)===1).length,weakSymbols:chars.filter(c=>symbolTier(c)===-1).length};
  const requestBody={model:process.env.VALUATION_MODEL||'gpt-5.6-luna',store:false,reasoning:{effort:'none'},temperature:0,instructions:CALIBRATION+'\n'+languageRules(lang),input:`Evaluate @${username}. First estimate its Instagram-equivalent value; backend handles TikTok scaling. Deterministic format signals: ${JSON.stringify(signals)}. Do not use any exact example as a lookup answer.`,max_output_tokens:700,text:{verbosity:'low',format:{type:'json_schema',name:'username_valuation_v32',strict:true,schema}}};

  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(requestBody)});
    const data=await r.json();
    if(!r.ok){console.error('OpenAI valuation error',r.status,data&&data.error?data.error.message:data);return res.status(502).json({error:lang==='en'?'Valuation service is temporarily unavailable.':'Сервис оценки временно недоступен.'});}
    const txt=outputText(data);
    if(!txt)throw new Error('Empty model response');
    const parsed=applyPlatform(JSON.parse(txt),username,platform,lang);
    valuationCache.set(cacheKey,parsed);
    if(valuationCache.size>5000){const first=valuationCache.keys().next().value;valuationCache.delete(first);}
    return res.status(200).json(parsed);
  }catch(e){console.error('username-value v3.2 error',e);return res.status(500).json({error:lang==='en'?'Could not complete the estimate.':'Не удалось выполнить оценку.'});}
}
