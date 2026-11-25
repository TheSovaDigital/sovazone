// Mini App onboarding gate: a verified Telegram identity must already have sent /start.
import { verifyTelegramInitData } from './verify-telegram.js';
import { getProductionStore } from './subscriber-store.js';
import { recordEvent,isValuationAdmin } from './analytics.js';
export async function verifyAccess(req, res, injectedStore, injectedRecord) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({authorized:false,error:'Method not allowed'});
  const data = verifyTelegramInitData(req.body?.initData,process.env.VALUATION_BOT_TOKEN);
  if (!data) { console.info('Valuation access denied: invalid Telegram initData'); return res.status(401).json({authorized:false,reason:'telegram_login_required'}); }
  try {
    const store=injectedStore || await getProductionStore();
    const subscriber=await store.get(data.id);
    if (!subscriber || subscriber.blocked) { console.info('Valuation access denied: user has not started bot or bot blocked'); return res.status(403).json({authorized:false,reason:'start_bot_first'}); }
    const record=injectedRecord||(injectedStore?null:recordEvent);
    if(record)try{await record({userId:data.id,type:'app_open',source:'direct'});}catch(e){console.error('Valuation open metric failed',e?.message);}
    return res.status(200).json({authorized:true,admin:isValuationAdmin(data.id)});
  } catch(e) {
    console.error('Valuation AI subscriber check failed:',e?.message||'unknown');
    return res.status(503).json({authorized:false,reason:'temporary_error'});
  }
}
export default function handler(req,res){return verifyAccess(req,res)}
