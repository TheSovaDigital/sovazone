import test from 'node:test';
import assert from 'node:assert/strict';
import setup from '../api/setup.js';
import {handleUpdate} from '../api/webhook.js';

const expectedUrl = 'https://valuation.sovazone.com';
const setupKey = 'test-setup-key';
const webhookSecret = 'test-webhook-secret';
const botToken = '123456:test-token';
function response(){
  return {
    code: 200, payload:null, headers:{},
    setHeader(k,v){this.headers[k]=v;return this},
    status(code){this.code=code;return this},
    json(payload){this.payload=payload;return this},
    end(){return this}
  };
}
function setEnv(){
  process.env.VALUATION_BOT_TOKEN=botToken;
  process.env.VALUATION_WEBHOOK_SECRET=webhookSecret;
  process.env.VALUATION_SETUP_KEY=setupKey;
  process.env.PUBLIC_APP_URL=expectedUrl;
}

test('operator setup refuses unauthorized requests without calling Telegram',async()=>{
  setEnv();
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('Telegram must not be contacted')};
  try {
    const res=response();
    await setup({method:'GET',query:{key:'bad-key'}},res);
    assert.equal(res.code,403);
    assert.equal(calls,0);
  } finally {globalThis.fetch=original}
});

test('operator setup validates bot identity before changing config',async()=>{
  setEnv();
  const original=globalThis.fetch;const names=[];
  globalThis.fetch=async url=>{
    names.push(String(url).split('/').pop());
    return {ok:true,status:200,json:async()=>({ok:true,result:{username:'SomeOtherBot'}})};
  };
  try{
    const res=response();
    await setup({method:'GET',query:{key:setupKey}},res);
    assert.equal(res.code,409);
    assert.deepEqual(names,['getMe']);
  } finally {globalThis.fetch=original}
});

test('operator setup registers commands, menu, profile and verified webhook',async()=>{
  setEnv();const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options)=>{
    const method=String(url).split('/').pop();
    const payload=JSON.parse(options.body);calls.push({method,payload});
    const result=method==='getMe'?{username:'ValuationAiBot'}:method==='getWebhookInfo'?{url:expectedUrl+'/api/webhook'}:true;
    return {ok:true,status:200,json:async()=>({ok:true,result})};
  };
  try {
    const res=response();
    await setup({method:'GET',query:{key:setupKey}},res);
    assert.equal(res.code,200);
    assert.equal(res.payload.ok,true);
    assert.ok(calls.some(c=>c.method==='setChatMenuButton'&&c.payload.menu_button.web_app.url===expectedUrl));
    assert.ok(calls.some(c=>c.method==='setMyCommands'&&c.payload.language_code==='en'));
    assert.ok(calls.some(c=>c.method==='setMyDescription'&&c.payload.language_code==='ru'));
    const webhookCall=calls.find(c=>c.method==='setWebhook');
    assert.equal(webhookCall.payload.url,expectedUrl+'/api/webhook');
    assert.equal(webhookCall.payload.secret_token,webhookSecret);
    assert.equal(webhookCall.payload.drop_pending_updates,false);
    assert.equal(calls.at(-1).method,'getWebhookInfo');
  } finally {globalThis.fetch=original}
});

test('webhook denies unauthenticated updates and handles language-specific /start',async()=>{
  setEnv();const original=globalThis.fetch;const sent=[];
  const stored=[];const store={register:async (...args)=>{stored.push({action:'register',args})},setUpdates:async (...args)=>{stored.push({action:'updates',args})},setServiceUpdates:async (...args)=>{stored.push({action:'service-updates',args})},erase:async (...args)=>{stored.push({action:'erase',args})}};
  globalThis.fetch=async (url,options)=>{
    sent.push(JSON.parse(options.body));
    return {ok:true,status:200,json:async()=>({ok:true,result:true})};
  };
  try{
    const invalid=response();
    await handleUpdate({method:'POST',headers:{'x-telegram-bot-api-secret-token':'bad'},body:{message:{chat:{id:32,type:'private'},text:'/start'}}},invalid,store);
    assert.equal(invalid.code,403);
    assert.equal(sent.length,0);
    const valid=response();
    await handleUpdate({method:'POST',headers:{'x-telegram-bot-api-secret-token':webhookSecret},body:{message:{chat:{id:32,type:'private'},from:{language_code:'en'},text:'/start'}}},valid,store);
    assert.equal(valid.code,200);
    assert.equal(sent.length,1);
    assert.ok(sent[0].caption.includes('Instagram'));
    assert.equal(sent[0].photo,expectedUrl+'/assets/welcome-banner.jpg');
    assert.equal('text' in sent[0],false,'/start is a branded photo with caption');
    assert.equal(sent[0].reply_markup.inline_keyboard[0][0].web_app.url,expectedUrl);
    const englishButtons=sent[0].reply_markup.inline_keyboard;
    assert.deepEqual(englishButtons,[
      [{text:'Evaluate username',web_app:{url:expectedUrl}}],
      [{text:'Buy a username',url:'https://t.me/SovaDigital'},{text:'Sell a username',url:'https://t.me/SovaUsername'}],
      [{text:'Visit website',url:'https://sovazone.com/'}]
    ]);
    assert.equal(englishButtons.length,3,'one app button, two channel links in a row and one site button');
    assert.equal(JSON.stringify(englishButtons).includes('callback_data'),false,'no unwanted marketing opt-in');
    assert.doesNotMatch(sent[0].text,/Receive updates & offers/);
    assert.match(sent[0].text,/\/unsubscribe/);
    const help=response();
    await handleUpdate({method:'POST',headers:{'x-telegram-bot-api-secret-token':webhookSecret},body:{message:{chat:{id:32,type:'private'},from:{language_code:'ru'},text:'/help'}}},help,store);
    assert.equal(help.code,200);
    assert.ok(sent[1].text.includes('Как пользоваться'));
    assert.equal('photo' in sent[1],false,'/help stays a normal message');
    assert.deepEqual(sent[1].reply_markup.inline_keyboard,[
      [{text:'Оценить никнейм',web_app:{url:expectedUrl}}],
      [{text:'Купить ник',url:'https://t.me/SovaDigital'},{text:'Продать ник',url:'https://t.me/SovaUsername'}],
      [{text:'Посетить сайт',url:'https://sovazone.com/'}]
    ]);
    assert.equal(stored[0].action,'register');
    assert.equal(stored[0].args[0],32);
    const unsub=response();
    await handleUpdate({method:'POST',headers:{'x-telegram-bot-api-secret-token':webhookSecret},body:{message:{chat:{id:32,type:'private'},from:{language_code:'en'},text:'/unsubscribe'}}},unsub,store);
    assert.equal(unsub.code,200);
    assert.ok(stored.some(x=>x.action==='service-updates'&&x.args[0]===32&&x.args[2]===false));
    assert.equal(sent.at(-1).text.includes('disabled'),true);
    assert.equal('reply_markup' in sent.at(-1),false,'no marketing or navigation buttons for opt-out confirmation');
  } finally {globalThis.fetch=original}
});


test('branded greeting falls back to text if Telegram cannot fetch the photo',async()=>{
  setEnv();const sent=[];const previous=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    const method=String(url).split('/').pop();
    const payload=JSON.parse(options.body);
    sent.push({method,payload});
    if(method==='sendPhoto')return {ok:false,status:400,json:async()=>({ok:false})};
    return {ok:true,status:200,json:async()=>({ok:true,result:true})};
  };
  try{
    const store={register:async()=>({}),setUpdates:async()=>{},setServiceUpdates:async()=>{}};
    const res=response();
    await handleUpdate({method:'POST',headers:{'x-telegram-bot-api-secret-token':webhookSecret},
      body:{message:{chat:{id:88,type:'private'},from:{language_code:'ru'},text:'/start'}}},
      res,store);
    assert.equal(res.code,200);
    assert.deepEqual(sent.map(x=>x.method),['sendPhoto','sendMessage']);
    assert.ok(sent[1].payload.text.includes('Оцените никнейм'));
    assert.equal(sent[1].payload.reply_markup.inline_keyboard.length,3);
  }finally{globalThis.fetch=previous}
});
test('authorized bot profile update uploads approved JPEG using Telegram multipart API',async()=>{
  setEnv();const original=globalThis.fetch,methods=[];
  globalThis.fetch=async(url,options)=>{
    if(String(url)===expectedUrl+'/assets/bot-avatar.jpg'){
      return {ok:true,headers:{get:()=> 'image/jpeg'},arrayBuffer:async()=>new Uint8Array(1536).buffer};
    }
    const method=String(url).split('/').pop();methods.push(method);
    if(method==='setMyProfilePhoto'){
      assert.ok(options.body instanceof FormData,'multipart upload required');
      assert.deepEqual(JSON.parse(options.body.get('photo')),
        {type:'static',photo:'attach://avatar'});
      assert.equal(options.body.get('avatar').type,'image/jpeg');
      return {ok:true,status:200,json:async()=>({ok:true,result:true})};
    }
    const result=method==='getMe'?{username:'ValuationAiBot'}:
      method==='getWebhookInfo'?{url:expectedUrl+'/api/webhook'}:true;
    return {ok:true,status:200,json:async()=>({ok:true,result})};
  };
  try{
    const res=response();
    await setup({method:'GET',query:{key:setupKey,profile:'1'}},res);
    assert.equal(res.code,200);
    assert.equal(res.payload.profileUpdated,true);
    assert.equal(methods.includes('setMyProfilePhoto'),true);
    const denied=response();
    await setup({method:'GET',query:{key:'incorrect',profile:'1'}},denied);
    assert.equal(denied.code,403);
  }finally{globalThis.fetch=original}
});
