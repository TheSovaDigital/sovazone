import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubscriberStore } from '../api/subscriber-store.js';

function mockBlob() {
  const values = new Map();
  const args = [];
  const blob = {
    get: async(path, opts) => {
      args.push({method:'get',path,opts});
      const data = values.get(path);
      return data ? {statusCode:200,stream:new Blob([data]).stream()} : null;
    },
    put: async(path, data, opts) => {
      args.push({method:'put',path,opts});
      values.set(path,String(data));
      return {pathname:path};
    },
    del: async(path) => {args.push({method:'del',path});values.delete(path)}
  };
  return {blob,args,values};
}
test('registers minimal private contact and defaults to no marketing consent',async()=>{
 const db=mockBlob();const store=createSubscriberStore(db.blob);
 const rec=await store.register(123456,'ru','share');
 assert.equal(rec.chatId,123456);
 assert.equal(rec.newsOptIn,false);
 assert.equal(rec.marketingConsentAt,null);
 assert.equal(rec.source,'share');
 assert.equal(rec.language,'ru');
 assert.equal(db.args.find(x=>x.method==='put').opts.access,'private');
 assert.equal(db.args.find(x=>x.method==='put').opts.allowOverwrite,true);
 assert.ok(db.args[0].path.startsWith('valuation-bot/users/'));
 assert.ok(!db.args[0].path.includes('123456'));
 assert.ok(!JSON.stringify(rec).includes('username'));
});
test('keeps explicit opt-in across repeated /start, supports opt-out and erasure',async()=>{
 const db=mockBlob();const store=createSubscriberStore(db.blob);
 await store.register(7,'ru','share');
 await store.setUpdates(7,'ru',true,'button');
 assert.equal((await store.get(7)).marketingConsentSource,'button');
 assert.equal((await store.get(7)).marketingConsentVersion,'valuation-marketing-v1-2026-11');
 assert.ok((await store.get(7)).marketingConsentAt);
 assert.equal((await store.get(7)).newsOptIn,true);
 await store.register(7,'en','direct');
 assert.equal((await store.get(7)).newsOptIn,true);
 assert.equal((await store.get(7)).source,'share');
 await store.setUpdates(7,'en',false);
 assert.equal((await store.get(7)).newsOptIn,false);
 assert.equal((await store.get(7)).marketingConsentAt,null);
 await store.erase(7);
 assert.equal(await store.get(7),null);
});
test('cannot store invalid chat IDs',async()=>{
 const db=mockBlob();const store=createSubscriberStore(db.blob);
 await assert.rejects(()=>store.register(0,'ru'),/Invalid/);
 await assert.rejects(()=>store.register(Number.MAX_SAFE_INTEGER+1,'en'),/Invalid/);
});
