import {currentUser,updateOptIn,appendEvent,body,json,method,err} from './_shared.js';
export default async function handler(req,res){
 try{method(req,['POST']);const {user}=currentUser(req);const payload=body(req,512);
  if(typeof payload.optedIn!=='boolean')return json(res,400,{error:'Expected optedIn boolean'});
  const result=await updateOptIn(user.id,payload.optedIn,user.language_code||'ru');
  await appendEvent(user,{type:'subscription_change',source:'profile',lang:user.language_code||'ru'});
  return json(res,200,{marketingOptIn:result.optedIn});
 }catch(e){err(res,e)}
}