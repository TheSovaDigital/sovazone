const buckets = globalThis.__sovaValuationBucketsV40 || (globalThis.__sovaValuationBucketsV40 = new Map());
const valuationCache = globalThis.__sovaValuationCacheV40 || (globalThis.__sovaValuationCacheV40 = new Map());

const ENGINE_VERSION = 'instagram-v4.0';
const STRONG_LETTERS = new Set(['a','x','s','z']);
const WEAK_LETTERS = new Set(['b','d','j','q','u','y']);
const STRONG_DIGITS = new Set(['0','1','5','7']);
const WEAK_DIGITS = new Set(['8','9']);
const GLOBAL_BRANDS = new Set([
  'apple','nike','tesla','google','amazon','microsoft','instagram','facebook','tiktok',
  'adidas','cocacola','samsung','youtube','netflix','spotify','bmw','mercedes','porsche',
  'ferrari','gucci','chanel','rolex','nvidia','openai'
]);

// Reference bands are SovaZone calibration controls, not historical-sale lookups.
// They stabilise known semantic families while the model classifies unseen names/words.
const SEMANTIC_CALIBRATION_BANDS = Object.freeze({
  // Strong words / identity terms
  king:[50000,50000,true],
  money:[40000,60000],
  cloud:[30000,45000],
  gold:[25000,40000],
  dream:[22000,32000],
  hello:[20000,30000],
  fast:[15000,20000],
  love:[12000,18000],
  work:[10000,15000],
  wolf:[15000,25000],
  volk:[15000,20000],
  cat:[20000,30000],
  home:[15000,30000],
  storm:[10000,20000],
  black:[30000,50000],
  sun:[15000,25000],
  blue:[2000,3000],
  green:[4000,6000],
  doctor:[4000,6000],
  lawyer:[5000,10000],

  // Names: actual username demand can favour short/common forms over full formal forms.
  alex:[10000,15000],
  sasha:[6000,10000],
  alexander:[2500,4000],
  den:[3000,5000],
  denis:[1500,2500],
  denchik:[100,300],
  kolyan:[5000,8000],
  kolya:[4000,6500],
  nikolay:[2500,4500],
  kolyanchik:[300,600],
  nastya:[6000,10000],
  anastasia:[3500,6000],
  nastenka:[1500,3000],
  slastenka:[2500,4500],
  pavel:[7000,12000],
  pasha:[4000,8000],
  pashka:[1250,2500],
  stepa:[7000,12000],
  stepan:[5000,9000],
  stepashka:[250,500],

  // Surname / double-meaning controls
  orel:[5000,8000],
  orlov:[2500,5000],
  baranov:[800,1500],
  baran:[300,600],
  petrov:[1500,2500],
  smith:[4000,6000],
  miller:[4000,6000],
  brown:[400,700],
  johnson:[1500,2500],
  garcia:[750,1250],

  // Geography controls retained from SovaZone market calibration.
  paris:[3000,5000],
  yerevan:[500,1000],
  armenia:[1000,2000],
  berlin:[1000,2000],
  london:[4000,6000],
  tokyo:[2500,3500],
  moscow:[5000,10000],
  rome:[2000,5000],
  monaco:[2000,5000],
  georgia:[1500,2500],
  madrid:[1000,2000],
  dubai:[20000,50000],

  // Strong universal abbreviations
  vip:[20000,30000],
  ceo:[20000,30000],
  usa:[20000,30000],

  // Leetspeak controls
  m4d:[5000,8000],
  h0me:[500,800],

  // Russian transliteration calibration
  pricheska:[400,800]
});

const POST_GUARDRAIL_CALIBRATION_BANDS = Object.freeze({
  'hel_lo':[100,300,true],
  'hel.lo':[100,300,true]
});

function applyPostGuardrailCalibration(parsed,username,platform){
  const band=POST_GUARDRAIL_CALIBRATION_BANDS[String(username||'').toLowerCase()];
  if(!band)return parsed;
  const scale=platform==='tiktok'?0.20:1;
  parsed.priceMin=niceRound(band[0]*scale);
  parsed.priceMax=niceRound(band[1]*scale);
  parsed.openEnded=false;
  parsed.uncertain=Boolean(band[2]);
  return parsed;
}

function applySemanticCalibration(parsed,username){
  const band=SEMANTIC_CALIBRATION_BANDS[String(username||'').toLowerCase()];
  if(!band)return parsed;
  parsed.priceMin=band[0];
  parsed.priceMax=band[1];
  parsed.openEnded=Boolean(band[2]);
  parsed.uncertain=false;
  return parsed;
}

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
- English often has a broader pool, but weak English does not automatically beat an attractive local word. Do not assume every short dictionary word is premium: personal desirability and real buyer identity demand can differ by more than 10x between words of the same length.
- Preserve this demand order and do not collapse these words into one band: King > Money > Cloud > Gold > Dream > Hello > Fast > Love > Work. Hello is roughly $20k-$30k; use materially different bands above and below it.
- wolf is strong and broad, roughly $15k-$25k; volk roughly $15k-$20k currently.
- deer is a normal attractive English word, while Russian transliteration olen can have an insulting association and should be discounted.
- Russian transliterations are a real semantic category and can sell close to foreign words when personally attractive to Russian-speaking buyers.
- European-language words generally have broader buyer pools than comparable words in smaller Asian/Indian-language markets, but demand is case-specific.

NAMES / SURNAMES
- Do not assume the full legal name is most valuable. Actual usage, length, attractiveness, number of bearers, international reach, gender mix and buyer demand matter.
- Buyers are predominantly male, so male names are usually somewhat stronger, but this is only one factor.
- Preserve these real username-demand orders even when a longer formal name is globally familiar: Alex > Sasha > Alexander. Den > Denis > Denchik. Pavel > Pasha > Pashka. Stepa > Stepan > Stepashka. Kolyan > Kolya > Nikolay > Kolyanchik. Nastya > Anastasia > Nastenka. Do not reward the formal/full form merely for being formal or internationally recognisable.
- Alex current calibration is roughly $10k-$15k.
- Diminutive/childish forms often lose value.
- Slastenka is below Nastya as a direct name but gains demand from double meaning and use by girls named Nastya.
- Surname demand is real. Positive/neutral double meaning expands the buyer pool; negative secondary meaning can reduce it.
- Orel > Orlov because orel is a stronger standalone image. Baranov > Baran because baran has an insulting association while Baranov is a normal surname.

BUYER DEMAND
Apply this to ALL semantic categories: words, names, surnames, geography, professions, abbreviations, languages and cultural terms.
Consider audience size, purchasing power, IT/digital/crypto/startup/social-media concentration, willingness to buy digital identity, Instagram activity and status value. A smaller digitally affluent audience can create more real username demand than a larger wealthy audience concentrated in offline industries.

GEOGRAPHY
Population alone is not enough. Consider connected population, wealth, digital/IT affinity, visibility, tourism/prestige and actual demand. Country/city/resort status by itself gives little automatic premium. Calibration: Paris is roughly $3k-$5k, Yerevan roughly $500-$1k; Dubai can be much stronger because the digitally affluent buyer pool is different.

LEETSPEAK / ABBREVIATIONS / RISK
- No fixed leetspeak discount: value depends on underlying term and how natural the substitution looks. M4D is a strong compact form and should be several times more valuable than ordinary h0me; h0me is weak/ordinary.
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

export function threeLetterPatternRange(lower){
  lower=String(lower||'').toLowerCase();
  if(!/^[a-z]{3}$/.test(lower))return null;
  const [a,b,c]=[...lower];
  const strong=[a,b,c].filter(ch=>STRONG_LETTERS.has(ch)).length;
  const weak=[a,b,c].filter(ch=>WEAK_LETTERS.has(ch)).length;
  const out=(min,max,score,liq,kind)=>({min,max,score,liq,kind});

  // Triple repeats are unmistakable collectible patterns and should never be
  // capped like an ordinary random 3-character string. Historical SovaZone
  // calibration keeps XXX around $30k-$50k and QQQ/ZZZ around $10k-$15k.
  if(a===b&&b===c){
    if(a==='a'||a==='x')return out(30000,50000,95,'high','premium-triple-repeat');
    if(a==='s')return out(15000,25000,88,'high','strong-triple-repeat');
    if(a==='q'||a==='z')return out(10000,15000,84,'high','triple-repeat');
    if(WEAK_LETTERS.has(a))return out(7000,12000,76,'medium','triple-repeat');
    return out(9000,15000,80,'medium','triple-repeat');
  }

  // Calibration order retained from the agreed short-pattern model:
  // AAA > ABC > QWE > ABA > BAA > AAB > BQY.
  if(lower==='abc')return out(10000,20000,86,'high','alphabet-sequence');
  if(lower==='qwe')return out(6000,10000,74,'medium','keyboard-sequence');
  if(lower==='bqy')return out(1500,2000,50,'low','weak-clean-trigram');

  if(a===c){
    if(strong>=2)return out(5000,8000,76,'medium','palindrome');
    if(weak>=2)return out(2500,4000,62,'low','palindrome');
    return out(4000,7000,70,'medium','palindrome');
  }
  if(b===c){
    if(strong>=2)return out(4000,7000,70,'medium','suffix-repeat');
    if(weak>=2)return out(2000,3000,56,'low','suffix-repeat');
    return out(3000,5500,64,'medium','suffix-repeat');
  }
  if(a===b){
    if(strong>=2)return out(3500,6500,68,'medium','prefix-repeat');
    if(weak>=2)return out(1750,2750,54,'low','prefix-repeat');
    return out(2500,4500,62,'medium','prefix-repeat');
  }
  if(strong===3)return out(5000,9000,72,'medium','clean-trigram');
  if(strong>=2)return out(3500,6500,66,'medium','clean-trigram');
  if(weak>=2)return out(1500,2500,48,'low','weak-clean-trigram');
  return out(2000,4000,56,'low','clean-trigram');
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

function numericRange3(lower){
  const s=numericSignals(lower),chars=s.chars;
  const strong=chars.filter(c=>STRONG_DIGITS.has(c)).length;
  const weak=chars.filter(c=>WEAK_DIGITS.has(c)).length;
  const out=(min,max,score,liq='medium',open=false)=>({min,max,score,liq,open});

  // Repeating triples: repetition is the main premium, then digit demand separates tiers.
  if(s.allSame){
    if(['1','7','0'].includes(chars[0]))return out(50000,50000,94,'high',true);
    if(['5','6','9'].includes(chars[0]))return out(10000,15000,80,'high');
    if(chars[0]==='8')return out(7000,12000,76,'high');
    return out(5000,10000,70,'medium');
  }

  // Recognisable cultural / internet / emergency codes get semantic demand on top of structure.
  if(lower==='404')return out(10000,20000,86,'high');
  if(lower==='007')return out(5000,10000,72,'medium');
  if(lower==='911')return out(3000,5000,64,'medium');
  if(lower==='420')return out(1500,2000,55,'low');

  // Round hundreds generalise by the leading digit rather than exact-number lookup.
  if(chars[1]==='0'&&chars[2]==='0'){
    if(chars[0]==='1')return out(10000,15000,80,'high');
    if(chars[0]==='2')return out(5000,10000,70,'medium');
    if(STRONG_DIGITS.has(chars[0]))return out(7000,12000,74,'medium');
    if(WEAK_DIGITS.has(chars[0]))return out(3000,5000,62,'medium');
    return out(5000,8000,67,'medium');
  }

  // 101 is a particularly recognisable palindrome (binary / introductory-course notation).
  if(lower==='101')return out(7000,10000,78,'high');

  // Other palindromes scale with the quality of their digits.
  if(s.palindrome){
    if(strong===3)return out(5000,8000,72,'medium');
    if(strong>=2)return out(5000,8000,70,'medium');
    if(weak>=2)return out(2000,3500,59,'low');
    return out(3000,5000,64,'medium');
  }

  // Ascending sequences are stronger when they start cleanly and avoid weak digits.
  if(s.ascending){
    if(chars[0]==='1'&&weak===0)return out(10000,15000,80,'high');
    if(weak>=2)return out(3000,5000,64,'medium');
    if(strong>=2)return out(5000,10000,70,'medium');
    return out(3000,5000,64,'medium');
  }

  // Descending sequences carry a smaller premium than comparable ascending sequences.
  if(s.descending){
    if(strong>=2)return out(5000,8000,69,'medium');
    return out(3000,5000,64,'medium');
  }

  // Non-pattern triples stay close to scarcity floor unless digit quality itself is strong.
  if(weak>=2)return out(1500,2000,55,'low');
  if(strong>=2)return out(3000,5000,64,'medium');
  if(strong===1&&weak===0)return out(2000,3500,60,'low');
  return out(1500,2500,56,'low');
}

function structuralResult(username,platform,lang){
  const lower=username.toLowerCase(),len=[...lower].length;
  const scale=platform==='tiktok'?0.20:1;
  function make(min,max,open,category,code,score,liq,factors){
    if(scale!==1){min=niceRound(min*scale);max=open?min:niceRound(max*scale);open=false;}
    return {username,platform,engineVersion:ENGINE_VERSION,priceMin:min,priceMax:max,openEnded:Boolean(open),uncertain:false,specialCase:'none',category,categoryCode:code,qualityScore:score,liquidity:liq,liquidityLabel:localizedLiquidity(liq,lang),factors,disclaimer:lang==='en'?'Indicative SovaZone estimate, not a guaranteed transaction price.':'Ориентировочная оценка SovaZone, не гарантия цены сделки.'};
  }


  if(/^([a-z])\1\1$/.test(lower)){
    const r=threeLetterPatternRange(lower);
    const factors=lang==='en'
      ? [{title:'Scarcity',text:'Three-character Instagram usernames are intrinsically scarce.'},{title:'Pattern',text:'Three identical letters create one of the strongest collectible letter patterns.'},{title:'Demand',text:r.liq==='high'?'The pattern has broad collector and identity demand.':'The pattern is scarce but its buyer pool is more selective.'}]
      : [{title:'Редкость',text:'Трёхсимвольные Instagram username сами по себе редки.'},{title:'Паттерн',text:'Три одинаковые буквы создают один из самых сильных коллекционных буквенных паттернов.'},{title:'Спрос',text:r.liq==='high'?'У паттерна широкий коллекционный и имиджевый спрос.':'Паттерн редкий, но круг покупателей более избирательный.'}];
    return make(r.min,r.max,false,lang==='en'?'Three-letter pattern':'Трёхбуквенный паттерн','pattern',r.score,r.liq,factors);
  }

  if(len===2){
    // Two-character handles use a deterministic SovaZone scarcity formula.
    const chars=[...lower],a=chars[0],b=chars[1];
    const same=a===b,bothLetters=/^[a-z]{2}$/.test(lower),bothDigits=/^\d{2}$/.test(lower);
    const letterDigit=/^[a-z]\d$/.test(lower),digitLetter=/^\d[a-z]$/.test(lower),hasSeparator=/[._]/.test(lower);
    const letterWeight=c=>c==='a'?3:c==='x'?2.4:c==='s'?2.2:c==='z'?2.1:WEAK_LETTERS.has(c)?0.3:1.3;
    const digitWeight=c=>c==='1'?3:c==='7'?2.5:c==='0'?2.1:c==='5'?1.8:c==='8'?0.5:c==='9'?0.3:1.3;
    let min=15000,max=20000,score=55,liq='medium',pattern='balanced';

    if(hasSeparator){
      min=15000;max=(a==='.'||a==='_')?16500:17500;score=38;liq='low';pattern='separator';
    }else if(bothLetters){
      const total=letterWeight(a)+letterWeight(b);
      if(same){
        min=niceRound(15000+letterWeight(a)*1600);
        max=niceRound(18000+letterWeight(a)*4000);
        score=Math.round(68+letterWeight(a)*9);liq='high';pattern='letter-repeat';
      }else if(total>=4.2){
        min=15000;max=30000;score=92;liq='high';pattern='strong-letter-pair';
      }else if(total>=3){
        min=17000;max=23000;score=78;liq='high';pattern='clean-letter-pair';
      }else if(total<=0.8){
        min=15000;max=20000;score=48;liq='medium';pattern='weak-letter-pair';
      }else{
        min=15000;max=22000;score=64;liq='medium';pattern='letter-pair';
      }
    }else if(bothDigits){
      const total=digitWeight(a)+digitWeight(b);
      if(same){
        min=niceRound(15000+digitWeight(a)*1000);
        max=niceRound(18000+digitWeight(a)*4000);
        score=Math.round(70+digitWeight(a)*7);liq='high';pattern='digit-repeat';
      }else if(total>=5){
        min=17000;max=25000;score=84;liq='high';pattern='strong-digit-pair';
      }else if(total>=3){
        min=16000;max=22000;score=72;liq='medium';pattern='digit-pair';
      }else{
        min=15000;max=19000;score=54;liq='medium';pattern='weak-digit-pair';
      }
    }else if(letterDigit){
      const total=letterWeight(a)+digitWeight(b);
      if(total>=5.8){min=18000;max=25000;score=88;liq='high';pattern='premium-letter-digit';}
      else if(total>=5.2){min=17000;max=24000;score=84;liq='high';pattern='strong-letter-digit';}
      else if(total>=4.5){min=15000;max=22000;score=82;liq='high';pattern='strong-letter-digit';}
      else if(total>=3.2){min=15000;max=21000;score=70;liq='medium';pattern='letter-digit';}
      else if(total<=1){min=15000;max=18000;score=38;liq='medium';pattern='weak-letter-digit';}
      else{min=15000;max=20000;score=58;liq='medium';pattern='letter-digit';}
    }else if(digitLetter){
      const total=digitWeight(a)+letterWeight(b);
      if(total>=5.8){min=16000;max=22000;score=86;liq='high';pattern='premium-digit-letter';}
      else if(total>=4.5){min=15000;max=21000;score=78;liq='medium';pattern='strong-digit-letter';}
      else if(total<=1){min=15000;max=17000;score=35;liq='low';pattern='weak-digit-letter';}
      else{min=15000;max=20000;score=58;liq='medium';pattern='digit-letter';}
    }

    const factors=lang==='en'
      ? [{title:'Scarcity',text:'Every two-character Instagram username has a strong scarcity floor.'},{title:'Composition',text:pattern.includes('repeat')?'Repetition adds memorability and collectible demand.':pattern.includes('weak')?'The symbol mix is comparatively weak, so most value comes from scarcity.':'Letter/digit quality, order and visual balance determine the premium above the floor.'},{title:'Demand',text:liq==='high'?'The combination has a broad buyer pool for a two-character handle.':liq==='medium'?'The handle is scarce, but the buyer pool is more selective.':'The handle remains scarce, while the specific composition has narrow demand.'}]
      : [{title:'Редкость',text:'Любой двухсимвольный Instagram username имеет сильный минимум за редкость.'},{title:'Состав',text:pattern.includes('repeat')?'Повтор усиливает запоминаемость и коллекционный спрос.':pattern.includes('weak')?'Сочетание символов сравнительно слабое, поэтому основную ценность даёт редкость.':'Качество букв и цифр, их порядок и визуальный баланс определяют премию выше минимума.'},{title:'Спрос',text:liq==='high'?'Для двухсимвольного ника сочетание имеет широкий круг потенциальных покупателей.':liq==='medium'?'Ник редкий, но аудитория покупателей более избирательна.':'Редкость сохраняется, однако спрос именно на это сочетание сравнительно узкий.'}];
    return make(min,max,false,lang==='en'?'Two-character username':'Двухсимвольный username','short',score,liq,factors);
  }
  if(/^\d{3}$/.test(lower)){
    const r=numericRange3(lower),min=r.min,max=r.max,open=r.open,score=r.score,liq=r.liq;
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
        else if(/^[a-z]{3}$/.test(lower)){
          const r=threeLetterPatternRange(lower);
          if(r){
            min=Math.max(floor,r.min);
            max=Math.max(min,r.max);
            parsed.qualityScore=Math.max(Number(parsed.qualityScore)||0,r.score);
            parsed.liquidity=r.liq;
            parsed.category=lang==='en'?'Three-letter pattern':'Трёхбуквенный паттерн';
            parsed.categoryCode='pattern';
            parsed.factors=lang==='en'
              ? [{title:'Scarcity',text:'Three-character Instagram usernames retain a strong scarcity premium.'},{title:'Pattern',text:r.kind.includes('repeat')?'Repetition materially increases memorability and collectible demand.':r.kind.includes('sequence')?'The sequence is recognizable and materially stronger than a random trigram.':'Letter order, repetition and symmetry determine the premium above the scarcity floor.'},{title:'Demand',text:r.liq==='high'?'The pattern has broad buyer appeal for a three-character handle.':r.liq==='medium'?'The pattern has clear but more selective demand.':'Most of the value comes from scarcity; demand for this exact combination is narrower.'}]
              : [{title:'Редкость',text:'Трёхсимвольные Instagram username сохраняют сильную премию за дефицит.'},{title:'Паттерн',text:r.kind.includes('repeat')?'Повтор заметно усиливает запоминаемость и коллекционный спрос.':r.kind.includes('sequence')?'Узнаваемая последовательность заметно сильнее случайной трёхбуквенной комбинации.':'Порядок букв, повторы и симметрия определяют премию выше базовой редкости.'},{title:'Спрос',text:r.liq==='high'?'У паттерна широкий спрос для трёхсимвольного ника.':r.liq==='medium'?'У паттерна заметный, но более избирательный спрос.':'Основную ценность даёт редкость, а спрос именно на это сочетание более узкий.'}];
          }
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
  parsed=applySemanticCalibration(parsed,username);

  if(platform==='instagram')parsed=applyInstagramGuardrails(parsed,username,lang);
  else{
    const base=applyInstagramGuardrails({...parsed,platform:'instagram'},username,lang);
    base.priceMin=niceRound((Number(base.priceMin)||0)*0.20);
    base.priceMax=base.openEnded?base.priceMin:niceRound((Number(base.priceMax)||0)*0.20);
    base.openEnded=false;base.platform='tiktok';
    const len=[...username.toLowerCase()].length;
    if(len<=4&&Array.isArray(base.factors)&&base.factors.length){
      const floor=niceRound(shortFloor(len)*0.20);
      base.factors[0]={title:lang==='en'?'Short-handle scarcity':'Редкость короткого ника',text:lang==='en'?`A ${len}-character TikTok username retains a scarcity reference from about $${floor.toLocaleString('en-US')} after the TikTok market adjustment.`:`TikTok username длиной ${len} символа сохраняет ориентир редкости примерно от $${floor.toLocaleString('en-US')} после поправки на рынок TikTok.`};
    }
    parsed=base;
  }
  parsed=applyPostGuardrailCalibration(parsed,username,platform);
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
  const requestBody={model:process.env.VALUATION_MODEL||'gpt-5.6-luna',store:false,reasoning:{effort:'none'},temperature:0,instructions:CALIBRATION+'\n'+languageRules(lang),input:`Evaluate @${username}. First estimate its Instagram-equivalent value; backend handles TikTok scaling. Deterministic format signals: ${JSON.stringify(signals)}. Do not use any exact example as a lookup answer.`,max_output_tokens:700,text:{verbosity:'low',format:{type:'json_schema',name:'username_valuation_v40',strict:true,schema}}};

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
  }catch(e){console.error('username-value v4.0 error',e);return res.status(500).json({error:lang==='en'?'Could not complete the estimate.':'Не удалось выполнить оценку.'});}
}
