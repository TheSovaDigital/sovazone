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

test('favicon family is installed on both public Mini App and admin pages',()=>{
  const app=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const admin=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  for(const html of [app,admin]){
    assert.match(html,/rel="icon" href="\/favicon\.ico" sizes="any"/);
    assert.match(html,/sizes="32x32" href="\/favicon-32x32\.png"/);
    assert.match(html,/sizes="16x16" href="\/favicon-16x16\.png"/);
    assert.match(html,/rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/);
    assert.match(html,/rel="manifest" href="\/site\.webmanifest"/);
    assert.match(html,/rel="mask-icon" href="\/safari-pinned-tab\.svg" color="#c9a27a"/);
    assert.doesNotMatch(html,/rel="icon" type="image\/webp"/);
  }
  const manifest=JSON.parse(readFileSync(new URL('../site.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.short_name,'Valuation AI');
  assert.equal(manifest.display,'browser','Telegram-only valuation access must not be presented as a standalone app');
  assert.deepEqual(manifest.icons.map(x=>x.sizes),['192x192','512x512']);
  const svg=readFileSync(new URL('../safari-pinned-tab.svg',import.meta.url),'utf8');
  assert.match(svg,/<svg[^>]+viewBox="0 0 1024 1024"/);
  assert.match(svg,/<g fill="#000000">/);
  assert.ok((svg.match(/<path d="/g)||[]).length>=5,'real vector silhouette, not embedded raster');
  assert.doesNotMatch(svg,/<image\b|data:image\/|foreignObject/);
  const ico=readFileSync(new URL('../favicon.ico',import.meta.url));
  assert.equal(ico.subarray(0,4).toString('hex'),'00000100');
  for(const [name,size] of [
    ['favicon-16x16.png',16],['favicon-32x32.png',32],
    ['favicon-48x48.png',48],['apple-touch-icon.png',180],
    ['android-chrome-192x192.png',192],
    ['android-chrome-512x512.png',512],['mstile-150x150.png',150]
  ]){
    const png=readFileSync(new URL('../'+name,import.meta.url));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name);
    assert.equal(png.readUInt32BE(16),size,name+' width');
    assert.equal(png.readUInt32BE(20),size,name+' height');
  }
  const windows=readFileSync(new URL('../browserconfig.xml',import.meta.url),'utf8');
  assert.match(windows,/<square150x150logo src="\/mstile-150x150\.png"\/>/);
});
