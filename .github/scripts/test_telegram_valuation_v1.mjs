// Telegram v1.4 regression suite: USD is the price basis for 5+ characters.
import assert from 'node:assert/strict';
import handler from '../../api/telegram-username-value.js';
process.env.OPENAI_API_KEY='test-key';
const list={
 qzxvna:['random','zero','random',4], qzxv:['random','zero','random',4],
 aaaa:['pattern','strong','pattern',68],work:['english_word','premium','commercial',88],
 alex:['first_name','strong','name',91],volk:['russian_word_translit','strong','generic',78],
 hello:['english_word','medium','greeting',82],money:['english_word','premium','finance',94],
 cloud:['english_word','premium','generic',92],dream:['english_word','premium','generic',92],
 love:['english_word','strong','generic',88],pavel:['first_name','elite','platform_identity',98],
 pasha:['first_name','low','name',68],paris:['geography','micro','geography',60],
 monkey:['english_word','elite','animal',98],trading:['english_word','medium','commercial',82],
 hel_lo:['english_word','medium','generic',40],aaaaa:['pattern','strong','pattern',78],
 zzqzx65:['random','premium','random',97],smart123:['english_word','premium','commercial',95],
 num284693:['numeric','premium','generic',95],weakbrandword:['english_word','elite','generic',30],
 modest:['english_word','medium','generic',60],
 smith:['surname','strong','name',85],
 zexov:['surname','premium','name',88],
 brightforest:['english_word','premium','commercial',88,'two_word_compound'],
 rareendemic:['other_language_word','strong','generic',65,'obscure_word'],
 nametestrate:['first_name','strong','name',80],
 normalfx:['english_word','medium','generic',60]
};
const originalFetch=globalThis.fetch;
let fxDown=false, wikidataSearches=0;
globalThis.fetch=async (url,opts={})=>{
  const v=String(url);
  if(v.includes('api.coingecko.com')){
    if(fxDown)throw new Error('FX source down');
    return {ok:true,json:async()=>({'the-open-network':{usd:0.95}})};
  }
  if(v.includes('api.coinbase.com'))throw new Error('Backup down');
  if(v.includes('www.wikidata.org/w/api.php')){
    const qs=new URL(v).searchParams;
    if(qs.get('action')==='wbsearchentities'){
      wikidataSearches++;
      return {ok:true,json:async()=>({search:qs.get('search')?.toLowerCase()==='smith'?[{id:'Q12345',label:'Smith'}]:[]})};
    }
    if(qs.get('action')==='wbgetentities')return {ok:true,json:async()=>({entities:{Q12345:{claims:{P31:[{mainsnak:{datavalue:{value:{id:'Q101352'}}}}]}}}})};
    throw new Error('Unknown Wikidata API call: '+v);
  }
  if(v.includes('api.openai.com')){
    const match=String(JSON.parse(opts.body||'{}').input||'').match(/@([A-Za-z0-9_]+)/);
    const name=(match?.[1]||'').toLowerCase(),row=list[name];
    if(!row)throw new Error('No mock classification for '+name);
    const [categoryCode,marketTier,archetype,demandScore,wordStructure='none']=row;
    const c={category:categoryCode==='surname'?'Surname':'Generic word',categoryCode,marketTier,archetype,wordStructure,demandScore,
      qualityScore:demandScore,liquidity:'medium',uncertain:false,
      factors:[{title:'Claim',text:categoryCode==='surname'?'This is a surname':'Market demand'},{title:'Demand',text:'Demand tested'},{title:'Market',text:'Historical sales'}]};
    return {ok:true,json:async()=>({output_text:JSON.stringify(c)})};
  }
  throw new Error('Unexpected fetch '+v);
};
async function evaluate(username){
  let statusCode=200,payload=null;
  const req={method:'POST',headers:{origin:'https://sovazone.com','x-forwarded-for':'test-'+username},body:{username,lang:'en',website:''},socket:{remoteAddress:'127.0.0.1'}};
  const res={setHeader(){},status(n){statusCode=n;return this},json(v){payload=v;return v},end(){}};
  await handler(req,res);
  assert.equal(statusCode,200,username+': HTTP '+statusCode+' '+JSON.stringify(payload));
  return payload;
}
function checkUsd(r,min,max,u){
  assert.equal(r.engineVersion,'telegram-v1.4',u);
  assert.deepEqual([r.priceMin,r.priceMax],[min,max],u+' USD');
  assert.equal(r.priceMinTon,Math.round(min/.95),u+' TON minimum');
  assert.equal(r.priceMaxTon,Math.round(max/.95),u+' TON maximum');
}
for(const [u,min,max] of [
 ['qzxvna',0,0],['hello',100,2000],['money',1000,30000],['cloud',1000,30000],
 ['dream',1000,30000],['pavel',3500,10000],['pasha',800,3000],
 ['paris',0,50],['monkey',1000,30000],['trading',100,2000],['hel_lo',0,0],
 ['aaaaa',100,500],['zzqzx65',0,0],['smart123',0,0],['num284693',0,0],
 ['weakbrandword',5,100],['modest',100,2000],['smith',800,3000],
 ['zexov',0,50],['brightforest',5,100],['rareendemic',5,100],
 ['nametestrate',1500,6500]
]){
 const data=await evaluate(u);checkUsd(data,min,max,u);
 if(u==='smith'){
   assert.equal(data.category,'Verified surname');
   assert.equal(data.surnameEvidenceUrl,'https://www.wikidata.org/wiki/Q12345');
 }
 if(u==='zexov'){
   assert.equal(data.category,'Surname not confirmed');
   assert.equal(data.surnameEvidenceUrl,null);
   assert.ok(data.factors.every(f=>!f.text.toLowerCase().includes('this is a surname')));
 }
}
assert.ok(wikidataSearches>=2,'Independent surname verification performed');
for(const [u,min,max] of [['aaaa',6500,15000],['qzxv',6500,8500],['alex',6500,15000],['volk',6500,15000],['love',6500,15000],['work',10000,30000]]){
 const data=await evaluate(u);
 assert.deepEqual([data.priceMinTon,data.priceMaxTon],[min,max],u+' 4-character TON benchmark');
 assert.ok(data.priceMin>0,u+' USD derived from TON');
 assert.equal(data.fourCharReferenceAsOf,'2026-11-24');
}
const invalid=await evaluate('hello_');
assert.equal(invalid.specialCase,'invalid_username');
assert.deepEqual([invalid.priceMinTon,invalid.priceMaxTon],[0,0]);
const brand=await evaluate('adidas');
assert.equal(brand.specialCase,'global_brand');
// USD remains valid when crypto FX is unavailable; TON must not be fabricated.
Object.assign(globalThis.__sovaTonUsdCache,{rate:null,at:0,lastSuccessAt:0,source:'unavailable'});
fxDown=true;
const noFx=await evaluate('normalfx');
assert.deepEqual([noFx.priceMin,noFx.priceMax],[100,2000]);
assert.equal(noFx.priceMinTon,null);assert.equal(noFx.priceMaxTon,null);
const fourNoFx=await evaluate('qzxv');
assert.deepEqual([fourNoFx.priceMinTon,fourNoFx.priceMaxTon],[6500,8500]);
assert.equal(fourNoFx.priceMin,null);assert.equal(fourNoFx.priceMax,null);
globalThis.fetch=originalFetch;
console.log('PASS: Telegram v1.4 USD tiers, clean 4-char floor, independent surname proof, niche compounds, FX outage');
