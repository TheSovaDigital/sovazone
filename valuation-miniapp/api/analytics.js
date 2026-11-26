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
  const days=Array.from({length:30},(_,i)=>{
    const date=new Date(now);date.setUTCHours(0,0,0,0);date.setUTCDate(date.getUTCDate()-(29-i));
    return date.toISOString().slice(0,10);
  });
  const today=days[29],dateFloor=days[0];
  const users=await scan(list,'valuation-bot/users/',caps.users);
  const events=await scan(list,PREFIX,caps.events);
  let optIns=0,serviceUpdatesUsers=0,blocked=0,profilesRead=0;
  if(get){
    for(let i=0;i<users.results.length;i+=20){
      await Promise.all(users.results.slice(i,i+20).map(async item=>{
        try{
          const blob=await get(item.pathname,{access:'private',useCache:false});
          if(blob?.statusCode===200&&blob.stream){
            const row=JSON.parse(await new Response(blob.stream).text());
            profilesRead++;
            if(row.newsOptIn===true&&!row.blocked)optIns++;
            if(row.serviceUpdatesEnabled===true&&!row.blocked)serviceUpdatesUsers++;
            if(row.blocked===true)blocked++;
          }
        }catch{/* Subscription deleted while scanning, or unreadable. */}
      }));
    }
  }
  const dailyMap=new Map(days.map(day=>[day,{
    day,events:0,botStarts:0,registrations:0,appOpens:0,valuations:0,
    instagram:0,tiktok:0,telegram:0,sources:{},unique:new Set()
  }]));
  const accepted=[];let invalidEvents=0;
  for(const item of events.results){
    const row=decode(item.pathname);
    if(!row){invalidEvents++;continue;}
    if(row.day<dateFloor||row.day>today)continue;
    const d=dailyMap.get(row.day);
    if(!d)continue;
    const timestamp=Number(String(item.pathname).split('/').pop().split('-')[0]);
    row.timestamp=Number.isSafeInteger(timestamp)?timestamp:Date.parse(row.day+'T12:00:00Z');
    accepted.push(row);d.events++;d.unique.add(row.id);
    if(row.type==='bot_start'){d.botStarts++;tally(d.sources,row.source);}
    if(row.type==='bot_registered')d.registrations++;
    if(row.type==='app_open')d.appOpens++;
    if(row.type==='estimate_success'){
      d.valuations++;
      if(Object.hasOwn(d,row.platform))d[row.platform]++;
    }
  }
  accepted.sort((a,b)=>a.timestamp-b.timestamp);
  const periods={};
  for(const length of [7,14,30]){
    const floor=days[30-length];
    const selected=accepted.filter(x=>x.day>=floor);
    const unique=new Set(),evalUsers=new Set(),regUsers=new Set(),startUsers=new Set();
    const platform={instagram:0,tiktok:0,telegram:0},sources={direct:0,share:0,startapp:0,other:0};
    let botStarts=0,appOpens=0,valuations=0;
    const started=new Set(),opened=new Set(),completed=new Set();
    for(const row of selected){
      unique.add(row.id);
      if(row.type==='bot_start'){
        botStarts++;startUsers.add(row.id);tally(sources,row.source);started.add(row.id);
      }
      if(row.type==='bot_registered')regUsers.add(row.id);
      if(row.type==='app_open'){
        appOpens++;if(started.has(row.id))opened.add(row.id);
      }
      if(row.type==='estimate_success'){
        valuations++;evalUsers.add(row.id);
        if(Object.hasOwn(platform,row.platform))platform[row.platform]++;
        if(opened.has(row.id))completed.add(row.id);
      }
    }
    periods[length]={
      days:length,botStarts,appOpens,valuations,
      registrations:regUsers.size,uniqueActiveUsers:unique.size,
      uniqueEvaluators:evalUsers.size,uniqueBotUsers:startUsers.size,
      byPlatform:platform,sources,
      funnel:{started:started.size,opened:opened.size,evaluated:completed.size}
    };
  }
  const series30=days.map(day=>{
    const row=dailyMap.get(day);
    return {
      day,events:row.events,botStarts:row.botStarts,registrations:row.registrations,
      appOpens:row.appOpens,valuations:row.valuations,uniqueUsers:row.unique.size,
      instagram:row.instagram,tiktok:row.tiktok,telegram:row.telegram
    };
  });
  const recentEvents=accepted.slice(-25).reverse().map(x=>({
    time:new Date(x.timestamp).toISOString(),type:x.type,
    platform:x.platform,source:x.type==='bot_start'?x.source:null
  }));
  const p=periods[30];
  return {
    asOf:now.toISOString(),scope:'since-activation',windowDays:30,
    registeredUsers:users.results.length,registeredUsersTruncated:users.truncated,
    optInUsers:optIns,serviceUpdatesUsers,blockedUsers:blocked,profilesRead,
    botStarts30:p.botStarts,newRegistrations30:p.registrations,appOpens30:p.appOpens,
    valuationCount30:p.valuations,uniqueActiveUsers30:p.uniqueActiveUsers,
    uniqueActiveUsers7:periods[7].uniqueActiveUsers,uniqueEvaluators30:p.uniqueEvaluators,
    byPlatform:p.byPlatform,sources:p.sources,
    daily:series30.slice(-14),series30,periods,recentEvents,
    eventsObserved30:accepted.length,eventsTruncated:events.truncated,unrecognizedEvents:invalidEvents,
    warning:users.truncated||events.truncated
      ?'Analytics scan cap reached; some totals and trends may be incomplete.'
      :'Historical estimates before analytics activation cannot be recovered.'
  };
}
export async function readProductionStats(){
  const {list,get}=await import('@vercel/blob');
  return collectStats({list,get});
}
