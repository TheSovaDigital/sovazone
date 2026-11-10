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
  const stored=[];const store={register:async (...args)=>{stored.push({action:'register',args})},setUpdates:async (...args)=>{stored.push({action:'updates',args})},erase:async (...args)=>{stored.push({action:'erase',args})}};
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
    assert.ok(sent[0].text.includes('Instagram'));
    assert.equal(sent[0].reply_markup.inline_keyboard[0][0].web_app.url,expectedUrl);
    const help=response();
    await handleUpdate({method:'POST',headers:{'x-telegram-bot-api-secret-token':webhookSecret},body:{message:{chat:{id:32,type:'private'},from:{language_code:'ru'},text:'/help'}}},help,store);
    assert.equal(help.code,200);
    assert.ok(sent[1].text.includes('Как пользоваться'));
    assert.equal(stored[0].action,'register');
    assert.equal(stored[0].args[0],32);
  } finally {globalThis.fetch=original}
});
