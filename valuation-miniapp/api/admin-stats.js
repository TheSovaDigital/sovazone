// Aggregated private analytics; access requires Telegram HMAC + configured administrator ID.
import {verifyTelegramInitData} from './verify-telegram.js';
import {isValuationAdmin,readProductionStats} from './analytics.js';
export const config={maxDuration:60};
export async function handleAdminStats(req,res,{readStats=readProductionStats}={}){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const identity=verifyTelegramInitData(req.body?.initData,process.env.VALUATION_BOT_TOKEN);
  if(!identity)return res.status(401).json({error:'Valid Telegram authorization required'});
  if(!isValuationAdmin(identity.id))return res.status(403).json({error:'Admin access denied'});
  try{
    const stats=await readStats();
    return res.status(200).json({ok:true,stats});
  }catch(e){
    console.error('Valuation admin stats error',e?.message);
    return res.status(503).json({error:'Private analytics store unavailable'});
  }
}
export default function handler(req,res){return handleAdminStats(req,res)}
