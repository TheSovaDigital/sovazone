'use strict';
const puppeteer=require('puppeteer-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const exec=require('node:child_process').execSync;
const executablePath=exec('which google-chrome || which chromium',{encoding:'utf8'}).trim();
const base='https://sova-valuation-ai.vercel.app';
const results={passed:[],failed:[],pageErrors:[],calls:[],started:new Date().toISOString()};
function ok(v,label,detail){if(v){results.passed.push(label);console.log('PASS',label,detail||'')}else{results.failed.push({label,detail});console.log('FAIL',label,detail||'')}}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  for(const width of [390,1366]){
   const page=await browser.newPage();await page.setViewport({width,height:850,deviceScaleFactor:1});
   // Exercise the valuation interface as an already-onboarded Telegram user.
   // Server-side initData verification and /start enforcement are tested separately.
   await page.setRequestInterception(true);
   page.on('request',request=>{
    const u=request.url();
    if(u.startsWith('https://telegram.org/js/telegram-web-app.js'))
      return request.respond({status:200,contentType:'application/javascript',body:"window.Telegram={WebApp:{initData:'ci-valid-initdata',initDataUnsafe:{user:{language_code:'en'}},ready(){},expand(){},openTelegramLink(){}}};"});
    if(u.includes('/api/access'))
      return request.respond({status:200,contentType:'application/json',body:'{"authorized":true}'});
    return request.continue();
   });
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(/\/api\/estimate/.test(r.url()))results.calls.push({url:r.url(),status:r.status()})});
   const res=await page.goto(base+'/',{waitUntil:'networkidle2',timeout:30000});
   ok([200,304].includes(res?.status()),'Homepage HTTP '+width,res?.status());
   const ready=await page.evaluate(()=>({platforms:document.querySelectorAll('.platform').length,overflow:document.documentElement.scrollWidth-innerWidth,h1:document.querySelectorAll('h1').length,button:!!document.getElementById('submit-btn')}));
   ok(ready.platforms===3&&ready.h1===1&&ready.button,'Frontend markup '+width,JSON.stringify(ready));
   ok(ready.overflow<=1,'No viewport overflow '+width,ready.overflow);
   await page.click('#submit-btn');let err=await page.$eval('#input-error',x=>({hidden:x.hidden,text:x.textContent}));ok(!err.hidden&&err.text.length>0,'Empty input validated '+width,err.text);
   await page.type('#username','ab');await page.click('#submit-btn');
   try{await page.waitForSelector('#result:not([hidden])',{timeout:60000})}catch(e){console.log('ESTIMATE_DEBUG',await page.evaluate(()=>({err:document.getElementById('input-error')?.textContent,loading:document.getElementById('loading')?.hidden,html:document.getElementById('result')?.innerText?.slice(0,160)})));throw e}
   const result=await page.evaluate(()=>({value:document.getElementById('result-price').textContent.trim(),name:document.getElementById('result-username').textContent.trim(),factors:document.querySelectorAll('#factors .factor').length,history:document.querySelectorAll('.history-item').length}));
   ok(result.name==='@ab'&&result.value.includes('$')&&result.factors>=1,'Live Instagram valuation '+width,JSON.stringify(result));
   ok(result.history>=1,'History saved locally '+width,String(result.history));
   await page.click('[data-platform="tiktok"]');await page.$eval('#username',i=>i.value='ac');await page.click('#submit-btn');
   try{await page.waitForFunction(()=>document.querySelector('#result')&&!document.querySelector('#result').hidden&&document.querySelector('#result-username').textContent==='@ac',{timeout:60000})}catch(e){console.log('TIKTOK_DEBUG',await page.evaluate(()=>({err:document.querySelector('#input-error')?.textContent,price:document.querySelector('#result-price')?.textContent})));throw e}
   ok(true,'Live TikTok valuation '+width,await page.$eval('#result-price',x=>x.textContent));
   await page.click('[data-platform="telegram"]');await page.$eval('#username',i=>i.value='apple');await page.click('#submit-btn');
   try{await page.waitForFunction(()=>document.querySelector('#result')&&!document.querySelector('#result').hidden&&document.querySelector('#result-username').textContent==='@apple',{timeout:60000})}catch(e){console.log('TELEGRAM_DEBUG',await page.evaluate(()=>({err:document.querySelector('#input-error')?.textContent,price:document.querySelector('#result-price')?.textContent})));throw e}
   ok(true,'Live Telegram valuation '+width,await page.$eval('#result-price',x=>x.textContent));
   await page.click('#lang-btn');ok((await page.$eval('html',x=>x.lang))==='ru','Language toggle '+width);
   ok(errors.length===0,'No client JS errors '+width,JSON.stringify(errors));results.pageErrors.push(...errors);
   await page.screenshot({path:'valuation-'+width+'.png',fullPage:true});
   await page.close();
  }
  const q=await browser.newPage();await q.goto(base+'/',{waitUntil:'domcontentloaded'});
  const unauth=await q.evaluate(async()=>{let a=await fetch('/api/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});return{status:a.status,text:await a.text()}});ok([403,503].includes(unauth.status),'Webhook requires secret',JSON.stringify(unauth));await q.close();
 }finally{results.finished=new Date().toISOString();results.summary={passed:results.passed.length,failed:results.failed.length,requests:results.calls};fs.writeFileSync('valuation-qa.json',JSON.stringify(results,null,2));console.log('VALUATION_QA_SUMMARY',JSON.stringify(results.summary));await browser.close()}
 if(results.failed.length)process.exitCode=1;
})().catch(e=>{console.log('VALUATION_QA_FATAL',e?.stack||e);process.exitCode=2});