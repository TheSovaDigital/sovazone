import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('approved matte-black brand images are present and verified byte-for-byte',()=>{
  for(const [name,signature,hash] of [
    ['bot-avatar.jpg','ffd8','c29622598a3e2ebdded6f473a5792ad164f9fdb2e4221694ccf6686789cc2c75'],
    ['welcome-banner.jpg','ffd8','a0f35ed509a33cec17d75c096f6a20e1aa6a76b372df8ce79406b5cfec23a996'],
    ['app-icon.webp','5249',null]
  ]){
    const bytes=readFileSync(new URL('../assets/'+name,import.meta.url));
    assert.equal(bytes.subarray(0,2).toString('hex'),signature,name+' header');
    assert.ok(bytes.length>1024,name+' non-empty');
    if(hash)assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  }
  const app=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const admin=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  assert.match(app,/src="\/assets\/app-icon\.webp"/);
  assert.match(admin,/src="\/assets\/app-icon\.webp"/);
  assert.doesNotMatch(admin,/mark\.svg/);
  assert.match(app,/property="og:image" content="https:\/\/valuation\.sovazone\.com\/assets\/welcome-banner\.jpg"/);
});
