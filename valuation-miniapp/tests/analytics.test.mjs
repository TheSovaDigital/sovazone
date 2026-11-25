import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {newEventPath,recordEvent,collectStats,isValuationAdmin} from '../api/analytics.js';
import {handleEstimate} from '../api/estimate.js';
import {handleAdminStats} from '../api/admin-stats.js';
function signed(id=77){
  const token=process.env.VALUATION_BOT_TOKEN;
  const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,language_code:'ru'}),query_id:'ok'});
  const data=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(token).digest();
  p.set('hash',crypto.createHmac('sha256',secret).update(data).digest('hex'));
  return p.toString();
}
function res(){return{code:200,payload:null,setHeader(){return this},status(code){this.code=code;return this},json(data){this.payload=data;return this}};}
const envs={bot:'12345:test-analytics-token',secret:'test-analytics-secret'};
test('private event paths never contain checked username, raw user ID or price',async()=>{
  process.env.VALUATION_WEBHOOK_SECRET=envs.secret;
  const paths=[];
  await recordEvent({userId:91827364,type:'estimate_success',platform:'telegram',source:'share'},{
    put:async(path,data,options)=>{paths.push(path);assert.equal(data,'{}');assert.equal(options.access,'private');assert.equal(options.addRandomSuffix,false);}
  });
  assert.equal(paths.length,1);
  assert.ok(paths[0].startsWith('valuation-bot/events/'));
  assert.equal(paths[0].includes('91827364'),false);
  assert.equal(paths[0].includes('some_username'),false);
  assert.throws(()=>newEventPath({userId:12,type:'estimate_failed',platform:'telegram'}),/Unsupported/);
});
test('admins are required to match exact allowlisted Telegram IDs',()=>{
  assert.equal(isValuationAdmin(7,'17, 77'),false);
  assert.equal(isValuationAdmin(77,'17, 77'),true);
  assert.equal(isValuationAdmin(0,'0'),false);
  assert.equal(isValuationAdmin(77,''),false);
});
test('aggregate counts exclude identities and query texts, include per-platform activity',async()=>{
  const now=new Date('2026-11-25T12:00:00.000Z'), secret=envs.secret;
  const ev=[
    {userId:7,type:'bot_registered',platform:'none'},
    {userId:7,type:'bot_start',platform:'none',source:'share'},
    {userId:7,type:'app_open',platform:'none'},
    {userId:7,type:'estimate_success',platform:'telegram'},
    {userId:7,type:'estimate_success',platform:'instagram'},
    {userId:8,type:'bot_start',platform:'none',source:'direct'},
    {userId:8,type:'estimate_success',platform:'tiktok'}
  ].map(x=>({pathname:newEventPath(x,now,secret)}));
  const users=[{pathname:'valuation-bot/users/one.json'},{pathname:'valuation-bot/users/two.json'}];
  const store={list:async({prefix})=>({blobs:prefix==='valuation-bot/users/'?users:ev,hasMore:false}),
    get:async(path)=>({statusCode:200,stream:new Blob([JSON.stringify({newsOptIn:path.includes('one')})]).stream()})};
  const report=await collectStats(store,now);
  assert.equal(report.registeredUsers,2);
  assert.equal(report.optInUsers,1);
  assert.equal(report.botStarts30,2);
  assert.equal(report.valuationCount30,3);
  assert.deepEqual(report.byPlatform,{instagram:1,tiktok:1,telegram:1});
  assert.equal(report.uniqueActiveUsers7,2);
  assert.equal(report.newRegistrations30,1);
  assert.deepEqual(report.sources,{share:1,direct:1});
  assert.equal(JSON.stringify(report).includes('valuation-bot/users/one'),false);
});
test('estimation is HMAC-gated; count only successful verified upstream replies',async()=>{
  process.env.VALUATION_BOT_TOKEN=envs.bot;
  process.env.VALUATION_WEBHOOK_SECRET=envs.secret;
  const logged=[],upstream=[];
  const store={get:async id=>id===77?{chatId:77,blocked:false}:null};
  const mockFetch=async(url,opts)=>{upstream.push({url,body:JSON.parse(opts.body)});return{ok:true,status:200,json:async()=>({username:'alex',priceMin:500,priceMax:1500})}};
  let q=res();
  await handleEstimate({method:'POST',body:{initData:'bad',platform:'instagram',username:'alex'}},q,null,{store,upstreamFetch:mockFetch,record:async x=>logged.push(x)});
  assert.equal(q.code,401);assert.equal(upstream.length,0);
  q=res();await handleEstimate({method:'POST',body:{initData:signed(88),platform:'instagram',username:'alex'}},q,null,{store,upstreamFetch:mockFetch,record:async x=>logged.push(x)});
  assert.equal(q.code,403);
  q=res();await handleEstimate({method:'POST',body:{initData:signed(77),platform:'instagram',username:'alex'}},q,null,{store,upstreamFetch:mockFetch,record:async x=>logged.push(x)});
  assert.equal(q.code,200);
  assert.equal(logged.length,1);
  assert.deepEqual(logged[0],{userId:77,type:'estimate_success',platform:'instagram',source:'direct'});
  assert.deepEqual(Object.keys(logged[0]).sort(),['platform','source','type','userId']);
  assert.deepEqual(upstream[0].body,{username:'alex',platform:'instagram',lang:'ru',website:''});
  assert.equal(JSON.stringify(logged).includes('alex'),false);
  q=res();await handleEstimate({method:'POST',body:{initData:signed(77),platform:'instagram',username:'a'.repeat(100)}},q,null,{store,upstreamFetch:mockFetch,record:async x=>logged.push(x)});
  assert.equal(q.code,400);assert.equal(logged.length,1);
});
test('admin endpoint is fail-closed without allowlist or valid Telegram signature',async()=>{
  process.env.VALUATION_BOT_TOKEN=envs.bot;
  delete process.env.VALUATION_ADMIN_IDS;
  let invocations=0;const deps={readStats:async()=>{invocations++;return{registeredUsers:2}}};
  let q=res();await handleAdminStats({method:'POST',body:{initData:signed(77)}},q,deps);
  assert.equal(q.code,403);
  assert.equal(invocations,0);
  process.env.VALUATION_ADMIN_IDS='99,77';
  q=res();await handleAdminStats({method:'POST',body:{initData:'forged'}},q,deps);
  assert.equal(q.code,401);
  q=res();await handleAdminStats({method:'POST',body:{initData:signed(77)}},q,deps);
  assert.equal(q.code,200);assert.equal(q.payload.stats.registeredUsers,2);
  delete process.env.VALUATION_ADMIN_IDS;
});
