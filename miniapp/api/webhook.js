import crypto from 'node:crypto';
import {updateOptIn,json,method,err} from './_shared.js';
function equal(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
export default async function handler(req,res){
 try{method(req,['POST']);const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
  if(!secret||!equal(req.headers['x-telegram-bot-api-secret-token'],secret))return json(res,401,{error:'Invalid webhook secret'});
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)return json(res,503,{error:'Bot not connected'});
  const message=req.body?.message;if(!message?.chat?.id)return json(res,200,{ok:true});
  const text=String(message.text||'').split(' ')[0];const chatId=message.chat.id;
  let answer=null;
  if(text==='/start'||text==='/help'){
   const appUrl=process.env.PUBLIC_APP_URL;
   if(!appUrl||!/^https:\/\//.test(appUrl))return json(res,503,{error:'PUBLIC_APP_URL not configured'});
   answer={chat_id:chatId,text:'SOVA USERNAMES — редкие имена, каталог и подбор. Откройте приложение:',reply_markup:{inline_keyboard:[[{text:'Открыть SOVA',web_app:{url:appUrl}}]]}};
  }
  if(text==='/stop'){await updateOptIn(message.from?.id||chatId,false);answer={chat_id:chatId,text:'Рекламные уведомления отключены. Включить их снова можно в профиле приложения.'};}
  if(answer){const result=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(answer)});if(!result.ok)console.error('sendMessage failed',result.status);}
  return json(res,200,{ok:true});
 }catch(e){err(res,e)}
}