import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd(),base='https://sovazone.com';
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const indexes={
  ru: JSON.parse(read('content/blog/index.json')),
  en: JSON.parse(read('en/content/blog/index.json'))
};
const slugSets=Object.fromEntries(Object.entries(indexes).map(([k,v])=>[k,new Set(v.map(p=>p.slug))]));
let checked=0,paired=0;
for (const [lang,posts] of Object.entries(indexes)) {
  for (const p of posts) {
    assert.match(p.slug,/^[A-Za-z0-9_-]+$/);
    const prefix=lang==='ru'?'':'en/';
    const pagePath=prefix+'post/'+p.slug+'.html';
    const html=read(pagePath);
    const url=base+'/'+prefix+'post/'+p.slug;
    const head=html.slice(0,html.indexOf('</head>'));
    assert.ok(head.includes('<link rel="canonical" href="'+url+'">'),pagePath+' canonical');
    assert.ok(head.includes('<meta property="og:url" content="'+url+'">'),pagePath+' OG url');
    assert.ok(head.includes('<meta name="description" content="'),pagePath+' description');
    assert.ok(head.includes('hreflang="'+lang+'" href="'+url+'"'),pagePath+' language self-reference');
    assert.ok(head.includes('<meta property="og:image" content="'+base+p.cover+'">'),pagePath+' cover');
    const expectedImageType=/\.jpe?g$/i.test(p.cover)?'image/jpeg':/\.webp$/i.test(p.cover)?'image/webp':'image/png';
    assert.ok(head.includes('<meta property="og:image:type" content="'+expectedImageType+'">'),pagePath+' image MIME type');
    const title=head.match(/<title>([^<]+)<\/title>/i)?.[1]||'';
    assert.ok(title.includes('SovaZone')&&title.length<=75,pagePath+' title length '+title.length);
    const match=head.match(/<script[^>]+id="schema-article"[^>]*>([\s\S]*?)<\/script>/i);
    assert.ok(match,pagePath+' JSON-LD');
    const article=JSON.parse(match[1]);
    assert.equal(article['@type'],'BlogPosting',pagePath+' schema type');
    assert.equal(article.mainEntityOfPage,url,pagePath+' schema canonical');
    assert.equal(article.headline,p.title,pagePath+' headline');
    assert.equal(article.datePublished,p.date,pagePath+' published date');
    assert.ok((html.match(/id="post-content"[\s\S]+?<p>/i)||[])[0],pagePath+' prerendered body');
    assert.ok(html.includes('window.location.pathname.split("/")'),pagePath+' client slug fallback');
    const other=lang==='ru'?'en':'ru';
    if(slugSets[other].has(p.slug)){
      const partner=base+'/'+(other==='ru'?'':'en/')+'post/'+p.slug;
      assert.ok(head.includes('hreflang="'+other+'" href="'+partner+'"'),pagePath+' reciprocal hreflang');
      paired++;
    }
    const sitemap=lang==='ru'?read('sitemap-blog.xml'):read('en/sitemap.xml');
    assert.ok(sitemap.includes('<loc>'+url+'</loc>'),pagePath+' sitemap URL');
    checked++;
  }
}
for(const file of ['sitemap-blog.xml','en/sitemap.xml']){
 assert.ok(!read(file).includes('post?slug='),'Old query-based sitemap entry in '+file);
}
const routes=JSON.parse(read('vercel.json')).redirects;
for(const loc of ['/post','/en/post']){
 assert.ok(routes.some(r=>r.source===loc&&r.has?.some(h=>h.type==='query'&&h.key==='slug')&&r.permanent===true),'Legacy redirect for '+loc);
}
for(const file of ['blog.html','en/blog.html']){
 assert.ok(!read(file).includes('return "/'+(file.startsWith('en/')?'en/':'')+'post?slug="'),'Blog listing old URL in '+file);
}
console.log('STATIC_BLOG_SEO_PASS',JSON.stringify({articles:checked,reciprocalLocaleLinks:paired,redirects:2}));

// Legacy query URLs on GitHub Pages must navigate to the indexable static article.
for(const [lang,template] of [['ru','post.html'],['en','en/post.html']]) {
  const source=read(template);
  const head=source.slice(0,source.indexOf('</head>'));
  assert.ok(head.includes('content="index,follow"'),template+' allows initial JS rendering');
  assert.ok(!head.includes('content="noindex,follow"'),template+' must not block JS rendering');
  assert.ok(!head.includes('<link rel="canonical"'),template+' must not canonicalize all query posts to a generic route');
  assert.ok(source.includes('setAttribute("content", "noindex,follow")'),template+' no-slug fallback noindex');
  assert.ok(source.includes('<!-- legacy-blog-redirect -->'),template+' browser fallback');
  assert.ok(source.includes((lang==='ru'?'/post/':'/en/post/')+'" + encodeURIComponent(slug)'),template+' redirect target');
}

// New bilingual editorial sample must render real Markdown links for crawlable internal linking.
for (const prefix of ['', 'en/']) {
  const page=read(prefix+'post/instagram-username-for-business-checklist.html');
  assert.ok(page.includes('<a href="/'+prefix+'usernames">'),prefix+'catalogue links must be clickable');
  assert.ok(page.includes('<a href="/'+prefix+'tools/username-value">'),prefix+'valuation links must be clickable');
  assert.ok(page.includes('<a href="https://help.instagram.com/581066165581870">'),prefix+'Instagram terms source must be linked');
}
