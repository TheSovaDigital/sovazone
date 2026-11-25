import {redeemAdminCode,makeAdminCookie,clearAdminCookie} from './admin-auth.js';
export const config={maxDuration:15};
export async function handleAdminLogin(req,res,{redeem=redeemAdminCode}={}){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  if(req.body?.action==='logout'){
    res.setHeader('Set-Cookie',clearAdminCookie());
    return res.status(200).json({ok:true});
  }
  const code=String(req.body?.code||'');
  if(code.length>48)return res.status(400).json({ok:false,error:'Invalid login code'});
  try{
    const adminId=await redeem(code);
    if(!adminId)return res.status(401).json({ok:false,error:'Invalid or expired code'});
    res.setHeader('Set-Cookie',makeAdminCookie(adminId));
    return res.status(200).json({ok:true});
  }catch(e){
    console.error('Valuation admin sign-in failed',e?.message);
    return res.status(503).json({ok:false,error:'Sign-in is temporarily unavailable'});
  }
}
export default function handler(req,res){return handleAdminLogin(req,res)}
