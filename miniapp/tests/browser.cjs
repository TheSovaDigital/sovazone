const puppeteer=require('puppeteer-core');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const BASE=process.env.MINIAPP_URL || 'https://sova-username-miniapp.vercel.app';
const path='/tmp/sova-miniapp-browser-screens';
let passed=0;
function ok(value,label,details){assert.ok(value,label+(details?' '+JSON.stringify(details):''));passed++;console.log('PASS '+label);}
async function test(){
const chrome=cp.execSync('which google-chrome || which chromium',{encoding:'utf8'}).trim();
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
fs.mkdirSync(path,{recursive:true});
try{
for(const width of [390,1366]){
const page=await browser.newPage();await page.setViewport({width,height:860,deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const response=await page.goto(BASE,{waitUntil:'networkidle2',timeout:45000});
ok(response.status()===200,'Landing HTTP '+width);
await page.waitForSelector('#catalog-grid article.username-card',{timeout:16000});
let state=await page.evaluate(()=>({cards:document.querySelectorAll('#catalog-grid article.username-card').length,hero:document.querySelector('.hero h1')?.textContent,visible:document.querySelector('.screen.is-current')?.dataset.screen,root:document.documentElement.scrollWidth,viewport:innerWidth,notificationsDisabled:document.querySelector('#marketing-opt-in')?.disabled}));
ok(state.cards===31,'31 available catalog listings '+width,state);
ok(state.visible==='catalog','Landing catalog screen '+width);
ok(state.root<=state.viewport+5,'No horizontal overflow '+width,state);
await page.screenshot({path:path+'/catalog-'+width+'.png',fullPage:true});
await page.type('#catalog-search','Nietzsche');
state=await page.evaluate(()=>({cards:document.querySelectorAll('#catalog-grid article.username-card').length,text:document.querySelector('#catalog-grid .handle')?.textContent}));
ok(state.cards===1&&state.text.includes('Nietzsche'),'Catalog search '+width,state);
await page.$eval('#catalog-search',x=>{x.value='';x.dispatchEvent(new Event('input',{bubbles:true}))});
await page.click('[data-filter="short"]');
state=await page.evaluate(()=>({count:document.querySelectorAll('#catalog-grid article.username-card').length,active:document.querySelector('.chip.active')?.dataset.filter}));
ok(state.count>=2&&state.active==='short','Filter short usernames '+width,state);
await page.click('[data-filter="all"]');
await page.evaluate(()=>window.scrollBy(0,450));
await new Promise(r=>setTimeout(r,180));
const scrollInfo=await page.evaluate(()=>({scrollY,scrollHeight:document.documentElement.scrollHeight,viewport:innerHeight,card:document.querySelector('#catalog-grid .card-open')?.getBoundingClientRect().top}));
console.log('CARD_SCROLL',JSON.stringify(scrollInfo));
ok(scrollInfo.scrollY>20,'Catalog scrolls normally '+width,scrollInfo);
await page.$eval('#catalog-grid .card-open',el=>el.scrollIntoView({block:'center'}));
await page.click('#catalog-grid .card-open');
try{await page.waitForSelector('#modal-overlay:not([hidden])',{timeout:7000})}catch(error){const debug=await page.evaluate(()=>({overlayHidden:document.querySelector('#modal-overlay')?.hidden,screen:document.querySelector('.screen.is-current')?.id,buttons:[...document.querySelectorAll('#catalog-grid .card-open')].slice(0,2).map(x=>x.outerHTML),bodyScrollY:window.scrollY}));console.log('MODAL_DEBUG',JSON.stringify(debug));throw error;}
ok((await page.$eval('#detail-title',x=>x.textContent)).startsWith('@'),'Product details modal '+width);
await page.click('#modal-close');
ok(await page.$eval('#modal-overlay',x=>x.hidden),'Product modal closes '+width);
await page.click('#catalog-grid article.username-card .heart-button');
await page.click('[data-tab="favorites"]');
state=await page.evaluate(()=>({visible:document.querySelector('.screen.is-current')?.dataset.screen,count:document.querySelectorAll('#favorites-grid article.username-card').length}));
ok(state.visible==='favorites'&&state.count===1,'Favorites persisted '+width,state);
await page.click('[data-tab="valuation"]');
ok(await page.$eval('#screen-valuation',x=>x.classList.contains('is-current')),'Independent valuation page '+width);
await page.click('[data-tab="profile"]');
state=await page.evaluate(()=>({screen:document.querySelector('.screen.is-current')?.dataset.screen,disabled:document.querySelector('#marketing-opt-in').disabled,adminHidden:document.querySelector('#admin-entry').hidden}));
ok(state.screen==='profile'&&state.disabled&&state.adminHidden,'Demo privacy gates '+width,state);
await page.click('#language-switch');
ok(await page.$eval('html',x=>['ru','en'].includes(x.lang)),'RU/EN language switch '+width);
await page.screenshot({path:path+'/profile-'+width+'.png',fullPage:true});
ok(errors.length===0,'No uncaught browser JS errors '+width,errors);
await page.close();
}
if(process.env.MINIAPP_LOCAL!=='1'){
const api=await fetch(BASE+'/api/me');const me=await api.json();ok(api.ok&&!me.authenticated,'API demo explicitly unauthenticated',me);
const notAdmin=await fetch(BASE+'/api/admin');ok(notAdmin.status===401||notAdmin.status===503,'Analytics protected',notAdmin.status);
}
console.log('ALL MINIAPP BROWSER CHECKS PASSED '+passed);
}finally{await browser.close()}}
test().catch(e=>{console.error('QA_FAIL',e.stack||e);process.exitCode=1});