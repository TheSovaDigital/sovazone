// Configure @ValuationAiBot during an authorized Vercel production deployment.
// The bot token remains in Vercel environment variables; never log it.
export const APP_URL='https://valuation.sovazone.com';
export const TELEGRAM_USERNAME='ValuationAiBot';

const COMMANDS={
  ru:[
    {command:'start',description:'Открыть Valuation AI'},
    {command:'estimate',description:'Оценить никнейм'},
    {command:'help',description:'Как работает оценка'},
    {command:'privacy',description:'Конфиденциальность'}
  ],
  en:[
    {command:'start',description:'Open Valuation AI'},
    {command:'estimate',description:'Evaluate a username'},
    {command:'help',description:'How valuation works'},
    {command:'privacy',description:'Privacy information'}
  ]
};

export async function configureBot({token,secret,callFetch=fetch}={}){
  if(!token||!secret)throw Error('Required Telegram credentials are not configured');
  const base='https://api.telegram.org/bot'+token+'/';
  async function botApi(method,payload={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),14000);
    let response;
    try{
      response=await callFetch(base+method,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
        signal:controller.signal
      });
    }finally{clearTimeout(timer)}
    if(!response.ok)throw Error('Telegram Bot API '+method+' returned HTTP '+response.status);
    const data=await response.json();
    if(!data.ok)throw Error('Telegram Bot API rejected '+method);
    return data.result;
  }
  const identity=await botApi('getMe');
  if(String(identity.username||'').toLowerCase()!==TELEGRAM_USERNAME.toLowerCase()){
    throw Error('The stored token does not belong to @ValuationAiBot');
  }

  await botApi('setMyName',{name:'Valuation AI'});
  await botApi('setMyName',{name:'Valuation AI — Оценка никнеймов',language_code:'ru'});
  await botApi('setMyName',{name:'Valuation AI — Username Valuation',language_code:'en'});

  await botApi('setMyDescription',{description:'Оценка никнеймов Instagram, TikTok и Telegram. Выберите платформу и получите ориентировочную стоимость, качество, ликвидность и ключевые факторы оценки. Результат не подтверждает доступность или право владения никнеймом.',language_code:'ru'});
  await botApi('setMyDescription',{description:'Evaluate Instagram, TikTok and Telegram usernames. Choose a platform and get an indicative value range, quality and liquidity indicators, and the key valuation factors. Results do not verify ownership or availability.',language_code:'en'});
  await botApi('setMyDescription',{description:'Оценка никнеймов Instagram, TikTok и Telegram: стоимость, качество, ликвидность и основные факторы.'});

  await botApi('setMyShortDescription',{short_description:'Оценка никнеймов Instagram, TikTok и Telegram с помощью Valuation AI.',language_code:'ru'});
  await botApi('setMyShortDescription',{short_description:'Instagram, TikTok and Telegram username valuation by Valuation AI.',language_code:'en'});
  await botApi('setMyShortDescription',{short_description:'Оценка никнеймов Instagram, TikTok и Telegram.'});

  await botApi('setMyCommands',{commands:COMMANDS.ru});
  await botApi('setMyCommands',{commands:COMMANDS.ru,language_code:'ru'});
  await botApi('setMyCommands',{commands:COMMANDS.en,language_code:'en'});
  await botApi('setChatMenuButton',{menu_button:{type:'web_app',text:'Оценить никнейм',web_app:{url:APP_URL}}});

  await botApi('setWebhook',{
    url:APP_URL+'/api/webhook',
    secret_token:secret,
    allowed_updates:['message','callback_query','my_chat_member'],
    drop_pending_updates:false
  });
  const info=await botApi('getWebhookInfo');
  if(info.url!==APP_URL+'/api/webhook')throw Error('Telegram did not confirm the expected webhook');
  return {bot:'@'+identity.username,webhook:info.url,configured:true};
}

if(import.meta.url==='file://'+process.argv[1]){
  // Run only inside a production build. Never touch the bot in preview or local installs.
  if(process.env.VERCEL_ENV==='production'&&process.env.VERCEL==='1'){
    try{
      const result=await configureBot({
        token:process.env.VALUATION_BOT_TOKEN,
        secret:process.env.VALUATION_WEBHOOK_SECRET
      });
      console.log('Telegram bot configured successfully for '+result.bot+'; webhook registered');
    }catch(error){
      console.error('Telegram bot configuration failed:',error.message);
      process.exitCode=1;
    }
  }else{
    console.log('Telegram bot configuration skipped outside Vercel production');
  }
}
