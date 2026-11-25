// Only signed Telegram admins or holders of short-lived, HttpOnly browser sessions may read statistics.
import crypto from 'node:crypto';
import {verifyTelegramInitData} from './verify-telegram.js';
import {isValuationAdmin} from './analytics.js';

const PREFIX='valuation-bot/admin-codes/';
const COOKIE='sova_valuation_admin';
const CODE_TTL_MS=10*60*1000;
const SESSION_TTL_MS=8*60*60*1000;
function secret(){
  const s=process.env.VALUATION_WEBHOOK_SECRET;
  if(!s||s.length<10)throw Error('Admin session signing secret is not configured');
  return s;
}
function hmac(value){return crypto.createHmac('sha256',secret()).update(value).digest('hex')}
function codePath(code){return PREFIX+hmac('admin-login:'+code)+'.json'}
export function normalizeCode(code){return String(code||'').toUpperCase().replace(/[\s-]/g,'');}
export async function issueAdminCode(userId,{put}={}){
  if(!isValuationAdmin(userId))throw Error('Unauthorized administrator');
  if(!put)({put}=await import('@vercel/blob'));
  const code=crypto.randomBytes(10).toString('hex').toUpperCase(); // 80 bits
  await put(codePath(code),JSON.stringify({userId:Number(userId),expiresAt:Date.now()+CODE_TTL_MS}),{
    access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false
  });
  return code.replace(/(.{4})/g,'$1 ').trim();
}
export async function redeemAdminCode(candidate,{get,del}={}){
  const code=normalizeCode(candidate);
  if(!/^[A-F0-9]{20}$/.test(code))return null;
  if(!get||!del)({get,del}=await import('@vercel/blob'));
  const path=codePath(code);
  const item=await get(path,{access:'private',useCache:false});
  if(item?.statusCode!==200||!item.stream)return null;
  const row=JSON.parse(await new Response(item.stream).text());
  await del(path); // one-time, best effort (Blob delete has no atomic compare-and-swap)
  if(!Number.isSafeInteger(row.userId)||!isValuationAdmin(row.userId)||row.expiresAt<Date.now())return null;
  return row.userId;
}
export function makeAdminCookie(userId,now=Date.now()){
  if(!isValuationAdmin(userId))throw Error('Unauthorized administrator');
  const payload=Buffer.from(JSON.stringify({id:Number(userId),exp:now+SESSION_TTL_MS,v:1})).toString('base64url');
  const signature=hmac('session:'+payload);
  return COOKIE+'='+payload+'.'+signature+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+Math.floor(SESSION_TTL_MS/1000);
}
export function clearAdminCookie(){return COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'}
export function validateAdminCookie(header,now=Date.now()){
  const raw=String(header||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  if(!raw)return null;
  const token=raw.slice(COOKIE.length+1),parts=token.split('.');
  if(parts.length!==2||!/^[-_A-Za-z0-9]+$/.test(parts[0])||!/^[a-f0-9]{64}$/.test(parts[1]))return null;
  const expected=hmac('session:'+parts[0]);
  const x=Buffer.from(expected,'hex'),y=Buffer.from(parts[1],'hex');
  if(x.length!==y.length||!crypto.timingSafeEqual(x,y))return null;
  try{
    const data=JSON.parse(Buffer.from(parts[0],'base64url').toString());
    if(data.v!==1||!Number.isSafeInteger(data.id)||!isValuationAdmin(data.id)||!Number.isSafeInteger(data.exp)||data.exp<now||data.exp>now+SESSION_TTL_MS)return null;
    return data.id;
  }catch{return null}
}
export function getAdminIdentity(req){
  const telegram=verifyTelegramInitData(req.body?.initData,process.env.VALUATION_BOT_TOKEN);
  if(telegram&&isValuationAdmin(telegram.id))return telegram.id;
  return validateAdminCookie(req.headers?.cookie);
}
