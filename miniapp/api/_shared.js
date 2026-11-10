import crypto from 'node:crypto';
import { put, get, list } from '@vercel/blob';

export const EVENT_TYPES = new Set(['app_open','section_view','handle_open','favorite_toggle','filter_use','search_used','sort_change','lead_click','valuation_click','ad_impression','ad_click','subscription_change']);
export const MAX_AGE_SECONDS = 24 * 60 * 60;

export function json(res,status,data){res.status(status).setHeader('Cache-Control','no-store').setHeader('Content-Type','application/json; charset=utf-8').end(JSON.stringify(data));}
export function method(req,allowed){if(!allowed.includes(req.method))throw Object.assign(new Error('Method not allowed'),{status:405});}
export function err(res,e){const status=Number(e.status)||500;json(res,status,{error:status>=500?'Service temporarily unavailable':e.message});if(status>=500)console.error('Mini app API:',e?.message||e);}
export function body(req,max=4096){const value=req.body||{};const result=typeof value==='string'?JSON.parse(value):value;if(!result||typeof result!=='object'||Array.isArray(result)||Buffer.byteLength(JSON.stringify(result))>max)throw Object.assign(new Error('Bad request'),{status:400});return result;}
export function safeId(x,max=45){return String(x||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,max)||'none';}
export function verifyInitData(raw,token=process.env.TELEGRAM_BOT_TOKEN,now=Math.floor(Date.now()/1000)){
 if(!token)throw Object.assign(new Error('Bot not connected'),{status:503});
 if(typeof raw!=='string'||!raw||raw.length>7000)throw Object.assign(new Error('Telegram login required'),{status:401});
 const params=new URLSearchParams(raw);const hash=params.get('hash');
 if(!hash||!/^[a-f0-9]{64}$/i.test(hash)||params.getAll('hash').length!==1)throw Object.assign(new Error('Invalid Telegram signature'),{status:401});
 const authDate=Number(params.get('auth_date'));
 if(!Number.isSafeInteger(authDate)||authDate>now+60||now-authDate>MAX_AGE_SECONDS)throw Object.assign(new Error('Telegram session expired'),{status:401});
 const entries=[...params].filter(([k])=>k!=='hash');
 if(new Set(entries.map(([k])=>k)).size!==entries.length)throw Object.assign(new Error('Malformed Telegram data'),{status:401});
 const data=entries.map(([k,v])=>k+'='+v).sort().join('\n');
 const secret=crypto.createHmac('sha256','WebAppData').update(token).digest();
 const expected=crypto.createHmac('sha256',secret).update(data).digest();
 const supplied=Buffer.from(hash,'hex');
 if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))throw Object.assign(new Error('Invalid Telegram signature'),{status:401});
 let user;try{user=JSON.parse(params.get('user')||'null')}catch{}
 if(!user||!Number.isSafeInteger(user.id)||user.id<1)throw Object.assign(new Error('Telegram user is missing'),{status:401});
 return {user,authDate,query:params};
}
export function currentUser(req){return verifyInitData(req.headers['x-telegram-init-data']);}
export function isAdmin(user){return String(process.env.TG_ADMIN_IDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(String(user.id));}
export function requireAdmin(req){const auth=currentUser(req);if(!isAdmin(auth.user))throw Object.assign(new Error('Admin access only'),{status:403});return auth;}
export async function blobJSON(path){try{const result=await get(path,{access:'private',useCache:false});if(!result||result.statusCode!==200||!result.stream)return null;const text=await new Response(result.stream).text();return JSON.parse(text);}catch(e){if(e?.name==='BlobNotFoundError'||e?.status===404)return null;throw e;}}
export async function writeJSON(path,data,overwrite=false){return await put(path,JSON.stringify(data),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:overwrite});}
export async function scanBlobs(prefix,limit=1500){const blobs=[];let cursor;let truncated=false;do{const remaining=limit-blobs.length;if(remaining<=0){truncated=true;break;}const page=await list({prefix,cursor,limit:Math.min(1000,remaining)});blobs.push(...page.blobs);if(!page.hasMore)break;cursor=page.cursor;}while(cursor);return {blobs,truncated};}
export function getProfilePath(id){return `subscriptions/${id}.json`;}
export async function getOptIn(id){const p=await blobJSON(getProfilePath(id));return Boolean(p?.optedIn);}
export async function updateOptIn(id,optedIn,language='ru'){const profile={userId:Number(id),optedIn:Boolean(optedIn),language:safeId(language,5),updatedAt:new Date().toISOString()};await writeJSON(getProfilePath(id),profile,true);return profile;}
export async function appendEvent(user,{type,source,lang,detail={},session='none'}){
 if(!EVENT_TYPES.has(type))throw Object.assign(new Error('Unsupported event'),{status:400});
 const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
 const slug=safeId(detail.slug||detail.section||detail.platform||detail.filter||'none',45);
 const pathname=`events/${day}/${now}-${crypto.randomUUID()}__${user.id}__${safeId(type,30)}__${slug}__${safeId(source,45)}__${safeId(lang,5)}.json`;
 await writeJSON(pathname,{type,userId:user.id,source:safeId(source,45),lang:safeId(lang,5),detail:{slug,platform:safeId(detail.platform,15),channel:safeId(detail.channel,15)},session:safeId(session,64),at:new Date(now).toISOString()});
 return true;
}
export function parseEventPath(path){const base=path.split('/').pop().replace(/\.json$/,'');const parts=base.split('__');if(parts.length!==6)return null;const [id,type,slug,source,lang]=parts.slice(1);const day=path.split('/')[1];return {id,type,slug,source,lang,day};}