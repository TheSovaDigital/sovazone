const buckets = globalThis.__sovaValuationBucketsV30 || (globalThis.__sovaValuationBucketsV30 = new Map());
const valuationCache = globalThis.__sovaValuationCacheV30 || (globalThis.__sovaValuationCacheV30 = new Map());

const ENGINE_VERSION = 'instagram-v3.0';

const STRONG_LETTERS = new Set(['a','x','s','z']);
const WEAK_LETTERS = new Set(['b','d','j','q','u','y']);
const STRONG_DIGITS = new Set(['0','1','5','7']);
const WEAK_DIGITS = new Set(['8','9']);

const GLOBAL_BRANDS = new Set([
  'apple','nike','tesla','google','amazon','microsoft','instagram','facebook','tiktok',
  'adidas','cocacola','samsung','youtube','netflix','spotify','bmw','mercedes','porsche',
  'ferrari','gucci','chanel','rolex','nvidia','openai'
]);

const OWNER_ANCHORS = {
  cat:{min:20000,max:30000},
  m8x:{min:1500,max:2000},
  '777':{min:50000,max:50000,openEnded:true},
  aaaaa:{min:1500,max:3000},
  '88888':{min:1000,max:2000},
  home:{min:15000,max:30000},
  love:{min:15000,max:22000},
  cloud:{min:40000,max:60000},
  storm:{min:10000,max:20000},
  haus:{min:1000,max:2000},
  david:{min:6000,max:8000},
  alexander:{min:2500,max:3500},
  alex:{min:9000,max:12000},
  anna:{min:2000,max:3000},
  sofia:{min:2000,max:3000},
  petrov:{min:1500,max:2500},
  tv:{min:45000,max:55000},
  x7:{min:15000,max:20000},
  qqq:{min:10000,max:15000},
  '123':{min:20000,max:30000},
  car:{min:20000,max:30000},
  money:{min:50000,max:75000},
  hotel:{min:8000,max:12000},
  paris:{min:3000,max:5000},
  armenia:{min:1000,max:2000},
  ivan:{min:4000,max:6000},
  ahmed:{min:4000,max:7000},
  smith:{min:4000,max:6000},
  miller:{min:4000,max:6000},
  bella:{min:2500,max:3500},
  max:{min:10000,max:20000},
  one:{min:50000,max:80000},
  go:{min:20000,max:30000},
  ai:{min:20000,max:50000},
  vip:{min:20000,max:30000},
  xxx:{min:30000,max:50000},
  '999':{min:10000,max:20000},
  '007':{min:5000,max:10000},
  gold:{min:35000,max:50000},
  shop:{min:20000,max:30000},
  black:{min:30000,max:50000},
  berlin:{min:1000,max:2000},
  dubai:{min:20000,max:50000,uncertain:true},
  john:{min:3000,max:5000},
  maria:{min:1500,max:2500},
  brown:{min:400,max:700},
  web:{min:5000,max:10000},
  app:{min:10000,max:20000},
  pro:{min:4000,max:6000},
  win:{min:30000,max:50000},
  red:{min:15000,max:30000},
  green:{min:4000,max:6000},
  king:{min:60000,max:90000},
  queen:{min:5000,max:15000,uncertain:true},
  music:{min:10000,max:20000},
  crypto:{min:50000,max:80000},
  london:{min:4000,max:6000},
  tokyo:{min:2500,max:3500},
  leo:{min:10000,max:20000},
  sara:{min:1500,max:2500},
  johnson:{min:1500,max:2500},
  fun:{min:15000,max:30000},
  lux:{min:50000,max:80000},
  boss:{min:50000,max:80000},
  work:{min:10000,max:18000},
  fast:{min:18000,max:24000},
  blue:{min:2000,max:3000},
  doctor:{min:4000,max:6000},
  lawyer:{min:5000,max:10000},
  moscow:{min:5000,max:10000},
  yerevan:{min:500,max:1000},
  adam:{min:16000,max:24000},
  eva:{min:4000,max:6000},
  garcia:{min:750,max:1250},
  it:{min:20000,max:30000},
  '7x':{min:15000,max:20000},
  zzz:{min:10000,max:15000},
  '555':{min:10000,max:15000},
  job:{min:10000,max:20000},
  buy:{min:15000,max:20000},
  game:{min:20000,max:30000},
  pink:{min:5000,max:10000},
  water:{min:5000,max:10000},
  market:{min:5000,max:10000},
  rome:{min:2000,max:5000,uncertain:true},
  monaco:{min:2000,max:5000,uncertain:true},
  georgia:{min:1500,max:2500},
  mark:{min:5000,max:10000},
  daniel:{min:4000,max:6000},
  emma:{min:1500,max:2500},
  robert:{min:3000,max:5000},
  taylor:{min:2000,max:3000},
  wilson:{min:1000,max:2000},
  rrrrr:{min:1000,max:2000},
  sun:{min:15000,max:25000},
  '888':{min:10000,max:20000},
  top:{min:20000,max:30000},
  best:{min:20000,max:30000},
  phone:{min:5000,max:10000},
  dream:{min:25000,max:35000},
  hello:{min:20000,max:30000},
  mike:{min:5000,max:10000},
  alice:{min:2000,max:3000},
  madrid:{min:1000,max:2000},
  pricheska:{min:400,max:800},
  volk:{min:13500,max:13500},
  aaabb:{min:100,max:300},
  aabbb:{min:100,max:300},
  azaza:{min:100,max:200},
  abcde:{min:0,max:50},
  qwert:{min:0,max:100},
  qzxvna:{min:0,max:0},
  'hel_lo':{min:100,max:300},
  'hel.lo':{min:100,max:300},
  'pri_cheska':{min:0,max:50},
  'qz_xvna':{min:0,max:0}
};

const FIRST_NAME_ANCHORS = new Set([
  'david','alexander','alex','anna','sofia','ivan','ahmed','bella','max','john','maria',
  'leo','sara','adam','eva','mark','daniel','emma','robert','mike','alice'
]);
const SURNAME_ANCHORS = new Set(['petrov','smith','miller','brown','johnson','garcia','taylor','wilson']);
const GEO_ANCHORS = new Set(['paris','armenia','berlin','dubai','london','tokyo','moscow','yerevan','rome','monaco','georgia','madrid']);
const RUSSIAN_TRANSLIT_ANCHORS = new Set(['pricheska','volk']);

const CALIBRATION = `
You are the SovaZone Username Valuation engine, version 3.0. Estimate the standalone resale value of a social-media username using the owner's real-market pricing logic. This is an informed valuation range, not a guaranteed sale price.

ABSOLUTE INSTAGRAM SCARCITY FLOORS
- Any valid 1-character username using Latin letters, digits, dot or underscore: at least $50,000. Very strong ones may be shown as $50,000+.
- Any 2-character username: at least $15,000.
- Any 3-character username: at least $1,500.
- Any 4-character username: at least $500.
- These floors apply even when dot or underscore appears. Example: q_9 still has at least $1,500 value because it is 3 characters.
- For 5+ characters there is no scarcity floor. Random meaningless strings are normally worth $0.

DOT / UNDERSCORE
- For 1-4 characters, dot/underscore reduce visual appeal and liquidity but NEVER erase the scarcity floor.
- For 5+ characters, dot/underscore strongly reduce value. Strong semantic words may retain only a small residual value. Owner examples: hello $20k-$30k, hel_lo or hel.lo about $100-$300; pricheska $400-$800, pri_cheska about $0-$50; random qz_xvna $0.

LETTER DEMAND
- Strong letters: A, X, S, Z.
- Weak letters: B, D, J, Q, U, Y.
- All other Latin letters are medium.
- Letter ranking is only a base tendency. Strong meaning or a strong pattern can dominate it. Example: qqq is still valuable because the repeat is powerful.
- Among repeated short forms, AA is especially attractive.

DIGIT DEMAND AND CONTEXT
- Base strong digits: 0,1,5,7.
- Base medium digits: 2,3,4,6.
- Base weak digits: 8,9.
- Context can override base digit rank. If two identical letters are followed by 2, as in aa2/kk2, digit 2 gets a strong contextual boost. If three identical letters pair with 3, as in aaa3, digit 3 gets a strong boost.
- oo0 receives a strong visual boost.
- Semantic matching is powerful: one1 is strong; two2 is stronger than two1.
- Position of one digit matters mildly: letters+digit is usually best, digit+letters slightly weaker, digit in the middle slightly weaker again. Example calibration if aa1 is $2000-$3000: 1aa about $1800-$2700, a1a about $1700-$2600. Do not let this override short-length floors.
- With two digits, owner attractiveness order: 1a1 > a11 > 11a > 17a > a17 > 1a7. Symmetry and repeated blocks matter.

NUMERIC PATTERNS
- For pure 3-digit handles, general owner order: 777 > 404 > 111 > 000 > 555 > 123 > 321 > 101 > 707 > 789 > 928.
- Special/cultural code order: 404 > 007 > 666 > 100 > 999 > 888 > 200 > 911 > 420.
- 404 is a strong semantic/cultural code and can outrank ordinary repeat logic.
- For 4-digit handles owner order: 1111 > 0000 > 7777 > 5555 > 1000 > 1001 > 1234 > 1221 > 2020 > 4321 > 7770 > 9284.

LETTER PATTERNS
- Four-letter pattern order: aaaa > aabb > aaab > abba > abab > baaa > abbb > abca > abcd.
- Three-letter pattern order: aaa > abc > qwe > aba > baa > aab > bqy.
- Two-character general order: aa > 11 > a1 > ab > 1a > qy > a_ > _a.
- Concrete two-character order: aa > 11 > xx > zz > 77 > 00 > ss > kk > 55 > 88 > 99 > qy.
- Mixed two-character order: a1 > a7 > x7 > k1 > z1 > a0 > 1a > 7x > 0a > q9 > 9q.
- One-character owner order: 1 > A > X > Z > 7 > S > K > 5 > 0 > Q > 9 > 8 > . > _.
- Pattern/structure can outweigh the base strength of individual symbols.

FOUR-CHARACTER RANDOM CALIBRATION
- Four characters always keep the $500 floor.
- azaz about $500-$800.
- bqdy about $500-$700.
- xq7s about $500-$600.
- q_9a about $500.
- Clean structure matters more than simply counting strong characters.

FIVE-PLUS RANDOM/PATTERN CALIBRATION
- Random 5+ with no meaning or collectible pattern: $0.
- aaaaa about $1,500-$3,000.
- aaabb / aabbb about $100-$300.
- azaza about $100-$200.
- abcde about $0-$50.
- qwert about $0-$100.
- A weak visual pattern alone does not justify a large price.

SEMANTIC WORDS: PERSONAL DEMAND FIRST
- Most buyers are ordinary people buying a username for themselves. Commercial meaning and brandability matter, but have relatively low weight.
- The central question is whether people actually want to identify with the word.
- Important factors: attractiveness of meaning, positive/negative cultural associations, length, memorability, visual form, language, size of the interested population, buyer quality, and scarcity.
- Owner English-word preference examples: King > Money > Cloud > Gold > Dream > Hello > Fast > Love > Work.
- English is often stronger because the buyer pool is broader, but DO NOT blindly multiply value just because a word is English.
- A weak/unattractive English word can be worth roughly the same as an equivalent Russian transliteration.
- Example: deer is a normal attractive English word, while Russian transliteration olen can carry an insulting association for Russian speakers and should be discounted.
- Evaluate the actual cultural meaning in the target audience, not a literal dictionary translation.
- Animal/object words depend on desirability. Wolf can be strong; an unattractive animal term may be cheap even if English.

RUSSIAN / OTHER LANGUAGES
- Russian words in Latin transliteration are a real category and can sell near foreign-language pricing when the word is attractive to a Russian-speaking audience.
- Real owner sale anchor: volk sold for $13,500 to a buyer with surname Volkov. Wolf would still be expected to sell higher because the international pool is broader.
- European-language words generally have stronger buyer pools than comparable words from smaller Asian/Indian-language markets, but this is not a rigid rule.
- A short strong local-language word can beat a longer mediocre international word.

NAMES, SHORT FORMS, NICKNAMES
- Do NOT assume a full legal name is more valuable than its short form.
- Judge actual usage, length, attractiveness as a username, number of potential bearers, international reach, gender of likely buyers, and buyer demand.
- Male names are usually somewhat stronger because the buyer pool is predominantly male, but this is only one factor.
- Owner order examples:
  Alex > Sasha > Alexander.
  Den > Denis > Denchik.
  Pavel > Pasha > Pashka.
  Stepa > Stepan > Stepashka.
  Kolyan > Kolya > Nikolay > Kolyanchik.
  Nastya > Anastasia > Nastenka.
- Overly childish/diminutive forms often lose value.
- Slastenka is below Nastya as a direct name, but Slastenka gets extra semantic value because girls named Nastya may use it as a nickname and it is also a standalone word/term of endearment.

SURNAMES AND DUAL MEANING
- A surname can have strong personal demand from people who actually bear it.
- Evaluate both surname demand and any standalone word meaning.
- Dual positive/neutral meanings can expand the buyer pool and add value.
- Negative secondary meanings can reduce value.
- Owner examples: Orel > Orlov because orel is a stronger standalone word/image; Baranov > Baran because baran has a negative/insulting Russian association while Baranov is a normal surname.
- Do not automatically rank a word above a surname or vice versa.

GEOGRAPHY
- Country/city/resort status alone gives little automatic premium.
- Consider population, number of people personally connected to the place, international visibility, prestige, tourism and actual username demand.
- Buyer quality matters: a smaller place with more digitally active, affluent buyers may create stronger username demand than a larger place with wealth concentrated in offline industries.

UNIVERSAL BUYER-DEMAND FACTOR
- Apply this to ALL semantic categories: words, names, surnames, geography, professions, abbreviations, languages and cultural terms.
- Do not only count how many people are related to a term. Estimate how likely that audience is to buy expensive digital identity.
- Consider purchasing power, concentration of IT/digital/crypto/startup/social-media users, willingness to pay for digital assets, Instagram activity and status value of a username.
- A smaller but highly digital/IT-oriented affluent audience can create more real demand than a much larger audience with low propensity to buy usernames.

LEETSPEAK
- No fixed leetspeak discount.
- Value = strength of underlying word × naturalness of substitution × length × visual quality.
- M4D is a strong short construction and can be expensive; h0me is understandable but materially weaker.
- Natural semantic matching can outweigh a normally weaker digit.

RISKY / NEGATIVE TERMS
- Do not simply discount every negative word.
- Adult/explicit/drug-related terms may face platform restrictions and lower realistic buyer demand because of block risk.
- Edgy identity words such as killer or devil can be highly attractive and expensive if they are short/strong.
- Separate platform risk from semantic desirability.

ABBREVIATIONS
- Universal abbreviations such as VIP, CEO, USA are strong because they have broad independent meaning.
- Brand-linked abbreviations such as BMW have less general independent demand than universal abbreviations.
- Do not confuse universal abbreviation value with a corporation's trademark value.

GLOBAL BRANDS
- Exact matches for globally famous brands are special cases and should not be given an ordinary market valuation. The real free market is not comparable.
- If clearly an exact globally famous brand, return specialCase=global_brand. Explain that a reliable normal-market valuation is not appropriate.

LIQUIDITY
- Compute liquidity separately from price.
- High: strong on several parameters and broad realistic buyer pool.
- Medium: clear value but meaningfully narrower buyer pool.
- Low: scarcity or niche meaning creates value, but finding the right buyer may take a long time.
- A weak 3-char like y8q can still have the $1,500 floor but low liquidity.

PRICE RANGE DISCIPLINE
- Normal confident range: upper bound should usually be no more than 2x lower bound.
- Uncertain/disputed case: may be up to 3x lower bound.
- $20k-$30k is acceptable; $20k-$40k is normally too wide.
- For very expensive usernames where the upper bound is not defensible, prefer an open-ended result such as $40,000+ or $50,000+ instead of an artificially huge range.
- Use rounded realistic numbers and avoid false precision.

TIKTOK
- TikTok valuation should normally be about 20%-30% of the equivalent Instagram valuation, unless platform-specific demand strongly indicates otherwise.

CLASSIFICATION
Return one stable categoryCode from:
short, english_word, russian_word_translit, other_language_word, first_name, surname, geography, numeric, pattern, leetspeak, abbreviation, random.

VALUATION METHOD
1. Normalize and classify.
2. Apply absolute scarcity floors for Instagram length 1-4 before any discounts.
3. Evaluate semantic desirability and real buyer demand.
4. Evaluate structure/pattern, symbol quality and contextual interactions.
5. Compare to multiple owner anchors and calibration examples, not a single nearest example.
6. For 5+ random strings return zero unless a real pattern/meaning supports value.
7. Keep price, quality and liquidity as separate judgments.
8. Use exactly three concise factors.
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
  if(!b || now-b.start>windowMs){b={start:now,count:0};buckets.set(ip,b);}
  b.count++;
  if(buckets.size>2500){
    for(const [k,v] of buckets){ if(now-v.start>windowMs) buckets.delete(k); }
  }
  return b.count>limit;
}

function outputText(data){
  for(const item of (data.output||[])){
    for(const part of (item.content||[])){
      if(part.type==='output_text' && part.text) return part.text;
    }
  }
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

function formatSignals(username){
  const lower=username.toLowerCase();
  const chars=[...lower];
  const allNumeric=/^\d+$/.test(lower);
  const lettersOnly=/^[a-z]+$/.test(lower);
  const mixedLettersDigits=/[a-z]/.test(lower)&&/\d/.test(lower);
  const hasSeparator=/[._]/.test(lower);
  const sameChar=chars.length>1 && chars.every(c=>c===chars[0]);
  const alternating=chars.length>=4 && chars.every((c,i)=>c===chars[i%2]);
  const palindrome=chars.length>1 && lower===chars.slice().reverse().join('');
  const repeatedBlock=chars.length>=4 && (() => {
    for(let size=1;size<=Math.floor(chars.length/2);size++){
      if(chars.length%size) continue;
      const block=lower.slice(0,size);
      if(block.repeat(chars.length/size)===lower) return true;
    }
    return false;
  })();
  const digits=chars.filter(c=>/\d/.test(c));
  const letters=chars.filter(c=>/[a-z]/.test(c));
  const tiers=chars.map(charTier);
  return {
    length:chars.length,
    allNumeric,
    lettersOnly,
    mixedLettersDigits,
    hasSeparator,
    separatorFree:lower.replace(/[._]/g,''),
    sameChar,
    alternating,
    palindrome,
    repeatedBlock,
    startsWithZero:/^0/.test(lower),
    uniqueChars:new Set(chars).size,
    digitCount:digits.length,
    letterCount:letters.length,
    strongSymbolCount:tiers.filter(x=>x==='strong').length,
    weakSymbolCount:tiers.filter(x=>x==='weak').length
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

function categoryLabel(code,lang){
  const ru={
    short:'Короткий username',
    english_word:'Английское слово',
    russian_word_translit:'Русское слово в латинице',
    other_language_word:'Слово на другом языке',
    first_name:'Имя',
    surname:'Фамилия',
    geography:'География',
    numeric:'Цифровой username',
    pattern:'Редкий паттерн',
    leetspeak:'Leetspeak',
    abbreviation:'Аббревиатура',
    random:'Случайная комбинация'
  };
  const en={
    short:'Short username',
    english_word:'English word',
    russian_word_translit:'Russian word in Latin script',
    other_language_word:'Other-language word',
    first_name:'First name',
    surname:'Surname',
    geography:'Geography',
    numeric:'Numeric username',
    pattern:'Rare pattern',
    leetspeak:'Leetspeak',
    abbreviation:'Abbreviation',
    random:'Random combination'
  };
  return (lang==='en'?en:ru)[code] || 'Username';
}

function anchorCategoryCode(username){
  const lower=username.toLowerCase();
  if(/^\d+$/.test(lower)) return lower.length<=4?'numeric':'pattern';
  if(lower.length<=3) return 'short';
  if(FIRST_NAME_ANCHORS.has(lower)) return 'first_name';
  if(SURNAME_ANCHORS.has(lower)) return 'surname';
  if(GEO_ANCHORS.has(lower)) return 'geography';
  if(RUSSIAN_TRANSLIT_ANCHORS.has(lower)) return 'russian_word_translit';
  if(new Set(lower).size===1 || /^(.)\1{3,}$/.test(lower)) return 'pattern';
  return 'english_word';
}

function qualityFromAnchor(min,max,username){
  const mid=(min+max)/2;
  const len=[...username].length;
  let score=45;
  if(len===1) score=92;
  else if(len===2) score=86;
  else if(len===3) score=72;
  else if(len===4) score=60;
  else if(len<=6) score=55;
  if(mid>=50000) score=Math.max(score,92);
  else if(mid>=20000) score=Math.max(score,84);
  else if(mid>=10000) score=Math.max(score,74);
  else if(mid>=5000) score=Math.max(score,66);
  return Math.min(99,score);
}

function liquidityFromAnchor(min,max){
  const mid=(min+max)/2;
  if(mid>=15000) return 'high';
  if(mid>=2500) return 'medium';
  return 'low';
}

function specialBrandResponse(username,platform,lang){
  const lower=username.toLowerCase();
  if(!GLOBAL_BRANDS.has(lower)) return null;
  return {
    username,platform,engineVersion:ENGINE_VERSION,
    priceMin:0,priceMax:0,openEnded:false,uncertain:true,specialCase:'global_brand',
    category:lang==='en'?'Special case — global brand':'Особый случай — глобальный бренд',
    categoryCode:'abbreviation',
    qualityScore:95,
    liquidity:'low',
    liquidityLabel:localizedLiquidity('low',lang),
    factors:lang==='en'
      ? [
          {title:'Special case',text:'This is an exact match for a globally famous brand.'},
          {title:'Market',text:'It is not comparable with the ordinary free username market.'},
          {title:'Valuation',text:'A reliable normal-market price range would be misleading.'}
        ]
      : [
          {title:'Особый случай',text:'Это точное совпадение со всемирно известным брендом.'},
          {title:'Рынок',text:'Такой username нельзя корректно сравнивать с обычным свободным рынком.'},
          {title:'Оценка',text:'Обычный ценовой диапазон здесь был бы вводящим в заблуждение.'}
        ],
    disclaimer:lang==='en'
      ? 'Special-case classification: no ordinary market valuation is shown.'
      : 'Особый случай: обычная рыночная оценка не указывается.'
  };
}

function anchorResponse(username,platform,lang){
  if(platform!=='instagram') return null;
  const anchor=OWNER_ANCHORS[username.toLowerCase()];
  if(!anchor) return null;
  const priceMin=anchor.min;
  const priceMax=anchor.max;
  const score=qualityFromAnchor(priceMin,priceMax,username);
  const liquidity=liquidityFromAnchor(priceMin,priceMax);
  const code=anchorCategoryCode(username);
  return {
    username,platform,engineVersion:ENGINE_VERSION,
    priceMin,priceMax,
    openEnded:Boolean(anchor.openEnded),
    uncertain:Boolean(anchor.uncertain),
    specialCase:'none',
    category:categoryLabel(code,lang),
    categoryCode:code,
    qualityScore:score,
    liquidity,
    liquidityLabel:localizedLiquidity(liquidity,lang),
    factors:lang==='en'
      ? [
          {title:'Type',text:categoryLabel(code,'en')+'.'},
          {title:'Scarcity',text:`The ${[...username].length}-character format and composition are reflected in the estimate.`},
          {title:'Demand',text:liquidity==='high'?'Broad realistic buyer demand.':liquidity==='medium'?'Moderate realistic buyer demand.':'Narrow realistic buyer demand.'}
        ]
      : [
          {title:'Тип',text:categoryLabel(code,'ru')+'.'},
          {title:'Редкость',text:`Длина ${[...username].length} символа и состав username учтены в оценке.`},
          {title:'Спрос',text:liquidity==='high'?'Широкий реальный спрос.':liquidity==='medium'?'Умеренный реальный спрос.':'Узкий реальный спрос.'}
        ],
    disclaimer:lang==='en'?'Indicative SovaZone estimate, not a guaranteed sale price.':'Ориентировочная оценка SovaZone, не гарантия цены сделки.'
  };
}

function applyShortStructureGuardrails(parsed,username,lang){
  const lower=username.toLowerCase();
  const len=[...lower].length;
  if(len<1 || len>4) return parsed;

  const floor=shortFloor(len);
  parsed.priceMin=Math.max(floor,Number(parsed.priceMin)||0);
  parsed.priceMax=Math.max(parsed.priceMin,Number(parsed.priceMax)||0);

  const hasSeparator=/[._]/.test(lower);
  const code=parsed.categoryCode;
  const structuralOnly=['short','random','pattern','numeric'].includes(code);

  if(len===4 && structuralOnly){
    if(hasSeparator){
      parsed.priceMin=floor;
      parsed.priceMax=floor;
    }else if(code==='random' || code==='short'){
      const allLetters=/^[a-z]{4}$/.test(lower);
      const repeating=/^(.)(.)(\1)(\2)$/.test(lower) || /^(.)(.)\2\1$/.test(lower);
      if(repeating) parsed.priceMax=Math.min(parsed.priceMax,800);
      else if(allLetters) parsed.priceMax=Math.min(parsed.priceMax,700);
      else parsed.priceMax=Math.min(parsed.priceMax,600);
      parsed.priceMax=Math.max(parsed.priceMin,parsed.priceMax);
    }
  }

  if(len===3 && structuralOnly && (code==='random' || code==='short')){
    if(hasSeparator){
      parsed.priceMin=floor;
      parsed.priceMax=Math.max(floor,Math.min(parsed.priceMax,2000));
    }else{
      const allWeak=[...lower].every(c=>WEAK_LETTERS.has(c));
      parsed.priceMax=Math.max(parsed.priceMin,Math.min(parsed.priceMax,allWeak?2000:3500));
    }
  }

  if(hasSeparator){
    parsed.qualityScore=Math.max(10,Math.round((Number(parsed.qualityScore)||45)-8));
  }

  if(Array.isArray(parsed.factors) && parsed.factors.length){
    parsed.factors[0]={
      title:lang==='en'?'Scarcity floor':'Минимум за редкость',
      text:lang==='en'
        ? `${len}-character Instagram usernames keep a scarcity floor of $${floor.toLocaleString('en-US')}, including dot/underscore forms.`
        : `Instagram username длиной ${len} символа сохраняет минимум $${floor.toLocaleString('en-US')} за редкость, включая варианты с точкой или _.`
    };
  }

  return parsed;
}

function applyLongSeparatorGuardrails(parsed,username){
  const lower=username.toLowerCase();
  const len=[...lower].length;
  if(len<=4 || !/[._]/.test(lower)) return parsed;

  if(parsed.categoryCode==='random'){
    parsed.priceMin=0;
    parsed.priceMax=0;
    parsed.qualityScore=Math.min(Number(parsed.qualityScore)||0,10);
    parsed.liquidity='low';
    return parsed;
  }

  const originalMin=Number(parsed.priceMin)||0;
  const originalMax=Number(parsed.priceMax)||0;
  const residualMin=niceRound(originalMin*0.015);
  const residualMax=niceRound(originalMax*0.02);
  parsed.priceMin=Math.min(100,residualMin);
  parsed.priceMax=Math.min(300,Math.max(parsed.priceMin,residualMax));
  parsed.qualityScore=Math.max(5,Math.round((Number(parsed.qualityScore)||45)-25));
  parsed.liquidity='low';
  return parsed;
}

function applyPatternFivePlus(parsed,username){
  const lower=username.toLowerCase();
  const len=[...lower].length;
  if(len<5 || /[._]/.test(lower)) return parsed;

  if(parsed.categoryCode==='random'){
    if(/^([a-z])\1{4}$/.test(lower) && len===5){
      parsed.priceMin=1500; parsed.priceMax=3000; parsed.categoryCode='pattern';
      return parsed;
    }
    if(/^([a-z])\1\1([a-z])\2$/.test(lower) || /^([a-z])\1([a-z])\2\2$/.test(lower)){
      parsed.priceMin=100; parsed.priceMax=300; parsed.categoryCode='pattern';
      return parsed;
    }
    if(/^([a-z])([a-z])\1\2\1$/.test(lower)){
      parsed.priceMin=100; parsed.priceMax=200; parsed.categoryCode='pattern';
      return parsed;
    }
    parsed.priceMin=0;
    parsed.priceMax=0;
    parsed.qualityScore=Math.min(Number(parsed.qualityScore)||0,10);
    parsed.liquidity='low';
  }
  return parsed;
}

function enforceRangeDiscipline(parsed){
  let min=Math.max(0,Number(parsed.priceMin)||0);
  let max=Math.max(0,Number(parsed.priceMax)||0);
  if(min>max){ const t=min;min=max;max=t; }

  if(parsed.openEnded && min>=40000){
    parsed.priceMin=niceRound(min);
    parsed.priceMax=parsed.priceMin;
    return parsed;
  }

  if(min>0){
    const multiplier=parsed.uncertain?3:2;
    max=Math.min(max,min*multiplier);
    if(min>=40000 && max>min*1.6){
      parsed.openEnded=true;
      parsed.priceMin=niceRound(min);
      parsed.priceMax=parsed.priceMin;
      return parsed;
    }
  }

  parsed.priceMin=niceRound(min);
  parsed.priceMax=niceRound(Math.max(min,max));
  return parsed;
}

function applyGuardrails(parsed,username,platform,lang){
  parsed.username=username;
  parsed.platform=platform;
  parsed.engineVersion=ENGINE_VERSION;
  parsed.specialCase=parsed.specialCase==='global_brand'?'global_brand':'none';
  parsed.openEnded=Boolean(parsed.openEnded);
  parsed.uncertain=Boolean(parsed.uncertain);

  if(parsed.specialCase==='global_brand') return parsed;

  let min=Math.max(0,Number(parsed.priceMin)||0);
  let max=Math.max(0,Number(parsed.priceMax)||0);
  if(min>max){const x=min;min=max;max=x;}
  parsed.priceMin=min;
  parsed.priceMax=max;

  if(platform==='instagram'){
    parsed=applyShortStructureGuardrails(parsed,username,lang);
    parsed=applyLongSeparatorGuardrails(parsed,username);
    parsed=applyPatternFivePlus(parsed,username);
  }

  if(platform==='tiktok'){
    parsed.priceMin=Math.max(0,Number(parsed.priceMin)||0);
    parsed.priceMax=Math.max(parsed.priceMin,Number(parsed.priceMax)||0);
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

  const brand=specialBrandResponse(username,platform,lang);
  if(brand) return res.status(200).json(brand);

  const anchor=anchorResponse(username,platform,lang);
  if(anchor) return res.status(200).json(anchor);

  const cacheKey=`${ENGINE_VERSION}:${platform}:${lang}:${username.toLowerCase()}`;
  const cached=valuationCache.get(cacheKey);
  if(cached) return res.status(200).json(cached);

  if(rateLimited(req)){
    return res.status(429).json({error:lang==='en'?'Too many estimates. Try again later.':'Слишком много оценок. Попробуйте позже.'});
  }
  if(!process.env.OPENAI_API_KEY){
    return res.status(503).json({error:lang==='en'?'Valuation service is not connected yet.':'Сервис оценки ещё не подключён.'});
  }

  const schema={
    type:'object',additionalProperties:false,
    properties:{
      username:{type:'string'},
      platform:{type:'string',enum:['instagram','tiktok']},
      priceMin:{type:'integer',minimum:0},
      priceMax:{type:'integer',minimum:0},
      openEnded:{type:'boolean'},
      uncertain:{type:'boolean'},
      specialCase:{type:'string',enum:['none','global_brand']},
      category:{type:'string'},
      categoryCode:{type:'string',enum:['short','english_word','russian_word_translit','other_language_word','first_name','surname','geography','numeric','pattern','leetspeak','abbreviation','random']},
      qualityScore:{type:'integer',minimum:0,maximum:100},
      liquidity:{type:'string',enum:['low','medium','high']},
      factors:{
        type:'array',minItems:3,maxItems:3,
        items:{
          type:'object',additionalProperties:false,
          properties:{title:{type:'string'},text:{type:'string'}},
          required:['title','text']
        }
      },
      disclaimer:{type:'string'}
    },
    required:['username','platform','priceMin','priceMax','openEnded','uncertain','specialCase','category','categoryCode','qualityScore','liquidity','factors','disclaimer']
  };

  const signals=formatSignals(username);
  const requestBody={
    model:process.env.VALUATION_MODEL||'gpt-5.6-luna',
    store:false,
    reasoning:{effort:'none'},
    temperature:0,
    instructions:CALIBRATION+'\n'+languageRules(lang),
    input:`Evaluate @${username} for ${platform.toUpperCase()}.
Deterministic format signals: ${JSON.stringify(signals)}
Return the SovaZone valuation range and stable classification. Use openEnded=true only for $40k+ / $50k+ style cases. Use uncertain=true only when a materially wider range is genuinely necessary.`,
    max_output_tokens:700,
    text:{verbosity:'low',format:{type:'json_schema',name:'username_valuation_v30',strict:true,schema}}
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
    const parsed=applyGuardrails(JSON.parse(txt),username,platform,lang);
    valuationCache.set(cacheKey,parsed);
    if(valuationCache.size>5000){
      const first=valuationCache.keys().next().value;
      valuationCache.delete(first);
    }
    return res.status(200).json(parsed);
  }catch(e){
    console.error('username-value v3 error',e);
    return res.status(500).json({error:lang==='en'?'Could not complete the estimate.':'Не удалось выполнить оценку.'});
  }
}
