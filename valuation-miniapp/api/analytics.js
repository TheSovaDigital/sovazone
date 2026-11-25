// Privacy-preserving, append-only metrics for @ValuationAiBot.
// Username queries, prices, IP addresses and Telegram IDs are never written to analytics blobs.
import crypto from 'node:crypto';

const PREFIX='valuation-bot/events/';
const TYPES=new Set(['bot_start','bot_registered','app_open','estimate_success']);
const PLATFORMS=new Set(['instagram','tiktok','telegram','none']);
export function isValuationAdmin(userId,allowlist=process.env.VALUATION_ADMIN_IDS){
  if(!Number.isSafeInteger(Number(userId))||Number(userId)<=0)return false;
  return String(allowlist||'').split(',').map(x=>x.trim()).filter(x=>/^\d+$/.test(x)).includes(String(userId));
}
function normalizeSource(source){
  const v=String(source||'direct').toLowerCase();
  return v==='share'?'share':v==='startapp'?'startapp':v==='direct'?'direct':'other';
}
export function anonymousId(userId,secret=process.env.VALUATION_WEBHOOK_SECRET){
  if(!Number.isSafeInteger(Number(userId))||Number(userId)<=0||!secret)throw Error('Analytics identity is not configured');
  return crypto.createHmac('sha256',secret).update('analytics:'+String(userId)).digest('hex').slice(0,32);
}
export function newEventPath({userId,type,platform='none',source='direct'},now=new Date(),secret){
  if(!TYPES.has(type)||!PLATFORMS.has(platform))throw Error('Unsupported analytics event');
  const id=anonymousId(userId,secret);
  return PREFIX+now.toISOString().slice(0,10)+'/'+now.getTime()+'-'+crypto.randomUUID()+'__'+type+'__'+platform+'__'+id+'__'+normalizeSource(source)+'.json';
}
export async function recordEvent(entry,{put}={}){
  if(!put)({put}=await import('@vercel/blob'));
  const pathname=newEventPath(entry);
  // The blob contains no personal data; its path carries only a keyed pseudonymous ID.
  await put(pathname,'{}',{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false});
  return true;
}
async function scan(list,prefix,cap){
  let cursor,results=[],truncated=false;
  do{
    const page=await list({prefix,cursor,limit:Math.min(1000,cap-results.length)});
    results.push(...(page.blobs||[]));
    if(!page.hasMore)break;
    if(results.length>=cap){truncated=true;break;}
    if(!page.cursor){truncated=true;break;}
    cursor=page.cursor;
  }while(true);
  return {results,truncated};
}
function decode(pathname){
  const m=String(pathname).match(/^valuation-bot\/events\/(\d{4}-\d{2}-\d{2})\/\d+-[a-f0-9-]+__(bot_start|bot_registered|app_open|estimate_success)__(instagram|tiktok|telegram|none)__([a-f0-9]{32})__(direct|share|startapp|other)\.json$/);
  return m?{day:m[1],type:m[2],platform:m[3],id:m[4],source:m[5]}:null;
}
function tally(map,key){map[key]=(map[key]||0)+1;}
export async function collectStats({list,get},now=new Date(),caps={users:3000,events:10000}){
  const limitDate=new Date(now.getTime()-30*86400000).toISOString().slice(0,10);
  const weekDate=new Date(now.getTime()-7*86400000).toISOString().slice(0,10);
  const users=await scan(list,'valuation-bot/users/',caps.users);
  const events=await scan(list,PREFIX,caps.events);
  let optIns=0,blocked=0,profilesRead=0;
  if(get){
    // Concurrency bounded: private records, never return contents or raw IDs to dashboard.
    for(let i=0;i<users.results.length;i+=20){
      await Promise.all(users.results.slice(i,i+20).map(async item=>{
        try {
          const blob=await get(item.pathname,{access:'private',useCache:false});
          if(blob?.statusCode===200&&blob.stream){
            const row=JSON.parse(await new Response(blob.stream).text());
            profilesRead++;
            if(row.newsOptIn===true&&!row.blocked)optIns++;
            if(row.blocked===true)blocked++;
          }
        }catch{/* Private store snapshot may have been concurrently deleted. */}
      }));
    }
  }
  const types={},platforms={instagram:0,tiktok:0,telegram:0},sources={},daily={};
  const active30=new Set(),active7=new Set(),evaluators30=new Set(),newRegistrations=new Set();
  let invalidEvents=0;
  for(const item of events.results){
    const row=decode(item.pathname);if(!row){invalidEvents++;continue;}
    if(row.day<limitDate||row.day>now.toISOString().slice(0,10))continue;
    tally(types,row.type);tally(daily,row.day);
    if(row.day>=weekDate)active7.add(row.id);
    active30.add(row.id);
    if(row.type==='bot_start')tally(sources,row.source);
    if(row.type==='bot_registered')newRegistrations.add(row.id);
    if(row.type==='estimate_success'){tally(platforms,row.platform);evaluators30.add(row.id);}
  }
  const lastDays=Array.from({length:14},(_,i)=>{const d=new Date(now);d.setUTCDate(d.getUTCDate()-(13-i));return d.toISOString().slice(0,10)});
  return {
    asOf:now.toISOString(),scope:'since-activation',windowDays:30,
    registeredUsers:users.results.length,registeredUsersTruncated:users.truncated,
    optInUsers:optIns,blockedUsers:blocked,profilesRead,
    botStarts30:types.bot_start||0,newRegistrations30:newRegistrations.size,
    appOpens30:types.app_open||0,valuationCount30:types.estimate_success||0,
    uniqueActiveUsers30:active30.size,uniqueActiveUsers7:active7.size,
    uniqueEvaluators30:evaluators30.size,
    byPlatform:platforms,sources,
    daily:lastDays.map(day=>({day,events:daily[day]||0})),
    eventsObserved30:Object.values(types).reduce((a,b)=>a+b,0),
    eventsTruncated:events.truncated,unrecognizedEvents:invalidEvents,
    warning:users.truncated||events.truncated?'Scan capped; counts are partial.':'Analytics starts from deployment; earlier valuation searches are not recoverable.'
  };
}
export async function readProductionStats(){
  const {list,get}=await import('@vercel/blob');
  return collectStats({list,get});
}
