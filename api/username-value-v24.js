const buckets = globalThis.__sovaValuationBucketsV31 || (globalThis.__sovaValuationBucketsV31 = new Map());
const valuationCache = globalThis.__sovaValuationCacheV31 || (globalThis.__sovaValuationCacheV31 = new Map());

const ENGINE_VERSION = 'instagram-v3.1';

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
You are the SovaZone Username Valuation engine, version 3.1. Estimate the standalone resale value of a social-media username using the owner's real-market pricing logic. This is an informed valuation range, not a guaranteed sale price.

IMPORTANT CALIBRATION RULE
- All price examples below are calibration evidence, NOT direct lookup prices.
- NEVER return a price merely because the evaluated username exactly matches an example.
- Always estimate independently from scarcity, structure, semantics, buyer demand and the full set of comparable examples.
- Historical sales are evidence, not the current asking/market value. Example: volk sold for $13,500 historically, but current owner valuation is around $15,000-$20,000.

ABSOLUTE INSTAGRAM SCARCITY FLOORS
- Any valid 1-character username using Latin letters, digits, dot or underscore: at least $50,000. Strong cases may be $50,000+.
- Any 2-character username: at least $15,000.
- Any 3-character username: at least $1,500.
- Any 4-character username: at least $500.
- These floors apply even with dot/underscore. q_9 is still at least $1,500; q_9a is still about the $500 floor.
- For 5+ characters there is no scarcity floor. Meaningless random strings are normally $0.

DOT / UNDERSCORE
- For 1-4 chars, separators reduce visual quality and liquidity but never erase the scarcity floor.
- For 5+ chars they heavily reduce value. hello around $20k-$30k versus hel_lo/hel.lo around $100-$300. pricheska around $400-$800 versus pri_cheska around $0-$50. Random qz_xvna is $0.

LETTER DEMAND
- Strong letters: A, X, S, Z.
- Weak letters: B, D, J, Q, U, Y.
- Other Latin letters are medium.
- This is only a base tendency. Strong semantics/patterns can dominate it. qqq can still be valuable.

DIGIT DEMAND AND CONTEXT
- Base strong digits: 0,1,5,7. Medium: 2,3,4,6. Weak: 8,9.
- Context overrides base rank when meaningful: aa2/kk2 gets a strong 2-context boost; aaa3 gets a 3-context boost; oo0 gets a visual boost; one1 is strong; two2 is stronger than two1.
- One digit position matters mildly: letters+digit usually best, digit+letters slightly weaker, digit in the middle slightly weaker again. Example: aa1 $2,000-$3,000; 1aa about $1,800-$2,700; a1a about $1,700-$2,600.
- With two digits, attractiveness order: 1a1 > a11 > 11a > 17a > a17 > 1a7.

NUMERIC CALIBRATION
- Do not treat all 3-digit usernames near the $1,500 floor. Numeric pattern quality can dominate scarcity.
- Current owner calibration: 111 = $50,000+; 777 = $50,000+; 000 is a theoretical/exclusive $50,000+ reference (not a normal available comparable); 555 = $10,000-$15,000; 123 = $10,000-$15,000; 404 = $10,000-$20,000; 007 = $5,000-$10,000.
- General 3-digit attractiveness: 777 > 404 > 111 > 000 > 555 > 123 > 321 > 101 > 707 > 789 > 928, but the current price calibrations above take precedence where they refine the old ordering.
- Cultural-code order: 404 > 007 > 666 > 100 > 999 > 888 > 200 > 911 > 420.
- 4-digit order: 1111 > 0000 > 7777 > 5555 > 1000 > 1001 > 1234 > 1221 > 2020 > 4321 > 7770 > 9284.
- Current calibration for 1111 is around $10,000-$20,000.
- Infer comparable numeric patterns from repetition, symmetry, sequences, digit quality and cultural meaning; do not memorize a lookup table.

LETTER / SHORT PATTERNS
- Four-letter pattern order: aaaa > aabb > aaab > abba > abab > baaa > abbb > abca > abcd.
- Three-letter pattern order: aaa > abc > qwe > aba > baa > aab > bqy.
- Two-char general order: aa > 11 > a1 > ab > 1a > qy > a_ > _a.
- Concrete 2-char order: aa > 11 > xx > zz > 77 > 00 > ss > kk > 55 > 88 > 99 > qy.
- Mixed 2-char order: a1 > a7 > x7 > k1 > z1 > a0 > 1a > 7x > 0a > q9 > 9q.
- One-char order: 1 > A > X > Z > 7 > S > K > 5 > 0 > Q > 9 > 8 > . > _.

FOUR-CHAR RANDOM CALIBRATION
- 4 chars always keep the $500 floor.
- azaz about $500-$800; bqdy $500-$700; xq7s $500-$600; q_9a about $500.
- Clean structure matters more than simply counting strong symbols.

FIVE-PLUS RANDOM / PATTERN
- Random 5+ with no meaning or collectible pattern: $0.
- aaaaa about $1,500-$3,000; aaabb/aabbb $100-$300; azaza $100-$200; abcde $0-$50; qwert $0-$100.
- Weak patterns do not justify large prices.

SEMANTIC WORDS: PERSONAL DEMAND FIRST
- Most buyers are ordinary people buying a username for themselves. Commercial meaning and brandability matter, but less than personal desirability.
- Evaluate whether people actually want to identify with the word: meaning, cultural association, length, memorability, visual form, language, size and quality of buyer pool, and scarcity.
- English examples by owner preference: King > Money > Cloud > Gold > Dream > Hello > Fast > Love > Work.
- English is often stronger due to a broader pool, but not automatically. A weak English term can be close to a comparable Russian transliteration.
- deer is a normal attractive English word; Russian transliteration olen can carry an insulting association and should be discounted.
- wolf is strong and broad. Current rough owner view: wolf around $15k-$25k; volk around $15k-$20k.

RUSSIAN / OTHER LANGUAGES
- Russian words in Latin transliteration are a real category and can sell near foreign pricing when attractive to Russian-speaking buyers.
- Historical evidence: volk sold for $13,500 to a buyer with surname Volkov. Do NOT output $13,500 as a lookup; current valuation is higher, around $15k-$20k.
- European-language words generally have broader buyer pools than comparable words from smaller Asian/Indian-language markets, but this is not rigid.

NAMES / SHORT FORMS / NICKNAMES
- Do not assume the full legal name is more valuable than a short form.
- Judge actual usage, length, attractiveness, number of potential bearers, international reach, gender mix and buyer demand.
- Male names are usually somewhat stronger because buyers are predominantly male, but this is only one factor.
- Owner order examples: Alex > Sasha > Alexander; Den > Denis > Denchik; Pavel > Pasha > Pashka; Stepa > Stepan > Stepashka; Kolyan > Kolya > Nikolay > Kolyanchik; Nastya > Anastasia > Nastenka.
- Current owner calibration: Alex around $10k-$15k.
- Diminutive/childish forms often lose value.
- Slastenka is below Nastya as a direct name but gains value from double meaning and use by girls named Nastya.

SURNAMES / DUAL MEANING
- A surname can have real personal demand from people who bear it. Evaluate both surname demand and standalone word meaning.
- Positive/neutral double meaning expands the buyer pool; negative secondary meaning can reduce value.
- Orel > Orlov because orel is a stronger standalone image. Baranov > Baran because baran has an insulting association while Baranov is a normal surname.

GEOGRAPHY AND UNIVERSAL BUYER DEMAND
- Country/city/resort status alone gives little automatic premium. Consider population, connected population, visibility, prestige, tourism and actual username demand.
- Apply Buyer Demand to ALL semantic categories: words, names, surnames, geography, professions, abbreviations, languages, cultural terms.
- Consider purchasing power, IT/digital/crypto/startup/social-media concentration, willingness to buy digital identity, Instagram activity and status value.
- A smaller but digitally affluent audience can create more demand than a larger wealthy audience concentrated in offline industries.

LEETSPEAK
- No fixed discount. Value = strength of underlying term × naturalness of substitution × length × visual quality. M4D can be strong; h0me is materially weaker.

RISKY / NEGATIVE TERMS
- Adult/explicit/drug terms may face platform restriction risk and lower realistic demand.
- Edgy identity terms such as killer/devil can still be highly attractive and expensive.

ABBREVIATIONS
- Universal abbreviations such as VIP, CEO, USA are strong. Brand-linked abbreviations such as BMW have less general independent demand.

GLOBAL BRANDS
- Exact matches for globally famous brands are special cases; do not show an ordinary free-market valuation.

LIQUIDITY
- Compute separately from price. High = strong on several dimensions with broad real buyer pool. Medium = clear value but narrower pool. Low = niche/scarcity value but buyer may take a long time to find.

PRICE RANGE DISCIPLINE
- Normal confident range: upper bound usually no more than 2x lower bound.
- Genuinely uncertain case: up to 3x.
- $20k-$30k is acceptable; $20k-$40k is normally too wide.
- For very expensive names with no defensible upper cap, prefer $40k+ or $50k+.
- Use rounded realistic values, not false precision.

TIKTOK
- TikTok is normally about 20%-30% of equivalent Instagram value unless platform-specific demand suggests otherwise.

CLASSIFICATION
Return one stable categoryCode from: short, english_word, russian_word_translit, other_language_word, first_name, surname, geography, numeric, pattern, leetspeak, abbreviation, random.

VALUATION METHOD
1. Normalize/classify.
2. Apply Instagram 1-4 character scarcity floors before discounts.
3. Evaluate semantic desirability and universal Buyer Demand.
4. Evaluate pattern, symbol quality and contextual interactions.
5. Use all calibration examples comparatively; never direct-lookup an example price.
6. Random 5+ is zero unless a real pattern/meaning supports value.
7. Keep price, quality and liquidity separate.
8. Give exactly three concise factors.
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
  const now=Date.now(), windowMs=60*60*1000, limit=30, ip=clientIp(req);
  let b=buckets.get(ip);
  if(!b || now-b.start>windowMs){ b={start:now,count:0}; buckets.set(ip,b); }
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

function shortFloor(length){
  if(length===1) return 50000;
  if(length===2) return 15000;
  if(length===3) return 1500;
  if(length===4) return 500;
  return 0;
}

function charTier(ch){
  if(/[a-z]/.test(ch)){
    if(STRONG_LETTERS.has(ch)) return 'strong';
    if(WEAK_LETTERS.has(ch)) return 'weak';
    return 'medium';
  }
  if(/\d/.test(ch)){
    if(STRONG_DIGITS.has(ch)) return 'strong';
    if(WEAK_DIGITS.has(ch)) return 'weak';
    return 'medium';
  }
  return 'separator';
}

function numericPatternSignals(lower){
  if(!/^\d+$/.test(lower)) return null;
  const chars=[...lower], n=chars.map(Number);
  const allSame=chars.every(c=>c===chars[0]);
  const palindrome=lower===chars.slice().reverse().join('');
  const ascending=n.length>1 && n.every((v,i)=>i===0 || v===n[i-1]+1);
  const descending=n.length>1 && n.every((v,i)=>i===0 || v===n[i-1]-1);
  const pairPrefix=chars.length>=2 && chars[0]===chars[1];
  const pairSuffix=chars.length>=2 && chars[chars.length-1]===chars[chars.length-2];
  const culturalCodes=new Set(['404','007','666','100','999','888','200','911','420']);
  return {allSame,palindrome,ascending,descending,pairPrefix,pairSuffix,culturalCode:culturalCodes.has(lower)?lower:null};
}

function formatSignals(username){
  const lower=username.toLowerCase(), chars=[...lower];
  const digits=chars.filter(c=>/\d/.test(c)), letters=chars.filter(c=>/[a-z]/.test(c)), tiers=chars.map(charTier);
  const repeatedBlock=chars.length>=4 && (()=>{ for(let size=1;size<=Math.floor(chars.length/2);size++){ if(chars.length%size) continue; const block=lower.slice(0,size); if(block.repeat(chars.length/size)===lower) return true; } return false; })();
  return {
    length:chars.length,
    allNumeric:/^\d+$/.test(lower),
    lettersOnly:/^[a-z]+$/.test(lower),
    mixedLettersDigits:/[a-z]/.test(lower)&&/\d/.test(lower),
    hasSeparator:/[._]/.test(lower),
    separatorFree:lower.replace(/[._]/g,''),
    sameChar:chars.length>1 && chars.every(c=>c===chars[0]),
    alternating:chars.length>=4 && chars.every((c,i)=>c===chars[i%2]),
    palindrome:chars.length>1 && lower===chars.slice().reverse().join(''),
    repeatedBlock,
    startsWithZero:/^0/.test(lower),
    uniqueChars:new Set(chars).size,
    digitCount:digits.length,
    letterCount:letters.length,
    strongSymbolCount:tiers.filter(x=>x==='strong').length,
    weakSymbolCount:tiers.filter(x=>x==='weak').length,
    numericPattern:numericPatternSignals(lower)
  };
}

function niceRound(n){
  n=Math.max(0,Number(n)||0);
  let step=10;
  if(n>=50000) step=5000;
  else if(n>=20000) step=1000;
  else if(n>=5000) step=500;
  else if(n>=1000) step=250;
  else if(n>=200) step=50;
  return Math.round(n/step)*step;
}

function localizedLiquidity(value,lang){
  if(lang==='en') return value[0].toUpperCase()+value.slice(1);
  return value==='high'?'Высокая':value==='medium'?'Средняя':'Низкая';
}

function specialBrandResponse(username,platform,lang){
  if(!GLOBAL_BRANDS.has(username.toLowerCase())) return null;
  return {
    username,platform,engineVersion:ENGINE_VERSION,priceMin:0,priceMax:0,openEnded:false,uncertain:true,specialCase:'global_brand',
    category:lang==='en'?'Special case — global brand':'Особый случай — глобальный бренд',categoryCode:'abbreviation',qualityScore:95,liquidity:'low',liquidityLabel:localizedLiquidity('low',lang),
    factors:lang==='en'
      ? [{title:'Special case',text:'Exact match for a globally famous brand.'},{title:'Market',text:'Not comparable with the ordinary free username market.'},{title:'Valuation',text:'A normal price range would be misleading.'}]
      : [{title:'Особый случай',text:'Точное совпадение со всемирно известным брендом.'},{title:'Рынок',text:'Нельзя корректно сравнивать с обычным свободным рынком username.'},{title:'Оценка',text:'Обычный ценовой диапазон здесь был бы вводящим в заблуждение.'}],
    disclaimer:lang==='en'?'Special-case classification: no ordinary market valuation is shown.':'Особый случай: обычная рыночная оценка не указывается.'
  };
}

function numericScore3(lower){
  if(!/^\d{3}$/.test(lower)) return null;
  const s=numericPatternSignals(lower), chars=[...lower];
  let score=0;
  const avgDigit=chars.reduce((acc,c)=>acc+(STRONG_DIGITS.has(c)?1:WEAK_DIGITS.has(c)?-1:0),0)/3;
  score+=avgDigit;
  if(s.allSame) score+=5;
  if(s.palindrome && !s.allSame) score+=2;
  if(s.ascending) score+=4;
  if(s.descending) score+=3.5;
  if(s.pairPrefix || s.pairSuffix) score+=1;
  if(s.allSame && ['1','7','0'].includes(chars[0])) score+=3;
  const cultureWeight={404:4,007:1,666:2.5,100:2,999:0.5,888:0.4,200:1.2,911:0.7,420:0.3};
  if(s.culturalCode) score+=cultureWeight[s.culturalCode]||0;
  return score;
}

function applyNumericPatternGuardrails(parsed,username,platform,lang){
  if(platform!=='instagram') return parsed;
  const lower=username.toLowerCase();
  if(/^\d{3}$/.test(lower)){
    const score=numericScore3(lower);
    let min,max,open=false;
    if(score>=8.5){ min=50000; max=50000; open=true; }
    else if(score>=6.15){ min=10000; max=20000; }
    else if(score>=4){ min=10000; max=15000; }
    else if(score>=2.5){ min=5000; max=10000; }
    else if(score>=1.5){ min=3000; max=6000; }
    else { min=1500; max=3500; }
    parsed.priceMin=min; parsed.priceMax=max; parsed.openEnded=open; parsed.uncertain=false; parsed.categoryCode='numeric';
    parsed.qualityScore=Math.max(Number(parsed.qualityScore)||0, open?92:score>=6.15?84:score>=4?78:score>=2.5?70:55);
    parsed.liquidity=open||score>=4?'high':score>=1.5?'medium':'low';
    parsed.factors=lang==='en'
      ? [{title:'Numeric scarcity',text:'Three-digit Instagram usernames are scarce; pattern quality determines the premium.'},{title:'Pattern strength',text:`The numeric structure scores ${score.toFixed(1)} on repetition, symmetry, sequence, digit quality and cultural meaning.`},{title:'Demand',text:parsed.liquidity==='high'?'Strong pattern creates broad collector/buyer demand.':parsed.liquidity==='medium'?'The pattern has clear but narrower demand.':'Scarcity exists, but the number pattern is comparatively weak.'}]
      : [{title:'Редкость цифр',text:'Трёхзначные Instagram username редки; премию определяет качество числового паттерна.'},{title:'Сила паттерна',text:`Структура набрала ${score.toFixed(1)} по повторам, симметрии, последовательности, качеству цифр и культурному смыслу.`},{title:'Спрос',text:parsed.liquidity==='high'?'Сильный паттерн создаёт широкий спрос.':parsed.liquidity==='medium'?'У паттерна есть заметный, но более узкий спрос.':'Редкость есть, но сам числовой паттерн сравнительно слабый.'}];
  }
  if(/^\d{4}$/.test(lower)){
    const chars=[...lower], allSame=chars.every(c=>c===chars[0]);
    if(allSame){
      const d=chars[0];
      if(d==='1'){ parsed.priceMin=10000; parsed.priceMax=20000; parsed.openEnded=false; parsed.uncertain=false; parsed.qualityScore=Math.max(Number(parsed.qualityScore)||0,92); parsed.liquidity='high'; }
      else if(d==='0'){ parsed.priceMin=Math.max(Number(parsed.priceMin)||0,9000); parsed.priceMax=Math.max(Number(parsed.priceMax)||0,18000); parsed.qualityScore=Math.max(Number(parsed.qualityScore)||0,90); }
      else if(d==='7'){ parsed.priceMin=Math.max(Number(parsed.priceMin)||0,7500); parsed.priceMax=Math.max(Number(parsed.priceMax)||0,15000); parsed.qualityScore=Math.max(Number(parsed.qualityScore)||0,86); }
      else if(d==='5'){ parsed.priceMin=Math.max(Number(parsed.priceMin)||0,5000); parsed.priceMax=Math.max(Number(parsed.priceMax)||0,10000); parsed.qualityScore=Math.max(Number(parsed.qualityScore)||0,82); }
      parsed.categoryCode='numeric';
    }
  }
  return parsed;
}

function applyShortGuardrails(parsed,username,lang){
  const lower=username.toLowerCase(), len=[...lower].length;
  if(len<1 || len>4) return parsed;
  const floor=shortFloor(len);
  parsed.priceMin=Math.max(floor,Number(parsed.priceMin)||0);
  parsed.priceMax=Math.max(parsed.priceMin,Number(parsed.priceMax)||0);
  const hasSeparator=/[._]/.test(lower), structural=['short','random','pattern','numeric'].includes(parsed.categoryCode);
  if(len===4 && structural && !/^\d{4}$/.test(lower)){
    if(hasSeparator){ parsed.priceMin=floor; parsed.priceMax=floor; }
    else if(parsed.categoryCode==='random'||parsed.categoryCode==='short'){
      const allLetters=/^[a-z]{4}$/.test(lower), repeating=/^(.)(.)\1\2$/.test(lower)||/^(.)(.)\2\1$/.test(lower);
      parsed.priceMax=Math.max(parsed.priceMin,Math.min(parsed.priceMax,repeating?800:allLetters?700:600));
    }
  }
  if(len===3 && structural && !/^\d{3}$/.test(lower) && (parsed.categoryCode==='random'||parsed.categoryCode==='short')){
    if(hasSeparator) parsed.priceMax=Math.max(floor,Math.min(parsed.priceMax,2000));
    else { const allWeak=[...lower].every(c=>WEAK_LETTERS.has(c)); parsed.priceMax=Math.max(parsed.priceMin,Math.min(parsed.priceMax,allWeak?2000:3500)); }
  }
  if(hasSeparator) parsed.qualityScore=Math.max(10,Math.round((Number(parsed.qualityScore)||45)-8));
  if(Array.isArray(parsed.factors)&&parsed.factors.length){
    parsed.factors[0]={title:lang==='en'?'Scarcity floor':'Минимум за редкость',text:lang==='en'?`${len}-character Instagram usernames keep at least $${floor.toLocaleString('en-US')} of scarcity value, including dot/underscore forms.`:`Instagram username длиной ${len} символа сохраняет минимум $${floor.toLocaleString('en-US')} за редкость, включая варианты с точкой или _.`};
  }
  return parsed;
}

function applyLongSeparatorGuardrails(parsed,username){
  const lower=username.toLowerCase(), len=[...lower].length;
  if(len<=4||!/[._]/.test(lower)) return parsed;
  if(parsed.categoryCode==='random'){ parsed.priceMin=0; parsed.priceMax=0; parsed.qualityScore=Math.min(Number(parsed.qualityScore)||0,10); parsed.liquidity='low'; return parsed; }
  const min=Number(parsed.priceMin)||0,max=Number(parsed.priceMax)||0;
  parsed.priceMin=Math.min(100,niceRound(min*0.015));
  parsed.priceMax=Math.min(300,Math.max(parsed.priceMin,niceRound(max*0.02)));
  parsed.qualityScore=Math.max(5,Math.round((Number(parsed.qualityScore)||45)-25)); parsed.liquidity='low';
  return parsed;
}

function applyPatternFivePlus(parsed,username){
  const lower=username.toLowerCase(), len=[...lower].length;
  if(len<5||/[._]/.test(lower)) return parsed;
  if(parsed.categoryCode==='random'){
    if(/^([a-z])\1{4}$/.test(lower)&&len===5){ parsed.priceMin=1500; parsed.priceMax=3000; parsed.categoryCode='pattern'; return parsed; }
    if(/^([a-z])\1\1([a-z])\2$/.test(lower)||/^([a-z])\1([a-z])\2\2$/.test(lower)){ parsed.priceMin=100; parsed.priceMax=300; parsed.categoryCode='pattern'; return parsed; }
    if(/^([a-z])([a-z])\1\2\1$/.test(lower)){ parsed.priceMin=100; parsed.priceMax=200; parsed.categoryCode='pattern'; return parsed; }
    if(lower==='qwert'){ parsed.priceMin=0; parsed.priceMax=100; parsed.categoryCode='pattern'; return parsed; }
    if(lower==='abcde'){ parsed.priceMin=0; parsed.priceMax=50; parsed.categoryCode='pattern'; return parsed; }
    parsed.priceMin=0; parsed.priceMax=0; parsed.qualityScore=Math.min(Number(parsed.qualityScore)||0,10); parsed.liquidity='low';
  }
  return parsed;
}

function enforceRangeDiscipline(parsed){
  let min=Math.max(0,Number(parsed.priceMin)||0),max=Math.max(0,Number(parsed.priceMax)||0);
  if(min>max){const t=min;min=max;max=t;}
  if(parsed.openEnded&&min>=40000){ parsed.priceMin=niceRound(min); parsed.priceMax=parsed.priceMin; return parsed; }
  if(min>0){ const mult=parsed.uncertain?3:2; max=Math.min(max,min*mult); if(min>=40000&&max>min*1.6){ parsed.openEnded=true; parsed.priceMin=niceRound(min); parsed.priceMax=parsed.priceMin; return parsed; } }
  parsed.priceMin=niceRound(min); parsed.priceMax=niceRound(Math.max(min,max));
  return parsed;
}

function applyGuardrails(parsed,username,platform,lang){
  parsed.username=username; parsed.platform=platform; parsed.engineVersion=ENGINE_VERSION;
  parsed.specialCase=parsed.specialCase==='global_brand'?'global_brand':'none'; parsed.openEnded=Boolean(parsed.openEnded); parsed.uncertain=Boolean(parsed.uncertain);
  if(parsed.specialCase==='global_brand') return parsed;
  let min=Math.max(0,Number(parsed.priceMin)||0),max=Math.max(0,Number(parsed.priceMax)||0); if(min>max){const x=min;min=max;max=x;} parsed.priceMin=min;parsed.priceMax=max;
  if(platform==='instagram'){
    parsed=applyNumericPatternGuardrails(parsed,username,platform,lang);
    parsed=applyShortGuardrails(parsed,username,lang);
    parsed=applyLongSeparatorGuardrails(parsed,username);
    parsed=applyPatternFivePlus(parsed,username);
  }
  parsed=enforceRangeDiscipline(parsed);
  parsed.qualityScore=Math.max(0,Math.min(100,Math.round(Number(parsed.qualityScore)||0)));
  if(!['low','medium','high'].includes(parsed.liquidity)) parsed.liquidity='low';
  parsed.liquidityLabel=localizedLiquidity(parsed.liquidity,lang);
  return parsed;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Sova-Engine-Version',ENGINE_VERSION);
  const origin=String(req.headers.origin||'');
  const allowedOrigins=new Set(['https://sovazone.com','https://www.sovazone.com']);
  if(allowedOrigins.has(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const body=req.body||{}; if(body.website) return res.status(400).json({error:'Invalid request'});
  const username=normalizeUsername(body.username),platform=String(body.platform||'instagram').toLowerCase()==='tiktok'?'tiktok':'instagram',lang=String(body.lang||'ru').toLowerCase()==='en'?'en':'ru';
  if(!username||username.length>30||!/^[A-Za-z0-9._]+$/.test(username)) return res.status(400).json({error:lang==='en'?'Invalid username format.':'Некорректный формат username.'});
  const brand=specialBrandResponse(username,platform,lang); if(brand) return res.status(200).json(brand);
  const cacheKey=`${ENGINE_VERSION}:${platform}:${lang}:${username.toLowerCase()}`; const cached=valuationCache.get(cacheKey); if(cached) return res.status(200).json(cached);
  if(rateLimited(req)) return res.status(429).json({error:lang==='en'?'Too many estimates. Try again later.':'Слишком много оценок. Попробуйте позже.'});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:lang==='en'?'Valuation service is not connected yet.':'Сервис оценки ещё не подключён.'});

  const schema={type:'object',additionalProperties:false,properties:{username:{type:'string'},platform:{type:'string',enum:['instagram','tiktok']},priceMin:{type:'integer',minimum:0},priceMax:{type:'integer',minimum:0},openEnded:{type:'boolean'},uncertain:{type:'boolean'},specialCase:{type:'string',enum:['none','global_brand']},category:{type:'string'},categoryCode:{type:'string',enum:['short','english_word','russian_word_translit','other_language_word','first_name','surname','geography','numeric','pattern','leetspeak','abbreviation','random']},qualityScore:{type:'integer',minimum:0,maximum:100},liquidity:{type:'string',enum:['low','medium','high']},factors:{type:'array',minItems:3,maxItems:3,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},text:{type:'string'}},required:['title','text']}},disclaimer:{type:'string'}},required:['username','platform','priceMin','priceMax','openEnded','uncertain','specialCase','category','categoryCode','qualityScore','liquidity','factors','disclaimer']};
  const signals=formatSignals(username);
  const requestBody={
    model:process.env.VALUATION_MODEL||'gpt-5.6-luna',store:false,reasoning:{effort:'none'},temperature:0,
    instructions:CALIBRATION+'\n'+languageRules(lang),
    input:`Evaluate @${username} for ${platform.toUpperCase()}.\nDeterministic format signals: ${JSON.stringify(signals)}\nThere is no direct anchor-price lookup. Estimate independently from all rules and calibration evidence. Return the SovaZone valuation range and stable classification. Use openEnded=true only for $40k+ / $50k+ style cases.`,
    max_output_tokens:700,text:{verbosity:'low',format:{type:'json_schema',name:'username_valuation_v31',strict:true,schema}}
  };
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(requestBody)});
    const data=await r.json();
    if(!r.ok){console.error('OpenAI valuation error',r.status,data?.error?.message||data);return res.status(502).json({error:lang==='en'?'Valuation service is temporarily unavailable.':'Сервис оценки временно недоступен.'});}
    const txt=outputText(data),parsed=applyGuardrails(JSON.parse(txt),username,platform,lang);
    valuationCache.set(cacheKey,parsed); if(valuationCache.size>5000){const first=valuationCache.keys().next().value;valuationCache.delete(first);}
    return res.status(200).json(parsed);
  }catch(e){console.error('username-value v3.1 error',e);return res.status(500).json({error:lang==='en'?'Could not complete the estimate.':'Не удалось выполнить оценку.'});}
}
