import test from 'node:test';
import assert from 'node:assert/strict';
import {configureBot,APP_URL} from '../scripts/configure-bot.mjs';

test('production configurator registers webhook and official Mini App',async()=>{
  const calls=[];
  const callFetch=async (url,init)=>{
    const method=url.split('/').at(-1);
    const input=JSON.parse(init.body);
    calls.push({method,input});
    const result=method==='getMe'?{username:'ValuationAiBot'}:method==='getWebhookInfo'?{url:APP_URL+'/api/webhook',pending_update_count:0}:true;
    return {ok:true,status:200,json:async()=>({ok:true,result})};
  };
  const result=await configureBot({token:'test:token',secret:'test-secret',callFetch});
  assert.equal(result.configured,true);
  assert.equal(calls[0].method,'getMe');
  assert.equal(calls.at(-1).method,'getWebhookInfo');
  assert.equal(calls.find(x=>x.method==='setWebhook').input.url,APP_URL+'/api/webhook');
  assert.equal(calls.find(x=>x.method==='setWebhook').input.secret_token,'test-secret');
  assert.equal(calls.find(x=>x.method==='setChatMenuButton').input.menu_button.web_app.url,APP_URL);
  assert.equal(calls.filter(x=>x.method==='setMyCommands').length,3);
 assert.ok(calls.find(x=>x.method==='setMyCommands'&&x.input.language_code==='ru').input.commands.some(x=>x.command==='unsubscribe'));
  assert.equal(calls.find(x=>x.method==='setMyCommands'&&x.input.language_code==='en').input.commands[1].description,'Evaluate a username');
});

test('refuses a token for a different Telegram bot before modifying anything',async()=>{
  const calls=[];
  const callFetch=async url=>{calls.push(url.split('/').at(-1));return {ok:true,status:200,json:async()=>({ok:true,result:{username:'UnrelatedBot'}})}};
  await assert.rejects(()=>configureBot({token:'test:token',secret:'s',callFetch}),/does not belong/);
  assert.deepEqual(calls,['getMe']);
});

test('no Telegram call without credentials',async()=>{
  let invoked=false;
  await assert.rejects(()=>configureBot({token:'',secret:'',callFetch:async()=>{invoked=true}}),/credentials/);
  assert.equal(invoked,false);
});
