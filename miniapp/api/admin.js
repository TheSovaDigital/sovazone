import {requireAdmin,scanBlobs,parseEventPath,json,method,err} from './_shared.js';
const countMap=(map,label)=>map.set(label,(map.get(label)||0)+1);
const rows=(map,limit=8)=>[...map].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,limit);
export default async function handler(req,res){
 try{method(req,['GET']);requireAdmin(req);
  const now=new Date();const days=Array.from({length:30},(_,i)=>{const d=new Date(now);d.setUTCDate(now.getUTCDate()-i);return d.toISOString().slice(0,10)});
  const allUsers=new Set(),recentUsers=new Set(),leads=new Set(),sourceMap=new Map(),languageMap=new Map(),handleMap=new Map(),uniquePerDay=new Map();let truncated=false,eventsCount=0;
  // The initial analytics storage is append-only. We page explicitly and report sampling limits.
  for(const day of days){const part=await scanBlobs('events/'+day+'/',1800);truncated ||= part.truncated;
   for(const meta of part.blobs){const item=parseEventPath(meta.pathname);if(!item)continue;eventsCount++;
    allUsers.add(item.id);if(days.indexOf(day)<7)recentUsers.add(item.id);
    if(item.type==='app_open'){countMap(sourceMap,item.source||'direct');countMap(languageMap,item.lang||'ru');let s=uniquePerDay.get(day);if(!s){s=new Set();uniquePerDay.set(day,s)}s.add(item.id)}
    if(item.type==='lead_click')leads.add(meta.pathname);
    if(item.type==='handle_open')countMap(handleMap,item.slug);
   }
  }
  const subscribers=await scanBlobs('subscriptions/',20000);truncated ||= subscribers.truncated;
  const {blobJSON}=await import('./_shared.js');let optedInSubscribers=0;
  // A full subscriber count is exact for stores under the documented cap.
  for(const chunk of Array.from({length:Math.ceil(subscribers.blobs.length/30)},(_,i)=>subscribers.blobs.slice(i*30,i*30+30))){const results=await Promise.all(chunk.map(b=>blobJSON(b.pathname).catch(()=>null)));optedInSubscribers+=results.filter(x=>x?.optedIn).length;}
  const activity7=days.slice(0,7).reverse().map(date=>({date,count:uniquePerDay.get(date)?.size||0}));
  return json(res,200,{asOf:now.toISOString(),uniqueUsers30:allUsers.size,activeUsers7:recentUsers.size,leads30:leads.size,optedInSubscribers,activity7,sources:rows(sourceMap),languages:rows(languageMap),topHandles:rows(handleMap,10),eventsObserved:eventsCount,truncated,storage:'private-blob',note:truncated?'Analytics scan limit reached':'Events observed within the last 30 UTC days'});
 }catch(e){err(res,e)}
}