import crypto from 'node:crypto';
import {requireAdmin,scanBlobs,blobJSON,writeJSON,body,json,method,err} from './_shared.js';
export default async function handler(req,res){
 try{requireAdmin(req);method(req,['GET','POST']);
  if(req.method==='GET'){const result=await scanBlobs('campaigns/',100);const drafts=(await Promise.all(result.blobs.slice(-50).map(x=>blobJSON(x.pathname)))).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));return json(res,200,{drafts,truncated:result.truncated});}
  const payload=body(req,3000);const title=String(payload.title||'').trim().slice(0,80),message=String(payload.message||'').trim().slice(0,1200);
  if(title.length<3||message.length<5)return json(res,400,{error:'Title or message too short'});
  const data={id:crypto.randomUUID(),title,message,segment:'subscribed_all',status:'draft',sent:0,createdAt:new Date().toISOString()};
  await writeJSON(`campaigns/${Date.now()}-${data.id}.json`,data);
  // Deliberately NO sendMessage/broadcast route: only explicit opt-in campaigns may be activated later.
  return json(res,201,{draft:data});
 }catch(e){err(res,e)}
}