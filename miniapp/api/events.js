import {currentUser,appendEvent,body,json,method,err,EVENT_TYPES} from './_shared.js';
export default async function handler(req,res){
 try{method(req,['POST']);const auth=currentUser(req);const payload=body(req,3000);
  if(!EVENT_TYPES.has(payload.type)||payload.type==='subscription_change')return json(res,400,{error:'Unsupported event'});
  if(payload.detail && (typeof payload.detail!=='object'||Array.isArray(payload.detail)))return json(res,400,{error:'Invalid event detail'});
  await appendEvent(auth.user,payload);return json(res,202,{accepted:true});
 }catch(e){err(res,e)}
}