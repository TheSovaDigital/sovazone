import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
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
  const extrasCheck=[...extras.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
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

test('Mini App waits for verified Telegram access before displaying onboarding gate',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.match(html,/id="access-gate"[\s\S]*?hidden>/);
  assert.doesNotMatch(js,/showAccessGate\('start'\);verifyAccessOnOpen\(\)/);
  assert.match(js,/els\.submit\.disabled=true;\s*verifyAccessOnOpen\(\)/);
  assert.match(js,/if \(resp\.ok && data\.authorized\)/);
  assert.match(js,/else showAccessGate\(resp\.status===403\?'start':'error'\)/);
  assert.match(html,/app\.js\?v=7/);
});
test('Telegram Mini App expands and requests fullscreen only when supported, with fallback and safe area',()=>{
  const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.match(js,/telegram\.ready\?\.\(\)/);
  assert.match(js,/telegram\.expand\?\.\(\)/);
  assert.match(js,/typeof telegram\.requestFullscreen === 'function'/);
  assert.match(js,/telegram\.isVersionAtLeast\('8\.0'\)/);
  assert.match(js,/telegram\.requestFullscreen\(\)/);
  assert.match(js,/telegram\.onEvent\?\.\('fullscreenFailed'/);
  assert.match(css,/--tg-content-safe-area-inset-top/);
  assert.match(css,/--tg-content-safe-area-inset-bottom/);
});

test('Desktop Telegram never triggers expand or fullscreen and mobile content clears native controls',()=>{
  const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(js,/if \(!isTelegramMobileClient\(\)\) return;/);
  assert.match(js,/\['tdesktop','macos','unigram','web','weba','webk','windows'\]/);
  assert.match(js,/\['ios','android','android_x'\]/);
  assert.match(css,/html\.tg-mobile\.tg-fullscreen \.shell/);
  assert.match(css,/padding-top:max\(104px/);
  assert.match(css,/--tg-content-safe-area-inset-top/);
  assert.match(html,/class="identity-overline">SovaZone\.com/);
  assert.match(html,/<b>VALUATION<span>AI<\/span><\/b><small>USERNAME VALUATION<\/small>/);
  assert.match(html,/class="identity-mark"/);
  assert.equal((html.match(/data-language="(?:ru|en)"/g)||[]).length,2);
  assert.match(html,/class="sova-lang-toggle"/);
  assert.match(js,/button\.setAttribute\('aria-pressed',String\(active\)\)/);
});

test('Telegram viewport behavior: iPhone fullscreen; desktop stays windowed',()=>{
  const script=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const viewportScript=script.slice(0,script.indexOf('\nconst copy ='));
  assert.ok(viewportScript.includes('initializeTelegramViewport()'));
  const emulate=(platform,userAgent)=>{
    const calls=[],classes=new Set();
    const webapp={
      platform,isFullscreen:false,
      ready:()=>calls.push('ready'),expand:()=>calls.push('expand'),
      requestFullscreen:()=>calls.push('fullscreen'),isVersionAtLeast:()=>true,
      setHeaderColor:()=>{},setBackgroundColor:()=>{},onEvent:()=>{}
    };
    vm.runInNewContext(viewportScript,{
      window:{Telegram:{WebApp:webapp}},
      navigator:{userAgent},
      document:{documentElement:{classList:{
        add:(name)=>classes.add(name),
        toggle:(name,on)=>{if(on)classes.add(name);else classes.delete(name)}
      }}}
    });
    return {calls,classes};
  };
  const ios=emulate('ios','Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
  assert.deepEqual(ios.calls,['ready','expand','fullscreen']);
  assert.equal(ios.classes.has('tg-mobile'),true);
  const android=emulate('android','Mozilla/5.0 (Linux; Android 15; Mobile)');
  assert.deepEqual(android.calls,['ready','expand','fullscreen']);
  for(const desktopPlatform of ['tdesktop','macos','unigram','weba','webk']){
    const desktop=emulate(desktopPlatform,'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    assert.deepEqual(desktop.calls,['ready'],desktopPlatform+' must not expand or fullscreen');
    assert.equal(desktop.classes.has('tg-mobile'),false);
  }
  const unsupported=emulate('tdesktop','Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
  assert.deepEqual(unsupported.calls,['ready'],'desktop platform takes priority over user agent');
});
