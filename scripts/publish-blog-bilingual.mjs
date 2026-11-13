#!/usr/bin/env node
// Publish one bilingual post from existing Markdown without modifying unrelated site data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const slug=process.argv[2];
assert.match(slug||'',/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const cover='/image/blog/'+slug+'.webp';
assert.ok(fs.existsSync('image/blog/'+slug+'.webp'),'Unique WebP cover is mandatory');
function parse(source){
 const match=source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
 assert.ok(match,'Missing frontmatter');
 const meta={};
 for(const line of match[1].split(/\r?\n/)){
  const item=line.match(/^([A-Za-z_]+):\s*(.*)$/);
  if(!item)continue;
  const v=item[2].trim();
  meta[item[1]]=((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))?v.slice(1,-1):v;
 }
 return {meta,match};
}
for(const lang of ['ru','en']){
 const root=lang==='ru'?'content/blog':'en/content/blog';
 const mdpath=root+'/'+slug+'.md';
 assert.ok(fs.existsSync(mdpath),'Missing '+mdpath);
 let source=fs.readFileSync(mdpath,'utf8');
 const {meta,match}=parse(source);
 assert.equal(meta.slug,slug);
 assert.ok(meta.title&&meta.title.length>20,'Missing title');
 assert.ok(meta.description&&meta.description.length<=165,'Invalid meta description');
 assert.match(meta.date||'',/^20\d\d-\d\d-\d\d$/,'Invalid publication date');
 assert.equal(meta.author,'SovaZone');
 assert.equal(meta.category,lang==='ru'?'Статьи':'Articles');
 const body=source.slice(match[0].length);
 assert.ok((body.match(/^## /gm)||[]).length>=3,'Missing H2 sections');
 assert.ok(body.includes(']('),'Article has no links');
 const front=match[1].replace(/^cover:.*(?:\r?\n|$)/gm,'').trimEnd()+'\ncover: "'+cover+'"';
 source='---\n'+front+'\n---\n'+body;
 fs.writeFileSync(mdpath,source);
 const indexpath=root+'/index.json';
 const posts=JSON.parse(fs.readFileSync(indexpath,'utf8'));
 const previous=posts.find(p=>p.slug===slug);
 const entry={title:meta.title,slug,date:meta.date,description:meta.description,category:meta.category,author:'SovaZone',cover,publishedOrder:previous?.publishedOrder??0};
 const updated=posts.filter(p=>p.slug!==slug).concat(entry);
 updated.sort((a,b)=>b.date.localeCompare(a.date)||(a.publishedOrder||0)-(b.publishedOrder||0));
 assert.equal(updated.filter(p=>p.slug===slug).length,1);
 fs.writeFileSync(indexpath,JSON.stringify(updated,null,2)+'\n');
 console.log('BILINGUAL_INDEX_OK',lang,slug);
}
