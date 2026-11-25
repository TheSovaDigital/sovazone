// Aggregated private analytics; access requires Telegram HMAC + configured administrator ID.
import {readProductionStats} from './analytics.js';
import {getAdminIdentity} from './admin-auth.js';
export const config={maxDuration:60};
export async function handleAdminStats(req,res,{readStats=readProductionStats}={}){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!getAdminIdentity(req))return res.status(401).json({error:'Administrator sign-in required'});
  try{
    const stats=await readStats();
    return res.status(200).json({ok:true,stats});
  }catch(e){
    console.error('Valuation admin stats error',e?.message);
    return res.status(503).json({error:'Private analytics store unavailable'});
  }
}
export default function handler(req,res){return handleAdminStats(req,res)}
