'use strict';
const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const cp = require('node:child_process');
const BASE = 'https://sovazone.com';
const result = {started:new Date().toISOString(), checks:[], failures:[], warnings:[], routeSweep:{}, valuations:[], browserErrors:[]};
const pass=(name,detail='')=>{result.checks.push({name,detail,ok:true}); console.log('PASS '+name+' '+detail)};
const fail=(name,detail='')=>{result.checks.push({name,detail,ok:false});result.failures.push({name,detail});console.log('FAIL '+name+' '+detail)};
const warn=(name,detail='')=>{result.warnings.push({name,detail});console.log('WARN '+name+' '+detail)};
const assert=(condition,name,detail='')=>condition?pass(name,detail):fail(name,detail);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function guard(name,fn){try{await fn()}catch(e){fail(name,String(e.message||e).slice(0,350))}}
const executable=cp.execSync('which google-chrome || which chromium || which chromium-browser',{encoding:'utf8'}).trim();
(async function main(){
 const browser=await puppeteer.launch({headless:true,executablePath:executable,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1440,900']});
 async function page(width=1366,height=900,blockMedia=false){
   const p=await browser.newPage(); await p.setViewport({width,height,deviceScaleFactor:1});
   p.setDefaultNavigationTimeout(18000);p.setDefaultTimeout(12000);
   p.on('pageerror',e=>{result.browserErrors.push({url:p.url(),message:String(e.message||e).slice(0,220)});});
   if(blockMedia){await p.setRequestInterception(true);p.on('request',req=>{const type=req.resourceType();const host=new URL(req.url()).hostname;if(['image','font','media'].includes(type)||(!host.endsWith('sovazone.com')&&!host.endsWith('sovazone.vercel.app')))req.abort();else req.continue();});}
   return p;
 }
 async function visit(p,path){return await p.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:18000});}
 async function sweep(){
  const files=cp.execSync("git ls-files -- '*.html'",{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  const excluded=p=>p.startsWith('admin/')||p.includes('node_modules/')||/^(?:en\/)?(?:404|header|footer|post)\.html$/.test(p)||/^(?:google|pinterest|yandex_|zen_)/.test(p.split('/').pop());
  const routes=files.filter(p=>!excluded(p)).map(p=>({file:p,path:p==='index.html'?'/':p==='en/index.html'?'/en/':'/'+p.replace(/\.html$/,'')}));
  const p=await page(1366,900,true);
  let good=0,bad=[],noH1=[],badTitle=[];
  for(let i=0;i<routes.length;i++){
   const r=routes[i];
   try{
    const resp=await visit(p,r.path);
    const status=resp?.status()||0;const doc=await p.evaluate(()=>({title:document.title,h1:document.querySelectorAll('h1').length,lang:document.documentElement.lang}));
    if(status===200)good++;else bad.push({path:r.path,status});
    if(!doc.title)badTitle.push(r.path);
    if(doc.h1!==1)noH1.push({path:r.path,h1:doc.h1});
   }catch(e){bad.push({path:r.path,error:String(e.message||e).slice(0,120)});}
   if((i+1)%30===0)console.log('ROUTE_PROGRESS '+(i+1)+'/'+routes.length);
  }
  await p.close();
  result.routeSweep={total:routes.length,good,bad,noH1,badTitle};
  assert(bad.length===0,'Production URL sweep',good+'/'+routes.length+' HTTP 200; bad='+JSON.stringify(bad.slice(0,18)));
  if(badTitle.length)warn('Missing title',JSON.stringify(badTitle.slice(0,10)));
  if(noH1.length)warn('Unusual H1 count',JSON.stringify(noH1.slice(0,10)));
 }
 async function home(lang,width){
  const pre=lang==='en'?'/en/':'/';
  const p=await page(width);await visit(p,pre);
  const key=lang+'/'+width;
  await p.waitForSelector('#latest-articles-grid .latest-article-card',{timeout:25000});
  const state=await p.evaluate(()=>({
   articleCards:[...document.querySelectorAll('#latest-articles-grid .latest-article-card')].map(x=>({title:x.querySelector('h3')?.textContent?.trim(),href:x.dataset.href})),
   cards:[...document.querySelectorAll('article.username-card')].map(x=>x.textContent),
   overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
   h1:document.querySelectorAll('h1').length,
   lang:document.documentElement.lang,
   services:[...document.querySelectorAll('a[href*="/services/"]')].length
  }));
  assert(state.articleCards.length===4,'Homepage article cards '+key,String(state.articleCards.length));
  assert(state.articleCards[0]?.href?.includes((lang==='en'?'/en':'')+'/post/instagram-username-purchase-risks'),'Homepage article chronology '+key,JSON.stringify(state.articleCards[0]));
  assert(state.cards.length===8,'Homepage username cards '+key,String(state.cards.length));
  assert(state.cards.some(s=>s.includes('7000$')),'Homepage featured price '+key);
  assert(state.h1===1 && state.lang===lang,'Homepage heading+lang '+key);
  assert(state.overflow<=5,'Homepage horizontal overflow '+key,String(state.overflow));
  await p.waitForSelector('.sz-header .sz-header__burger',{timeout:13000});
  if(width>=900){
   await p.focus('.sz-header .sz-nav-trigger');
   await p.keyboard.press('Enter'); await sleep(150);
   const opened=await p.$eval('.sz-header .sz-nav-trigger',x=>x.getAttribute('aria-expanded'));
   assert(opened==='true','Desktop header dropdown opens '+key,String(opened));
   await p.keyboard.press('Escape'); await sleep(100);
   const closed=await p.$eval('.sz-header .sz-nav-trigger',x=>x.getAttribute('aria-expanded'));
   assert(closed==='false','Desktop header Escape closes '+key,String(closed));
  }else{
   await p.click('.sz-header .sz-header__burger');await sleep(140);
   const open=await p.$eval('.sz-header .sz-side',x=>x.classList.contains('is-open'));
   assert(open,'Mobile drawer opens '+key);
   await p.keyboard.press('Escape');await sleep(170);
   const closed=await p.$eval('.sz-header .sz-side',x=>!x.classList.contains('is-open'));
   assert(closed,'Mobile drawer closes '+key);
  }
  await p.close();
 }
 async function blog(lang,width){
  const pre=lang==='en'?'/en':'';
  const p=await page(width);
  await visit(p,pre+'/blog');
  await p.waitForSelector('#blog-grid .blog-grid-card',{timeout:25000});
  let state=await p.evaluate(()=>({
    total:document.querySelectorAll('#blog-grid .blog-grid-card').length,
    featured:document.querySelector('#blog-featured')?.getAttribute('href'),
    overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
    hasError:!document.querySelector('#blog-error')?.hidden
  }));
  const key=lang+'/'+width;
  assert(state.total>=4 && !state.hasError,'Blog client-side loading '+key,JSON.stringify(state));
  assert(state.featured?.includes(pre+'/post/instagram-username-purchase-risks'),'Blog newest featured '+key,String(state.featured));
  assert(state.overflow<=5,'Blog horizontal overflow '+key,String(state.overflow));
  const news=lang==='en'?'News':'Новости';
  await p.click('.blog-filter-btn[data-filter="'+news+'"]');await sleep(180);
  let f=await p.evaluate(()=>({url:location.search,selected:document.querySelector('.blog-filter-btn.is-active')?.getAttribute('data-filter'),count:document.querySelectorAll('#blog-grid .blog-grid-card').length}));
  assert(f.url.includes('category=news')&&f.selected===news,'Blog category button '+key,JSON.stringify(f));
  await visit(p,pre+'/blog?category=articles');
  await p.waitForSelector('.blog-filter-btn.is-active',{timeout:12000});
  const category=await p.$eval('.blog-filter-btn.is-active',x=>x.dataset.filter);
  assert(category===(lang==='en'?'Articles':'Статьи'),'Blog URL category preselect '+key,String(category));
  await p.close();
 }
 async function catalog(lang,width){
  const pre=lang==='en'?'/en':'';
  const p=await page(width);const resp=await visit(p,pre+'/usernames');
  const state=await p.evaluate(()=>({count:document.querySelectorAll('article.username-card').length,detail:document.querySelector('article.username-card a[href*="username/"]')?.getAttribute('href'),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}));
  assert(resp.status()===200&&state.count>=20,'Catalog cards '+lang+'/'+width,JSON.stringify(state));
  assert(state.overflow<=5,'Catalog horizontal overflow '+lang+'/'+width,String(state.overflow));
  await p.close();
 }
 async function inspectPage(lang,path,width){
  const pre=lang==='en'?'/en':'';
  const p=await page(width);const resp=await visit(p,pre+path);
  const state=await p.evaluate(()=>({h1:document.querySelectorAll('h1').length,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,title:document.title}));
  assert(resp.status()===200 && state.h1===1 && state.overflow<=5,'Responsive static page '+lang+path+'/'+width,JSON.stringify(state));
  await p.close();
 }
 async function valuation(lang,platform,realCall){
  const pre=lang==='en'?'/en':'';
  const p=await page(1366);
  const endpointResponses=[];
  p.on('response',res=>{if(res.url().includes('/api/username-value/')||res.url().includes('/api/telegram-username-value/'))endpointResponses.push({status:res.status(),url:res.url()});});
  const resp=await visit(p,pre+'/tools/'+platform+'-username-value');
  const k=lang+'/'+platform;
  assert(resp.status()===200,'Valuation page loads '+k,String(resp.status()));
  await p.click('.uv-submit');await sleep(150);
  let msg=await p.$eval('.uv-error',e=>({visible:e.classList.contains('is-visible'),text:e.textContent.trim()}));
  assert(msg.visible && !!msg.text,'Valuation empty input validation '+k,JSON.stringify(msg));
  await p.$eval('.uv-input',e=>e.value='');
  await p.type('.uv-input',platform==='telegram'?'ab!':'ab!');
  await p.click('.uv-submit');await sleep(120);
  msg=await p.$eval('.uv-error',e=>({visible:e.classList.contains('is-visible'),text:e.textContent.trim()}));
  assert(msg.visible,'Valuation invalid username validation '+k,JSON.stringify(msg));
  if(realCall){
   await p.$eval('.uv-input',e=>e.value='');
   const handle=platform==='telegram'?'sovazoneaudit27':platform==='tiktok'?'sovazoneaudit26':'sovazoneaudit25';
   await p.type('.uv-input',handle);
   await p.click('.uv-submit');
   try{await p.waitForFunction(()=>document.querySelector('.uv-result')?.classList.contains('is-visible')||document.querySelector('.uv-error')?.classList.contains('is-visible'),{timeout:70000});}
   catch(e){warn('Valuation backend timeout '+k,String(e.message).slice(0,130))}
   const out=await p.evaluate(()=>({success:document.querySelector('.uv-result')?.classList.contains('is-visible'),error:document.querySelector('.uv-error')?.classList.contains('is-visible')?document.querySelector('.uv-error')?.textContent?.trim():'',price:document.querySelector('.uv-price')?.textContent?.trim(),resultHandle:document.querySelector('.uv-result-handle')?.textContent?.trim()}));
   result.valuations.push({platform,lang,handle,out,endpointResponses});
   assert(out.success,'Valuation live backend '+k,JSON.stringify({out,endpointResponses}));
  }
  await p.close();
 }
 try{
  await guard('Route sweep all published pages',sweep);
  for(const lang of ['ru','en']) for(const w of [390,1366]){
   await guard('Homepage '+lang+'/'+w,()=>home(lang,w));
   await guard('Blog '+lang+'/'+w,()=>blog(lang,w));
   await guard('Catalog '+lang+'/'+w,()=>catalog(lang,w));
  }
  for(const lang of ['ru','en']) for(const width of [390,768,1366]) for(const path of ['/services','/faq','/services/custom-username','/services/account-help','/tools/username-value']){
   await guard('Responsive '+lang+path+'/'+width,()=>inspectPage(lang,path,width));
  }
  for(const platform of ['instagram','tiktok','telegram']){
   await guard('Valuation RU '+platform,()=>valuation('ru',platform,true));
   await guard('Valuation EN '+platform,()=>valuation('en',platform,false));
  }
 }finally{
  result.finished=new Date().toISOString();result.summary={passed:result.checks.filter(x=>x.ok).length,failed:result.failures.length,warnings:result.warnings.length,browserErrors:result.browserErrors.length};
  fs.writeFileSync('browser-audit-results.json',JSON.stringify(result,null,2));
  console.log('QA_SUMMARY '+JSON.stringify(result.summary));
  console.log('QA_ROUTE_SWEEP '+JSON.stringify(result.routeSweep));
  console.log('QA_FAILURES '+JSON.stringify(result.failures));
  console.log('QA_WARNINGS '+JSON.stringify(result.warnings));
  console.log('QA_BROWSER_ERRORS '+JSON.stringify(result.browserErrors.slice(0,25)));
  await browser.close();
 }
 if(result.failures.length)process.exitCode=1;
})().catch(e=>{console.error('QA_FATAL',e?.stack||e);process.exitCode=2;});