// Authenticated valuation proxy. Raw username is forwarded but NEVER recorded in analytics.
import {verifyTelegramInitData} from './verify-telegram.js';
import {getProductionStore} from './subscriber-store.js';
import {recordEvent} from './analytics.js';

export const config={maxDuration:60};
export async function handleEstimate(req,res,forcedPlatform=null,{store,upstreamFetch=fetch,record=recordEvent}={}){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const body=req.body||{};
  if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>2500)
    return res.status(400).json({error:'Invalid payload'});
  const identity=verifyTelegramInitData(body.initData,process.env.VALUATION_BOT_TOKEN);
  if(!identity)return res.status(401).json({error:'Telegram authorization required'});
  const platform=forcedPlatform||String(body.platform||'');
  if(!['instagram','tiktok','telegram'].includes(platform)||(forcedPlatform==='telegram'&&body.platform&&body.platform!=='telegram'))
    return res.status(400).json({error:'Invalid platform'});
  const username=String(body.username||'').trim();
  if(!username||username.length>(platform==='telegram'?32:30)||!(platform==='telegram'?/^[A-Za-z0-9_]+$/:/^[A-Za-z0-9._]+$/).test(username))
    return res.status(400).json({error:'Invalid username'});
  const lang=body.lang==='en'?'en':'ru';
  try{
    const subscriber=await (store||await getProductionStore()).get(identity.id);
    if(!subscriber||subscriber.blocked)return res.status(403).json({error:'Start the bot before using this Mini App'});
  }catch(e){console.error('Valuation subscriber lookup failed',e?.message);return res.status(503).json({error:'Authorization service unavailable'});}
  try{
    const path=platform==='telegram'?'telegram-username-value':'username-value';
    const upstream=await upstreamFetch('https://sovazone.vercel.app/api/'+path+'/',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username,platform,lang,website:''}),
      cache:'no-store',signal:AbortSignal.timeout(55000)
    });
    const result=await upstream.json().catch(()=>null);
    if(!result||typeof result!=='object')return res.status(502).json({error:'Valuation engine unavailable'});
    if(!upstream.ok)return res.status(upstream.status>=400&&upstream.status<=599?upstream.status:502).json({error:String(result.error||'Valuation failed').slice(0,180)});
    if(result.username&&('priceMin' in result||'priceMinTon' in result)){
      try{await record({userId:identity.id,type:'estimate_success',platform,source:'direct'});}
      catch(e){console.error('Valuation analytics write failed',e?.message);}
    }
    return res.status(200).json(result);
  }catch(e){console.error('Valuation proxy error',e?.message);return res.status(502).json({error:'Valuation engine unavailable'});}
}

export default function handler(req,res){return handleEstimate(req,res);}
