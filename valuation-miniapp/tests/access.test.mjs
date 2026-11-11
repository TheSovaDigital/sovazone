import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyTelegramInitData } from '../api/verify-telegram.js';
import { verifyAccess } from '../api/access.js';
const token='12345:test-token',now=1794350000;
function signed(id=100,age=0) {
  const params=new URLSearchParams({auth_date:String(now-age),user:JSON.stringify({id,language_code:'ru'}),query_id:'abc'});
  const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(token).digest();
  const hash=crypto.createHmac('sha256',secret).update(check).digest('hex');
  params.set('hash',hash);
  return params.toString();
}
function response(){return{code:200,data:null,setHeader(){},status(n){this.code=n;return this},json(d){this.data=d;return this}}}
test('accept valid Telegram initData and reject forgeries, expired tokens, missing user',()=>{
  assert.equal(verifyTelegramInitData(signed(100),token,now)?.id,100);
  assert.equal(verifyTelegramInitData(signed(100).replace('id%22%3A100','id%22%3A101'),token,now),null);
  assert.equal(verifyTelegramInitData(signed(100),token+'wrong',now),null);
  assert.equal(verifyTelegramInitData(signed(100,90000),token,now),null);
  assert.equal(verifyTelegramInitData('',token,now),null);
  // Telegram may provide a separate Ed25519 signature alongside the hash.
  // For bot-token HMAC validation, signature IS part of the signed fields.
  const extras=new URLSearchParams({auth_date:String(now),user:JSON.stringify({id:100,language_code:'ru'}),query_id:'abc',signature:'signed_by_telegram_example'});
  const extrasCheck=[...extras.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\\n');
  const extrasSecret=crypto.createHmac('sha256','WebAppData').update(token).digest();
  extras.set('hash',crypto.createHmac('sha256',extrasSecret).update(extrasCheck).digest('hex'));
  assert.equal(verifyTelegramInitData(extras.toString(),token,now)?.id,100,'accept HMAC-signed initData with signature field');
  extras.set('signature','tampered_signature');
  assert.equal(verifyTelegramInitData(extras.toString(),token,now),null,'reject modified signature field');
});
test('access requires Telegram identity and a prior /start private record',async()=>{
 const old=process.env.VALUATION_BOT_TOKEN;process.env.VALUATION_BOT_TOKEN=token;
 try{
   const nowReal=Math.floor(Date.now()/1000);
   const params=new URLSearchParams({auth_date:String(nowReal),user:JSON.stringify({id:48,language_code:'en'})});
   const secret=crypto.createHmac('sha256','WebAppData').update(token).digest();
   const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
   params.set('hash',crypto.createHmac('sha256',secret).update(check).digest('hex'));
   const initData=params.toString();
   const authorized={get:async id=>id===48?{chatId:id,blocked:false}:null};
   let res=response();
   await verifyAccess({method:'POST',body:{initData}},res,authorized);
   assert.equal(res.code,200);assert.equal(res.data.authorized,true);
   res=response();
   await verifyAccess({method:'POST',body:{initData}},res,{get:async()=>null});
   assert.equal(res.code,403);assert.equal(res.data.reason,'start_bot_first');
   res=response();
   await verifyAccess({method:'POST',body:{initData:'fake'}},res,authorized);
   assert.equal(res.code,401);
 }finally{if(old===undefined)delete process.env.VALUATION_BOT_TOKEN;else process.env.VALUATION_BOT_TOKEN=old;}
});
