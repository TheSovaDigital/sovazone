'use strict';
const puppeteer=require('puppeteer-core');
const fs=require('node:fs');
const cp=require('node:child_process');
const chrome=cp.execSync('which google-chrome || which chromium',{encoding:'utf8'}).trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const data=[];
 for(const width of [390,768,1366]){
  for(const path of ['/','/blog','/usernames','/services','/faq','/tools/username-value','/en/','/en/blog']){
   const p=await browser.newPage();await p.setViewport({width,height:900,deviceScaleFactor:1});
   try{
    await p.goto('https://sovazone.com'+path,{waitUntil:'domcontentloaded',timeout:20000});
    await p.waitForSelector('.sz-header .sz-side',{timeout:12000}).catch(()=>{});
    let before=await p.evaluate(()=>{
     const w=innerWidth,html=document.documentElement,body=document.body;
     const candidates=[...document.querySelectorAll('body *')].map(e=>{
       const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
       return {el:e,right:Math.round(r.right),left:Math.round(r.left),width:Math.round(r.width),position:cs.position,visibility:cs.visibility,display:cs.display};
     }).filter(x=>x.right>w+10&&x.width>0&&x.display!=='none'&&x.visibility!=='hidden')
       .sort((a,b)=>b.right-a.right).slice(0,8).map(x=>({tag:x.el.tagName,id:x.el.id,class:String(x.el.className||'').slice(0,80),left:x.left,right:x.right,width:x.width,position:x.position}));
     return {docScrollWidth:html.scrollWidth,bodyScrollWidth:body.scrollWidth,viewport:w,htmlOverflowX:getComputedStyle(html).overflowX,bodyOverflowX:getComputedStyle(body).overflowX,initialScrollX:scrollX,candidates};
    });
    await p.mouse.move(Math.min(200,width-40),280);await p.mouse.wheel({deltaX:1000,deltaY:0});await sleep(180);
    const after=await p.evaluate(()=>scrollX);
    const row={width,path,...before,wheelScrollX:after};
    data.push(row);console.log('LAYOUT_DIAG '+JSON.stringify(row));
   }catch(e){data.push({width,path,error:String(e.message||e)});console.log('LAYOUT_DIAG_ERROR '+path+' '+e.message);}
   finally{await p.close();}
  }
 }
 fs.writeFileSync('layout-diagnosis.json',JSON.stringify(data,null,2));await browser.close();
})().catch(e=>{console.error('FATAL',e);process.exitCode=1});
