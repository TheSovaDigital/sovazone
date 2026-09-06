from pathlib import Path

api = Path('api/telegram-username-value.js')
s = api.read_text()

if "const ENGINE_VERSION='telegram-v1.1';" not in s:
    raise SystemExit('Expected Telegram v1.1 backend')
s = s.replace("const ENGINE_VERSION='telegram-v1.1';", "const ENGINE_VERSION='telegram-v1.2';", 1)

old_rules = """- Globally famous trademarks are special cases and should not receive an ordinary free-market score.\n- Do not copy any historical sale price into the score.\n`;"""
new_rules = """- Globally famous trademarks are special cases and should not receive an ordinary free-market score.\n- Do not copy any historical sale price into the score.\n\nMARKET TIER\nAlso classify one deterministic marketTier. This is a demand class, not a price estimate:\n- zero: no standalone resale demand.\n- micro: recognizable but weak Telegram buyer pool, especially ordinary geography.\n- low: limited personal identity demand, weak diminutives or ordinary niche names.\n- medium: useful but not premium term, greeting or narrower commercial descriptor.\n- strong: compact strong identity term, strong transliteration or strong common name.\n- premium: broad memorable English identity term with many independent buyers.\n- elite: exceptional iconic identity or direct Telegram-specific identity association; use sparingly.\n\nARCHETYPE\nReturn archetype as one of generic, greeting, commercial, finance, animal, platform_identity, name, geography, pattern, random. Use platform_identity only when the exact word/name has an unusually strong direct association with Telegram itself.\n\nCalibration examples are classification references, not hardcoded prices:\n- aaaa => strong / pattern\n- work => premium / commercial\n- alex => strong / name\n- volk => strong / generic\n- hello => medium / greeting\n- money => premium / finance\n- cloud => premium / generic\n- dream => premium / generic\n- love => strong / generic\n- pavel => elite / platform_identity because of the Telegram founder association\n- pasha => low / name\n- paris => micro / geography\n- monkey => elite / animal\n- trading => medium / commercial\n- qzxvna => zero / random\nGeneralize these distinctions to similar usernames instead of copying the examples mechanically.\n`;"""
if old_rules not in s:
    raise SystemExit('MARKET_EVIDENCE tail not found')
s = s.replace(old_rules, new_rules, 1)

start = s.index('function telegramRange(username,classification){')
end = s.index('\nfunction localizedLiquidity', start)
new_range = r'''function legacyTier(score){
  score=Math.max(0,Math.min(100,Number(score)||0));
  if(score<=20)return 'zero';
  if(score<=55)return 'micro';
  if(score<=70)return 'low';
  if(score<=84)return 'strong';
  if(score<=94)return 'premium';
  return 'elite';
}

function tierBand(tier){
  if(tier==='zero')return [0,0];
  if(tier==='micro')return [500,1000];
  if(tier==='low')return [1000,3000];
  if(tier==='medium')return [2000,5000];
  if(tier==='strong')return [5000,10000];
  if(tier==='premium')return [10000,20000];
  if(tier==='elite')return [20000,50000];
  return [0,0];
}

function telegramRange(username,classification){
  const lower=username.toLowerCase(),len=lower.length,score=Number(classification.demandScore)||0,code=classification.categoryCode;
  const tier=classification.marketTier||legacyTier(score);
  const archetype=classification.archetype||'generic';

  if(lower.includes('_'))return {min:0,max:30,note:'underscore'};
  if(code==='random'&&tier==='zero')return {min:0,max:0,note:'random'};

  // Four-character collectible scarcity is structural, but premium semantics may move above the floor.
  if(len===4){
    if(tier==='premium')return {min:10000,max:20000,note:'four-char-premium'};
    if(tier==='elite')return {min:20000,max:50000,note:'four-char-elite'};
    return {min:5000,max:10000,note:'four-char-floor'};
  }

  if(archetype==='platform_identity'&&tier==='elite')return {min:20000,max:50000,note:'platform-identity'};
  if(archetype==='animal'&&tier==='elite')return {min:30000,max:50000,note:'elite-animal'};
  if(archetype==='finance'&&(tier==='premium'||tier==='elite'))return {min:10000,max:30000,note:'finance-premium'};
  if(code==='first_name'&&tier==='strong')return {min:5000,max:15000,note:'strong-name'};
  if(archetype==='commercial'&&tier==='medium')return {min:3000,max:5000,note:'commercial-medium'};

  const [min,max]=tierBand(tier);
  return {min,max,note:'semantic-tier'};
}
'''
s = s[:start] + new_range + s[end:]

# Add a deterministic invalid-edge-underscore response. Telegram's own UI rejects usernames
# that start or end with an underscore, so these should not be shown as ordinary tradable ranges.
insert_at = s.index('function brandResponse(username,lang,rate){')
invalid_fn = r'''function invalidUsernameResponse(username,lang){
  return {username,platform:'telegram',engineVersion:ENGINE_VERSION,priceMin:0,priceMax:0,priceMinTon:0,priceMaxTon:0,tonUsdRate:null,tonUsdSource:'not_applicable',openEnded:false,uncertain:false,specialCase:'invalid_username',category:lang==='en'?'Invalid Telegram username':'Недопустимый Telegram username',categoryCode:'special',qualityScore:0,demandScore:0,liquidity:'low',liquidityLabel:localizedLiquidity('low',lang),factors:lang==='en'?[{title:'Telegram rule',text:'A Telegram username cannot start or end with an underscore.'},{title:'Tradability',text:'An invalid public username is not assigned a normal resale range.'},{title:'Estimate',text:'SovaZone therefore shows no ordinary market value.'}]:[{title:'Правило Telegram',text:'Username Telegram не может начинаться или заканчиваться символом подчёркивания.'},{title:'Оборот',text:'Недопустимый публичный username не получает обычный диапазон перепродажи.'},{title:'Оценка',text:'Поэтому SovaZone не показывает для него обычную рыночную стоимость.'}],disclaimer:lang==='en'?'Invalid Telegram username format: no ordinary market estimate is shown.':'Недопустимый формат Telegram username: обычная рыночная оценка не показывается.'};
}

'''
s = s[:insert_at] + invalid_fn + s[insert_at:]

old_validation = """  if(!username||username.length>32||!/^[A-Za-z0-9_]+$/.test(username))return res.status(400).json({error:lang==='en'?'Invalid Telegram username format.':'Некорректный формат Telegram username.'});\n  if(username.length<4)return res.status(400).json({error:lang==='en'?'Telegram collectible valuation currently supports usernames from 4 characters.':'Оценка collectible username Telegram сейчас поддерживает ники от 4 символов.'});\n\n  const fx=await tonUsdRate();"""
new_validation = """  if(!username||username.length>32||!/^[A-Za-z0-9_]+$/.test(username))return res.status(400).json({error:lang==='en'?'Invalid Telegram username format.':'Некорректный формат Telegram username.'});\n  if(username.length<4)return res.status(400).json({error:lang==='en'?'Telegram collectible valuation currently supports usernames from 4 characters.':'Оценка collectible username Telegram сейчас поддерживает ники от 4 символов.'});\n  if(username.startsWith('_')||username.endsWith('_'))return res.status(200).json(invalidUsernameResponse(username,lang));\n\n  const fx=await tonUsdRate();"""
if old_validation not in s:
    raise SystemExit('validation block not found')
s = s.replace(old_validation, new_validation, 1)

old_schema = """const schema={type:'object',additionalProperties:false,properties:{category:{type:'string'},categoryCode:{type:'string',enum:['english_word','russian_word_translit','other_language_word','first_name','surname','geography','numeric','pattern','leetspeak','abbreviation','random']},demandScore:{type:'integer',minimum:0,maximum:100},qualityScore:{type:'integer',minimum:0,maximum:100},liquidity:{type:'string',enum:['low','medium','high']},uncertain:{type:'boolean'},factors:{type:'array',minItems:3,maxItems:3,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},text:{type:'string'}},required:['title','text']}}},required:['category','categoryCode','demandScore','qualityScore','liquidity','uncertain','factors']}"""
new_schema = """const schema={type:'object',additionalProperties:false,properties:{category:{type:'string'},categoryCode:{type:'string',enum:['english_word','russian_word_translit','other_language_word','first_name','surname','geography','numeric','pattern','leetspeak','abbreviation','random']},marketTier:{type:'string',enum:['zero','micro','low','medium','strong','premium','elite']},archetype:{type:'string',enum:['generic','greeting','commercial','finance','animal','platform_identity','name','geography','pattern','random']},demandScore:{type:'integer',minimum:0,maximum:100},qualityScore:{type:'integer',minimum:0,maximum:100},liquidity:{type:'string',enum:['low','medium','high']},uncertain:{type:'boolean'},factors:{type:'array',minItems:3,maxItems:3,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},text:{type:'string'}},required:['title','text']}}},required:['category','categoryCode','marketTier','archetype','demandScore','qualityScore','liquidity','uncertain','factors']}"""
if old_schema not in s:
    raise SystemExit('schema block not found')
s = s.replace(old_schema, new_schema, 1)
s = s.replace("name:'telegram_username_classification_v1'", "name:'telegram_username_classification_v2'", 1)

api.write_text(s)

front = Path('tools/username-value.js')
f = front.read_text()
if "'telegram-v1.1'" not in f:
    raise SystemExit('frontend Telegram cache v1.1 not found')
front.write_text(f.replace("'telegram-v1.1'", "'telegram-v1.2'", 1))

# Replace Telegram deterministic regression with v1.2 tier/archetype controls.
test = Path('.github/scripts/test_telegram_valuation_v1.mjs')
test.write_text(r'''// Permanent Telegram v1.2 deterministic regression controls.
import handler from '../../api/telegram-username-value.js';

process.env.OPENAI_API_KEY='test-key';

const classifications={
  qzxvna:{category:'Random string',categoryCode:'random',marketTier:'zero',archetype:'random',demandScore:4,qualityScore:8,liquidity:'low',uncertain:false},
  aaaa:{category:'Pattern',categoryCode:'pattern',marketTier:'strong',archetype:'pattern',demandScore:68,qualityScore:70,liquidity:'high',uncertain:false},
  work:{category:'English word',categoryCode:'english_word',marketTier:'premium',archetype:'commercial',demandScore:88,qualityScore:90,liquidity:'high',uncertain:false},
  alex:{category:'First name',categoryCode:'first_name',marketTier:'strong',archetype:'name',demandScore:91,qualityScore:92,liquidity:'high',uncertain:false},
  volk:{category:'Russian transliteration',categoryCode:'russian_word_translit',marketTier:'strong',archetype:'generic',demandScore:78,qualityScore:86,liquidity:'high',uncertain:false},
  hello:{category:'English word',categoryCode:'english_word',marketTier:'medium',archetype:'greeting',demandScore:82,qualityScore:88,liquidity:'high',uncertain:false},
  money:{category:'English word',categoryCode:'english_word',marketTier:'premium',archetype:'finance',demandScore:94,qualityScore:94,liquidity:'high',uncertain:false},
  cloud:{category:'English word',categoryCode:'english_word',marketTier:'premium',archetype:'generic',demandScore:92,qualityScore:92,liquidity:'high',uncertain:false},
  dream:{category:'English word',categoryCode:'english_word',marketTier:'premium',archetype:'generic',demandScore:92,qualityScore:92,liquidity:'high',uncertain:false},
  love:{category:'English word',categoryCode:'english_word',marketTier:'strong',archetype:'generic',demandScore:88,qualityScore:90,liquidity:'high',uncertain:false},
  pavel:{category:'First name',categoryCode:'first_name',marketTier:'elite',archetype:'platform_identity',demandScore:98,qualityScore:96,liquidity:'high',uncertain:false},
  pasha:{category:'First name',categoryCode:'first_name',marketTier:'low',archetype:'name',demandScore:68,qualityScore:75,liquidity:'medium',uncertain:false},
  paris:{category:'Geography',categoryCode:'geography',marketTier:'micro',archetype:'geography',demandScore:60,qualityScore:82,liquidity:'medium',uncertain:false},
  monkey:{category:'English word',categoryCode:'english_word',marketTier:'elite',archetype:'animal',demandScore:98,qualityScore:96,liquidity:'high',uncertain:false},
  trading:{category:'English word',categoryCode:'english_word',marketTier:'medium',archetype:'commercial',demandScore:82,qualityScore:84,liquidity:'medium',uncertain:false},
  hel_lo:{category:'English word',categoryCode:'english_word',marketTier:'medium',archetype:'generic',demandScore:40,qualityScore:35,liquidity:'low',uncertain:false}
};

const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,opts={})=>{
  const s=String(url);
  if(s.includes('api.coingecko.com'))return {ok:true,json:async()=>({'the-open-network':{usd:1.42}})};
  if(s.includes('api.openai.com')){
    const body=JSON.parse(opts.body||'{}');
    const input=String(body.input||'');
    const m=input.match(/@([A-Za-z0-9_]+)/);
    const username=(m&&m[1]||'').toLowerCase();
    const c=classifications[username];
    if(!c)throw new Error(`Missing mock classification for ${username}`);
    const factors=[{title:'Demand',text:'Mock demand factor.'},{title:'Structure',text:'Mock structure factor.'},{title:'Market',text:'Mock market factor.'}];
    return {ok:true,json:async()=>({output_text:JSON.stringify({...c,factors})})};
  }
  throw new Error(`Unexpected fetch ${s}`);
};

async function evaluate(username){
  let statusCode=200,payload=null;
  const req={method:'POST',headers:{origin:'https://sovazone.com','x-forwarded-for':`127.0.0.${Math.floor(Math.random()*200)+1}`},body:{username,lang:'en',website:''},socket:{remoteAddress:'127.0.0.1'}};
  const res={setHeader(){},status(code){statusCode=code;return this;},json(obj){payload=obj;return obj;},end(){return null;}};
  await handler(req,res);
  if(statusCode!==200)throw new Error(`${username}: HTTP ${statusCode} ${JSON.stringify(payload)}`);
  return payload;
}

const cases=[
  ['qzxvna',0,0],['aaaa',5000,10000],['work',10000,20000],['alex',5000,15000],
  ['volk',5000,10000],['hello',2000,5000],['money',10000,30000],['cloud',10000,20000],
  ['dream',10000,20000],['love',5000,10000],['pavel',20000,50000],['pasha',1000,3000],
  ['paris',500,1000],['monkey',30000,50000],['trading',3000,5000],['hel_lo',0,30]
];
for(const [u,minTon,maxTon] of cases){
  const r=await evaluate(u);
  if(r.engineVersion!=='telegram-v1.2')throw new Error(`${u}: wrong engine ${r.engineVersion}`);
  if(r.priceMinTon!==minTon||r.priceMaxTon!==maxTon)throw new Error(`${u}: TON ${r.priceMinTon}-${r.priceMaxTon}, expected ${minTon}-${maxTon}`);
  if(maxTon>0&&!(Number(r.priceMax)>0))throw new Error(`${u}: missing USD conversion`);
}
const invalid=await evaluate('hello_');
if(invalid.specialCase!=='invalid_username'||invalid.priceMinTon!==0||invalid.priceMaxTon!==0)throw new Error(`hello_: invalid edge underscore rule failed ${JSON.stringify(invalid)}`);
const brand=await evaluate('adidas');
if(brand.specialCase!=='global_brand'||brand.priceMin!==0||brand.priceMax!==0)throw new Error('Brand special case failed');
console.log('PASS 18 Telegram valuation controls on telegram-v1.2');
globalThis.fetch=originalFetch;
''')

wf = Path('.github/workflows/valuation-regression.yml')
w = wf.read_text()
w = w.replace('Telegram v1.1 regression suite.', 'Telegram v1.2 regression suite.')
w = w.replace("platform==='telegram'?'telegram-v1.1':'instagram-v3.9'", "platform==='telegram'?'telegram-v1.2':'instagram-v3.9'")
w = w.replace("if(data.engineVersion!=='telegram-v1.1')", "if(data.engineVersion!=='telegram-v1.2')")
w = w.replace('on telegram-v1.1', 'on telegram-v1.2')
wf.write_text(w)
