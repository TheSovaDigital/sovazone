'use strict';
const puppeteer=require('puppeteer-core');
const fs=require('node:fs');
const exec=require('node:child_process').execSync;
const assert=require('node:assert/strict');
const executablePath=exec('which google-chrome || which chromium',{encoding:'utf8'}).trim();
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const output={passes:[],failures:[],screenshots:[]};
 function ok(v,label,detail){output[v?'passes':'failures'].push({label,detail});console.log(v?'PASS':'FAIL',label,JSON.stringify(detail||''));}
 try{
  for(const width of [320,375,390,430,768,1366]){
   const page=await browser.newPage();await page.setViewport({width,height:850,deviceScaleFactor:1});
   const jsErrors=[];page.on('pageerror',e=>jsErrors.push(e.message));
   const r=await page.goto('http://127.0.0.1:8124/',{waitUntil:'domcontentloaded',timeout:20000});
   await page.waitForSelector('.sova-footer-nav a',{timeout:10000});
   await page.evaluate(()=>{document.getElementById('access-gate').hidden=true});
   let lang=await page.$eval('html',x=>x.lang);
   if(lang!=='ru')await page.click('#lang-btn');
   const ru=await page.evaluate(()=>{
    const brand=document.querySelector('.identity').getBoundingClientRect(),right=document.querySelector('.topbar-right').getBoundingClientRect();
    return {lang:document.documentElement.lang,h1:document.querySelector('.hero h1').textContent,eyebrow:document.querySelector('.eyebrow [data-t]').textContent,logo:document.querySelector('.identity-mark img')?.getAttribute('src'),brand:document.querySelector('.identity-copy').textContent,placeholder:document.querySelector('#username').placeholder,links:[...document.querySelectorAll('.sova-footer-nav a')].map(x=>({url:x.href,text:x.textContent.trim()})),kicker:document.querySelectorAll('.section-head .section-kicker').length,viewport:innerWidth,rootWidth:document.documentElement.scrollWidth,headerGap:Math.round(right.left-brand.right),footer:document.querySelector('.sova-footer-owner').textContent,meta:document.title};
   });
   ok([200,304].includes(r.status()),'Local UI loads '+width,r.status());
   ok(ru.lang==='ru'&&ru.h1.includes('Не каждый никнейм ценен')&&ru.h1.includes('Некоторые стоят тысячи'),'RU factual hook '+width,ru.h1);
   ok(ru.eyebrow==='INTELLIGENT USERNAME VALUATION','English eyebrow in RU '+width,ru.eyebrow);
   ok(ru.logo==='/mark.svg'&&ru.brand.includes('SOVAZONE')&&ru.brand.includes('VALUATION'),'Brand and logo '+width,ru.brand);
   ok(ru.placeholder==='username'&&ru.kicker===0,'No numbering and correct placeholder '+width,ru);
   ok(ru.links.length===3&&ru.links[0].url==='https://sovazone.com/'&&ru.links[1].url==='https://t.me/SovaDigital'&&ru.links[2].url==='https://t.me/SovaUsername','Three verified links '+width,ru.links);
   ok(ru.rootWidth<=width+1,'No root overflow '+width,ru.rootWidth-width);
   const benefitRow=await page.evaluate(()=>{
     const nodes=[...document.querySelectorAll('.hero-proof > span')];
     return nodes.map(n=>{const r=n.getBoundingClientRect();return {top:Math.round(r.top),left:Math.round(r.left),right:Math.round(r.right),height:Math.round(r.height),label:n.innerText.trim()}});
   });
   ok(benefitRow.length===3&&benefitRow.every(x=>Math.abs(x.top-benefitRow[0].top)<=1)&&benefitRow.at(-1).right<=width+1,'Three benefits on one row '+width,benefitRow);

   ok(ru.headerGap>=-1,'Header does not collide '+width,ru.headerGap);
   if([390,1366].includes(width)){
    const name='valuation-sovazone-'+width+'.png';
    await page.screenshot({path:name,fullPage:true});
    output.screenshots.push(name);
   }
   await page.click('#lang-btn');
   const en=await page.evaluate(()=>({lang:document.documentElement.lang,h1:document.querySelector('.hero h1').textContent,title:document.title,footer:document.querySelector('.sova-footer-nav').textContent}));
   ok(en.lang==='en'&&en.h1.includes('Not every username')&&en.h1.includes('Some are worth thousands'),'EN headline '+width,en.h1);
   ok(en.title.includes('SovaZone Valuation AI')&&en.footer.includes('Buy a username')&&en.footer.includes('Sell a username'),'EN branding and links '+width,en);
   ok(jsErrors.length===0,'No page JS errors '+width,jsErrors);
   await page.close();
  }
 }finally{await browser.close();fs.writeFileSync('valuation-branding-qa.json',JSON.stringify(output,null,2));console.log('BRANDING_QA_SUMMARY',JSON.stringify({passed:output.passes.length,failed:output.failures.length,failures:output.failures}));}
 if(output.failures.length)process.exitCode=1;
})().catch(e=>{console.error('BRANDING_QA_FATAL',e.stack||e);process.exitCode=2});
