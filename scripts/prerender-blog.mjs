#!/usr/bin/env node
// Rebuild static blog pages from RU/EN Markdown and JSON indexes: node scripts/prerender-blog.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const site='https://sovazone.com', read=p=>fs.readFileSync(p,'utf8');
const data={ru:JSON.parse(read('content/blog/index.json')),en:JSON.parse(read('en/content/blog/index.json'))};
const ids={ru:new Set(data.ru.map(p=>p.slug)),en:new Set(data.en.map(p=>p.slug))};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(lang,slug)=>site+'/'+(lang==='en'?'en/':'')+'post/'+encodeURIComponent(slug);
const short=t=>{
  const tail=' | SovaZone';if((t+tail).length<=75)return t+tail;
  const front=t.split(/[:—–]/)[0].trim();if(front&&front.length+tail.length<=75)return front+tail;
  return (t.slice(0,75-tail.length).replace(/\s+\S*$/,'')||t.slice(0,75-tail.length)).replace(/[\s,;:–—-]+$/,'')+tail;
};
function markdown(md){
  const lines=md.replace(/^---\s*\n[\s\S]*?\n---\s*\n/,'').split(/\r?\n/),out=[];
  let text=[],list=null;
  const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  const flush=()=>{if(text.length){out.push('<p>'+inline(text.join(' '))+'</p>');text=[];}};
  const close=()=>{if(list){out.push('</'+list+'>');list=null;}};
  for(const raw of lines){
    const s=raw.trim();
    if(!s){flush();close();continue;}
    const head=s.match(/^(#{1,6})\s+(.+)$/);
    if(head){flush();close();if(head[1].length===1&&out.length===0)continue;const n=Math.max(2,Math.min(4,head[1].length));out.push('<h'+n+'>'+inline(head[2])+'</h'+n+'>');continue;}
    const li=s.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
    if(li){flush();const k=/^\d+\./.test(s)?'ol':'ul';if(list!==k){close();list=k;out.push('<'+k+'>');}out.push('<li>'+inline(li[1])+'</li>');continue;}
    if(/^[-*_]{3,}$/.test(s)){flush();close();out.push('<hr>');continue;}
    close();text.push(s);
  }
  flush();close();return out.join('\n');
}
function meta(h,key,value){
  const re=new RegExp('(<meta\\s+(?:name|property)="'+key+'"\\s+content=")[^"]*(")','i');
  assert.match(h,re);return h.replace(re,(_m,a,b)=>a+esc(value)+b);
}
function schema(h,id,data){
  const re=new RegExp('(<script[^>]+id="'+id+'"[^>]*>)[\\s\\S]*?(<\\/script>)','i');
  assert.match(h,re);return h.replace(re,(_m,a,b)=>a+'\n'+JSON.stringify(data).replace(/</g,'\\u003c')+'\n'+b);
}
for(const lang of ['ru','en']){
  const pref=lang==='en'?'en/':'',other=lang==='en'?'ru':'en';
  for(const p of data[lang]){
    assert.match(p.slug,/^[A-Za-z0-9_-]+$/);
    let h=read(pref+'post.html'),canonical=link(lang,p.slug),cover=p.cover?.startsWith('/')?site+p.cover:site+'/og-image.png';
    h=h.replace(/<title>[\s\S]*?<\/title>/i,'<title>'+esc(short(p.title))+'</title>');
    h=meta(h,'description',p.description);
    for(const k of ['og:title','twitter:title'])h=meta(h,k,p.title+' | SovaZone');
    for(const k of ['og:description','twitter:description'])h=meta(h,k,p.description);
    h=meta(h,'og:url',canonical);
    for(const k of ['og:image','og:image:secure_url','twitter:image'])h=meta(h,k,cover);
    h=h.replace(/(<link rel="canonical" href=")[^"]*(")/,(_m,a,b)=>a+canonical+b);
    h=h.replace(/\s*<meta property="og:image:(?:width|height)"[^>]*>/gi,'');
    if(ids[other].has(p.slug)){
      const anchor='<link rel="canonical" href="'+canonical+'">';
      const alternates=['ru','en'].map(l=>'<link rel="alternate" hreflang="'+l+'" href="'+link(l,p.slug)+'">');
      alternates.push('<link rel="alternate" hreflang="x-default" href="'+link('ru',p.slug)+'">');
      h=h.replace(anchor,anchor+'\n  '+alternates.join('\n  '));
    }
    h=h.replace(/(<h1 class="post-title" id="post-title" itemprop="headline">)[\s\S]*?(<\/h1>)/,(_m,a,b)=>a+esc(p.title)+b);
    h=h.replace(/(<div id="post-content" class="post-content post-state" itemprop="articleBody">)[\s\S]*?(<\/div>)/,(_m,a,b)=>a+markdown(read(pref+'content/blog/'+p.slug+'.md'))+b);
    h=h.replace('(params.get("slug") || "")','(params.get("slug") || window.location.pathname.split("/").filter(Boolean).at(-1) || "")');
    h=h.replace('const canonical = "'+site+'/'+pref+'post?slug=" + encodeURIComponent(slug);','const canonical = "'+site+'/'+pref+'post/" + encodeURIComponent(slug);');
    const param=String.fromCharCode(36,123);
    h=h.replaceAll('/'+pref+'post?slug='+param,'/'+pref+'post/'+param);
    h=schema(h,'schema-article',{'@context':'https://schema.org','@type':'BlogPosting',headline:p.title,description:p.description,datePublished:p.date,image:[cover],mainEntityOfPage:canonical,inLanguage:lang,author:{'@type':'Organization',name:p.author||'SovaZone'},publisher:{'@type':'Organization',name:'SovaZone',url:site+'/'}});
    h=schema(h,'schema-breadcrumb',{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:lang==='ru'?'Главная':'Home',item:site+(lang==='en'?'/en/':'/')},{'@type':'ListItem',position:2,name:lang==='ru'?'Блог':'Blog',item:site+'/'+pref+'blog'},{'@type':'ListItem',position:3,name:p.title,item:canonical}]});
    const dest=pref+'post/'+p.slug+'.html';fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,h,'utf8');
  }
}
console.log('Generated',data.ru.length+data.en.length,'blog pages');
