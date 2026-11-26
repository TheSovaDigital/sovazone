import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';
import {issueAdminCode,redeemAdminCode,makeAdminCookie,validateAdminCookie,normalizeCode} from '../api/admin-auth.js';
import {handleAdminLogin} from '../api/admin-login.js';
import {handleAdminStats} from '../api/admin-stats.js';
import {collectStats,newEventPath} from '../api/analytics.js';

const ADMIN=573773340;
const token='12345:test-dashboard';
const secret='test-dashboard-webhook-secret-with-enough-entropy';
function env(){
  process.env.VALUATION_BOT_TOKEN=token;
  process.env.VALUATION_WEBHOOK_SECRET=secret;
  process.env.VALUATION_ADMIN_IDS=String(ADMIN);
}
function response(){
  return{code:200,body:null,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;return this},status(v){this.code=v;return this},json(v){this.body=v;return this}};
}
function signed(id){
  const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,language_code:'ru'})});
  const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
  const key=crypto.createHmac('sha256','WebAppData').update(token).digest();
  p.set('hash',crypto.createHmac('sha256',key).update(check).digest('hex'));
  return p.toString();
}
function blob(){
  const records=new Map();
  return{
    records,
    put:async(path,content,options)=>{assert.equal(options.access,'private');records.set(path,content)},
    get:async path=>records.has(path)?{statusCode:200,stream:new Blob([records.get(path)]).stream()}:null,
    del:async path=>{records.delete(path)}
  }
}
test('browser sign-in uses high entropy, private, expiring one-use code',async()=>{
  env();const db=blob();
  const human=await issueAdminCode(ADMIN,db);
  assert.match(normalizeCode(human),/^[A-F0-9]{20}$/);
  assert.equal([...db.records.keys()].some(x=>x.includes(normalizeCode(human))),false);
  assert.equal(await redeemAdminCode(human,db),ADMIN);
  assert.equal(await redeemAdminCode(human,db),null);
  assert.equal(db.records.size,0);
  await assert.rejects(()=>issueAdminCode(999,db),/Unauthorized/);
});
test('signed HttpOnly cookie rejects modification, expiry and removal from admin list',()=>{
  env();const now=Date.now();
  const header=makeAdminCookie(ADMIN,now);
  assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);assert.match(header,/Secure/);
  assert.equal(validateAdminCookie(header,now+5000),ADMIN);
  assert.equal(validateAdminCookie(header.replace(/.$/,'z'),now+5000),ADMIN); // trailing cookie attribute is not signed
  const raw=header.split(';')[0],bad=raw.slice(0,-10)+'zzzzzzzzzz';
  assert.equal(validateAdminCookie(bad,now+5000),null);
  assert.equal(validateAdminCookie(raw,now+9*3600000),null);
  process.env.VALUATION_ADMIN_IDS='123';
  assert.equal(validateAdminCookie(raw,now+5000),null);
});
test('admin statistics: no public access, only verified Telegram or browser session',async()=>{
  env();const getData=async()=>({registeredUsers:12});
  let res=response();
  await handleAdminStats({method:'POST',body:{},headers:{}},res,{readStats:getData});
  assert.equal(res.code,401);
  res=response();
  await handleAdminStats({method:'POST',body:{initData:signed(ADMIN)},headers:{}},res,{readStats:getData});
  assert.equal(res.code,200);assert.equal(res.body.stats.registeredUsers,12);
  res=response();
  await handleAdminStats({method:'POST',body:{},headers:{cookie:makeAdminCookie(ADMIN)}},res,{readStats:getData});
  assert.equal(res.code,200);
  res=response();
  await handleAdminStats({method:'POST',body:{initData:signed(111)},headers:{}},res,{readStats:getData});
  assert.equal(res.code,403);
  res=response();
  await handleAdminStats({method:'GET',body:{},headers:{}},res,{readStats:getData});
  assert.equal(res.code,405);
});
test('login endpoint exchanges one-use code for HttpOnly cookie; supports logout',async()=>{
  env();let res=response();
  await handleAdminLogin({method:'POST',body:{code:'nonsense'},headers:{}},res,{redeem:async()=>null});
  assert.equal(res.code,401);
  res=response();await handleAdminLogin({method:'POST',body:{code:'ABCD'},headers:{}},res,{redeem:async()=>ADMIN});
  assert.equal(res.code,200);assert.match(res.headers['set-cookie'],/HttpOnly/);
  res=response();await handleAdminLogin({method:'POST',body:{action:'logout'},headers:{}},res);
  assert.equal(res.code,200);assert.match(res.headers['set-cookie'],/Max-Age=0/);
});
test('rolling 7/14/30-day statistics use only observed events; funnel requires order',async()=>{
  env();const now=new Date('2026-11-25T18:00:00Z');
  const ev=[
    {userId:ADMIN,type:'bot_start',platform:'none',source:'direct'},
    {userId:ADMIN,type:'app_open',platform:'none'},
    {userId:ADMIN,type:'estimate_success',platform:'instagram'},
    {userId:41,type:'estimate_success',platform:'telegram'}
  ].map((x,i)=>({pathname:newEventPath(x,new Date('2026-11-25T12:00:0'+i+'Z'),secret)}));
  const r=await collectStats({list:async({prefix})=>({blobs:prefix==='valuation-bot/users/'?[]:ev,hasMore:false}),get:async()=>null},now);
  assert.equal(r.periods[7].valuations,2);
  assert.equal(r.periods[14].funnel.started,1);
  assert.equal(r.periods[14].funnel.opened,1);
  assert.equal(r.periods[14].funnel.evaluated,1);
  assert.equal(r.periods[14].uniqueEvaluators,2);
  assert.equal(r.series30.length,30);
  assert.equal(r.recentEvents.length,4);
  assert.equal(JSON.stringify(r).includes(String(ADMIN)),false);
});
test('dashboard uses external stylesheet under strict CSP, and contains only dynamic metrics',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../admin.css',import.meta.url),'utf8');
  const js=readFileSync(new URL('../admin.js',import.meta.url),'utf8');
  const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.match(html,/href="\/admin\.css\?v=4"/);
  assert.doesNotMatch(html,/<style[\s>]/);
  assert.match(html,/id="login-code"/);
  assert.match(html,/id="dashboard"/);
  assert.match(html,/id="activity-chart"/);
  assert.match(html,/id="export-btn"/);
  assert.ok(css.includes('.kpi-grid'));
  assert.equal((html.match(/class="kpi-title"/g)||[]).length,8);
  assert.match(css,/\.kpi-title\s*\{/);
  assert.match(css,/\.chart-frame svg \.hitbox\s*\{[^}]*stroke:none/);
  assert.match(css,/@media\(max-width:450px\)/);
  assert.match(js,/scaleMax<4\?decimal/);
  assert.ok(js.includes('/api/admin-stats'));
  assert.ok(js.includes('/api/admin-login'));
  assert.ok(vercel.headers.some(h=>h.headers.some(v=>v.key==='Content-Security-Policy'&&v.value.includes("style-src 'self'"))));
  assert.ok(vercel.rewrites.some(r=>r.source==='/admin'&&r.destination==='/admin.html'));
});

test('desktop analytics grid fills all three columns without leaving an empty row',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../admin.css',import.meta.url),'utf8');
  const names=['panel-chart','panel-platform','panel-sources','panel-funnel','panel-insights','panel-events','panel-privacy'];
  const positions=names.map(name=>html.indexOf('class="panel '+name+'"'));
  assert.ok(positions.every(n=>n>=0),'all seven panels are present');
  assert.deepEqual([...positions].sort((a,b)=>a-b),positions,'dashboard panels are placed in dense reading order');
  assert.match(css,/\.main-grid\s*\{\s*display:grid;grid-template-columns:1\.25fr 1fr 1fr/);
  assert.match(css,/\.panel-events\s*\{grid-column:span 2\}/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\.panel\{grid-column:1!important/);
});
