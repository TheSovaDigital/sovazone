import fs from 'node:fs';
import assert from 'node:assert/strict';
const expectedNames=['@M4D','@o0*','@KROT','@TRYD','@PODLETS','@KOKETKA','@DELUKS','@KEYED'];
const expectedPrices=['7000$','2500$','2000$','1250$','1500$','1500$','1500$','1500$'];
const expectedSlugs=['m4d','o05','krot','tryd','podlets','koketka','deluks','keyed'];
for(const language of ['ru','en']){
  const dir=language==='en'?'en/':'';
  const page=dir+'index.html';
  const html=fs.readFileSync(page,'utf8');
  assert.equal((html.match(/<article class="username-card">/g)||[]).length,8,page+' visible cards');
  assert.equal((html.match(/itemtype="https:\/\/schema.org\/Product"/g)||[]).length,0,page+' must not mark list cards as products');
  assert.equal((html.match(/itemtype="https:\/\/schema.org\/Offer"/g)||[]).length,0,page+' must not mark list cards as offers');
  assert.equal((html.match(/itemprop=/g)||[]).length,0,page+' stray microdata');
  const cards=[...html.matchAll(/<article class="username-card">([\s\S]*?)<\/article>/g)].map(m=>m[1]);
  assert.equal(cards.length,8);
  const names=cards.map(s=>s.match(/<div class="username-name">([^<]+)<\/div>/)?.[1]);
  const prices=cards.map(s=>s.match(/<div class="username-price"><span>([^<]+)<\/span><\/div>/)?.[1]);
  assert.deepEqual(names,expectedNames,page+' usernames unchanged');
  assert.deepEqual(prices,expectedPrices,page+' visible prices unchanged');
  const urls=cards.map(s=>s.match(/<a class="username-buy" href="([^"]+)"/)?.[1]);
  assert.deepEqual(urls,expectedSlugs.map(s=>'username/'+s),page+' detail links unchanged');
  // The homepage blog preview must keep same-day editorial order and indexable clean URLs.
  assert.ok(html.includes('publishedOrder: Number(post.publishedOrder || 0)'),page+' blog order property');
  assert.ok(html.includes('return dateB - dateA || (a.publishedOrder || 0) - (b.publishedOrder || 0);'),page+' same-day order');
  assert.ok(html.includes("return '/"+dir+"post/' + encodeURIComponent(slug || '');"),page+' clean blog post link');
  assert.ok(!html.includes("return '/"+dir+"post?slug='"),page+' must not use query-based legacy links');
  const script=html.match(/<script type="application\/ld\+json" id="featured-usernames-itemlist">([\s\S]*?)<\/script>/);
  assert.ok(script,page+' ItemList');
  const list=JSON.parse(script[1]);
  assert.equal(list['@type'],'ItemList');
  assert.deepEqual(list.itemListElement.map(x=>x.position),[1,2,3,4,5,6,7,8]);
  assert.deepEqual(list.itemListElement.map(x=>x.url),expectedSlugs.map(s=>'https://sovazone.com/'+dir+'username/'+s));
  for(const slug of expectedSlugs){
    const detail=dir+'username/'+slug+'.html';
    assert.ok(fs.existsSync(detail),page+' has corresponding detail page '+detail);
  }
}

// Check real chronological ordering, not only the presence of a comparator.
// On 2026-11-10, the business guide was published first (order 5);
// the purchase guide was published last (order 1).
const expectedNewestFirst=["instagram-username-purchase-risks","username-effectiveness-testing","protect-brand-username-social-platforms","personal-brand-username-guide","instagram-username-for-business-checklist"];
for (const prefix of ['', 'en/']) {
  const data=JSON.parse(fs.readFileSync(prefix+'content/blog/index.json','utf8'));
  assert.deepEqual(data.slice(0,5).map(x=>x.slug),expectedNewestFirst,prefix+' newest posts first');
  assert.deepEqual(data.slice(0,5).map(x=>x.publishedOrder),[1,2,3,4,5],prefix+' same-day chronological order');
  for (const page of [prefix+'index.html',prefix+'blog.html']) {
    const html=fs.readFileSync(page,'utf8');
    assert.ok(html.includes('return dateB - dateA || (a.publishedOrder || 0) - (b.publishedOrder || 0);'),page+' chronological tie-breaker');
    assert.ok(!html.includes('return dateB - dateA || (b.publishedOrder || 0) - (a.publishedOrder || 0);'),page+' must not reverse same-day posts');
  }
}
const generator=fs.readFileSync('scripts/generate-blog-index.mjs','utf8');
assert.ok(generator.includes('return dateB - dateA || (a.publishedOrder || 0) - (b.publishedOrder || 0);'),'blog index generator preserves chronology');
const feedGenerator=fs.readFileSync('scripts/generate-feeds.mjs','utf8');
assert.ok(feedGenerator.includes('if ((a.publishedOrder || 0) !== (b.publishedOrder || 0)) return (a.publishedOrder || 0) - (b.publishedOrder || 0);'),'RSS feed generator preserves chronology');

console.log('PASS: RU/EN homepage preview markup, eight unchanged prices, ItemList links and detail pages');
