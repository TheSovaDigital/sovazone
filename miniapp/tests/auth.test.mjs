import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {verifyInitData,safeId,parseEventPath,EVENT_TYPES} from '../api/_shared.js';
const TOKEN='123456:TEST_BOT_TOKEN_NOT_REAL';
function sign(params){const data=new URLSearchParams(params);const check=[...data].map(([k,v])=>k+'='+v).sort().join('\n');const key=crypto.createHmac('sha256','WebAppData').update(TOKEN).digest();data.set('hash',crypto.createHmac('sha256',key).update(check).digest('hex'));return data.toString();}
const now=Math.floor(Date.now()/1000);
test('Telegram initData valid signature',()=>{const p=sign({auth_date:String(now),user:JSON.stringify({id:123456,first_name:'Tester'})});assert.equal(verifyInitData(p,TOKEN,now).user.id,123456)});
test('Telegram initData rejects tampering',()=>{const p=sign({auth_date:String(now),user:JSON.stringify({id:123456})}).replace('123456','123457');assert.throws(()=>verifyInitData(p,TOKEN,now))});
test('Telegram initData rejects expired',()=>{const p=sign({auth_date:String(now-90000),user:JSON.stringify({id:123456})});assert.throws(()=>verifyInitData(p,TOKEN,now))});
test('Telegram initData rejects duplicate fields',()=>{const p=sign({auth_date:String(now),user:JSON.stringify({id:123456})})+'&user=%7B%7D';assert.throws(()=>verifyInitData(p,TOKEN,now))});
test('safe IDs and event path parser',()=>{assert.equal(safeId('../@A?123','20'),'A123');const p=parseEventPath('events/2026-11-11/123-uuid__12345__handle_open__nietzsche__direct__ru.json');assert.deepEqual(p,{day:'2026-11-11',id:'12345',type:'handle_open',slug:'nietzsche',source:'direct',lang:'ru'});assert.ok(EVENT_TYPES.has('ad_impression'));});