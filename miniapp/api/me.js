import {currentUser,isAdmin,getOptIn,json,method,err} from './_shared.js';
export default async function handler(req,res){
 try{method(req,['GET']);
  if(!process.env.TELEGRAM_BOT_TOKEN)return json(res,200,{authenticated:false,mode:'preview',admin:false,marketingOptIn:false,storageReady:false});
  const {user}=currentUser(req);
  let marketingOptIn=false;try{marketingOptIn=await getOptIn(user.id)}catch(e){console.error('Profile read:',e.message)}
  return json(res,200,{authenticated:true,mode:'telegram',admin:isAdmin(user),marketingOptIn,storageReady:true,user:{id:user.id,first_name:String(user.first_name||'').slice(0,90),username:String(user.username||'').slice(0,45),language_code:user.language_code||'ru'}});
 }catch(e){err(res,e)}
}