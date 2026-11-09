#!/usr/bin/env python3
"""Prepare verified sitemap URLs, lastmod, reciprocal locale tags and concise descriptions."""
import re, json, subprocess
from pathlib import Path
from collections import Counter
from urllib.parse import quote
import xml.etree.ElementTree as ET
from datetime import date

ROOT=Path.cwd()
BASE="https://sovazone.com"
NS="http://www.sitemaps.org/schemas/sitemap/0.9"
IMG="http://www.google.com/schemas/sitemap-image/1.1"
ET.register_namespace("",NS)
ET.register_namespace("image",IMG)
TODAY=date.today().isoformat()
modified=set()
def gitdate(path):
 try:
  v=subprocess.run(["git","log","-1","--format=%cs","--",str(path)],capture_output=True,text=True,timeout=6).stdout.strip()
  if re.match(r"^20\d\d-\d\d-\d\d$",v):return v
 except Exception:pass
 return None
def lastmod(path):
 return TODAY if str(path) in modified else (gitdate(path) or None)
def setfile(path,content):
 p=ROOT/path
 old=p.read_text(encoding="utf-8") if p.exists() else ""
 if old!=content:
  p.write_text(content,encoding="utf-8")
  modified.add(path.as_posix())
def canon(path):
 p=path.as_posix()
 return BASE+("/" if p=="index.html" else "/en/" if p=="en/index.html" else "/"+p[:-5])
def is_public(path):
 s=path.as_posix()
 if path.name in ("header.html","footer.html","404.html","post.html"):return False
 if "admin" in path.parts or path.name.startswith(("google","pinterest","yandex_","zen_")):return False
 raw=path.read_text(encoding="utf-8",errors="replace")
 if re.search(r'<meta\s+name=["\x27]robots["\x27][^>]*noindex',raw,re.I):return False
 return True
def locale_pair(path):
 if path.as_posix().startswith("en/"):return Path(path.as_posix()[3:])
 return Path("en")/path
def xmlurl(url,mod=None,img=None):
 el=ET.Element(f"{{{NS}}}url")
 ET.SubElement(el,f"{{{NS}}}loc").text=url
 if mod:ET.SubElement(el,f"{{{NS}}}lastmod").text=mod
 if img:
  image=ET.SubElement(el,f"{{{IMG}}}image")
  ET.SubElement(image,f"{{{IMG}}}loc").text=img
 return el
def save_urlset(name,entries):
 root=ET.Element(f"{{{NS}}}urlset")
 for e in entries:root.append(xmlurl(*e))
 ET.indent(root,space="  ")
 setfile(Path(name),'<?xml version="1.0" encoding="utf-8"?>\n'+ET.tostring(root,encoding="unicode")+'\n')
 return len(entries)
descs={
 "index.html":"Купить короткий, редкий или красивый никнейм Instagram из каталога SovaZone. Подбор никнеймов под заказ, консультации и помощь с аккаунтами.",
 "articles/how-to-choose-instagram-username.html":"Как выбрать никнейм Instagram: читаемость, длина, смысл, ошибки при выборе и способы найти подходящий username.",
 "articles/instagram-account-security.html":"Как защитить аккаунт Instagram: почта, пароль, двухфакторная аутентификация, резервные коды и защита от фишинга.",
 "articles/instagram-verification-request.html":"Как подать заявку на верификацию Instagram: где найти форму, какие данные подготовить и как заполнить запрос.",
 "articles/unblock-instagram-account.html":"Как обратиться за разблокировкой Instagram: порядок действий, подготовка документов и обращение в поддержку.",
 "articles/why-instagram-accounts-get-banned.html":"Почему блокируют Instagram: подозрительная активность, автоматизация, жалобы и способы снизить риск блокировки.",
 "articles/why-tiktok-accounts-get-banned.html":"Причины блокировок TikTok: жалобы, подозрительная активность, автоматизация и способы защитить аккаунт.",
 "en/articles/how-to-choose-instagram-username.html":"How to choose an Instagram username: length, readability, meaning, mistakes to avoid, and what to do if your preferred handle is taken.",
 "en/articles/instagram-account-security.html":"Protect your Instagram and social accounts with secure email, strong passwords, 2FA, backup codes, and phishing awareness.",
 "en/articles/meta-subscription-eligibility.html":"How Meta's subscription eligibility works, what to check in your account, and why an option may not appear.",
 "services/consultation.html":"Консультации SovaZone по никнеймам, доступу к аккаунтам и сложным ситуациям в соцсетях. Помощь в выборе решения.",
 "services/recovery-after-hack.html":"Помощь после взлома Instagram, Facebook, TikTok и других соцсетей: восстановление доступа и усиление защиты аккаунта.",
 "tools/username-value.html":"Оценка стоимости никнейма Instagram, TikTok или Telegram с SovaZone Valuation AI: длина, редкость, смысл, спрос и паттерны."
}
pages=sorted(p.relative_to(ROOT) for p in ROOT.rglob("*.html") if is_public(p))
pageSet=set(pages)
stats=Counter()
# Only add reciprocal language tags when both localized STATIC pages exist.
# Blog /post?slug routes use runtime-dependent translation availability; never invent alternates for them.
for p in pages:
 raw=(ROOT/p).read_text(encoding="utf-8")
 other=locale_pair(p)
 if other in pageSet:
  otherName=other.as_posix()
  if not re.search(r'<link\b[^>]*hreflang=',raw,re.I):
   match=re.search(r'<link\b[^>]*rel=["\x27]canonical["\x27][^>]*>',raw,re.I)
   if match:
    ru=p if not p.as_posix().startswith("en/") else other
    # Derive deterministic RU/EN pair independent of iteration order.
    root=p if not p.as_posix().startswith("en/") else other
    enfile=other if not p.as_posix().startswith("en/") else p
    tags='\n'.join([
     f'<link rel="alternate" hreflang="ru" href="{canon(root)}">',
     f'<link rel="alternate" hreflang="en" href="{canon(enfile)}">',
     f'<link rel="alternate" hreflang="x-default" href="{canon(root)}">'
    ])
    raw=raw[:match.end()]+ '\n'+tags +raw[match.end():]
    stats["hreflang_added"]+=1
 if p.as_posix() in descs:
  desc=descs[p.as_posix()]
  assert len(desc)<=165,(p,len(desc))
  orig=raw
  raw,count=re.subn(r'(<meta\s+name="description"\s+content=")[^"]*(")',lambda m:m.group(1)+desc+m.group(2),raw,count=1)
  if count!=1:raise RuntimeError(f"Missing meta description in {p}")
  if orig!=raw:stats["description_updated"]+=1
 if p.as_posix()=="faq.html":
  raw=raw.replace("<title>FAQ | SovaZone</title>","<title>Частые вопросы о никнеймах и услугах | SovaZone</title>",1)
  stats["faq_title_fixed"]+=1
 if p.as_posix()=="en/index.html":
  raw=raw.replace("<title>SovaZone — Instagram usernames, custom username sourcing, and account support</title>","<title>SovaZone — Instagram Usernames &amp; Digital Account Services</title>",1)
  stats["en_home_title_fixed"]+=1
 setfile(p,raw)
# Template blog posts must not point all unique ?slug URLs at the same generic alternate.
enpost=Path("en/post.html")
src=enpost.read_text(encoding="utf-8")
src,n=re.subn(r'\s*<link\b[^>]*hreflang="(?:ru|en|x-default)"[^>]*>',"",src)
if n not in (0,3):raise RuntimeError("Unexpected EN post template hreflang tags: "+str(n))
setfile(enpost,src)
stats["dynamic_template_wrong_alternates_removed"]=n

generalRU=[];blogRU=[];articleRU=[];userRU=[];english=[]
for p in pages:
 url=canon(p)
 mod=lastmod(p)
 s=p.as_posix()
 if s.startswith("en/"):
  img=None
  if s.startswith("en/username/"):
   slug=p.stem
   f=Path(f"image/usernames/SovaZone-username-{slug}.webp")
   if f.exists():img=BASE+"/"+f.as_posix()
  english.append((url,mod,img))
 elif s.startswith("username/"):
  slug=p.stem
  f=Path(f"image/usernames/SovaZone-username-{slug}.webp")
  userRU.append((url,mod,BASE+"/"+f.as_posix() if f.exists() else None))
 elif s.startswith("articles/") or s=="articles.html":
  articleRU.append((url,mod,None))
 elif s=="blog.html":blogRU.append((url,mod,None))
 else:generalRU.append((url,mod,None))

# A blog post is a ?slug= route; static post template is excluded from the sitemap.
for lang,indexPath,output in [
 ("ru",Path("content/blog/index.json"),blogRU),
 ("en",Path("en/content/blog/index.json"),english)
]:
 posts=json.loads(indexPath.read_text(encoding="utf-8"))
 seen=set()
 for post in posts:
  slug=str(post.get("slug","")).strip()
  if not re.fullmatch(r"[A-Za-z0-9_-]+",slug) or slug in seen:continue
  seen.add(slug)
  source=Path("content/blog" if lang=="ru" else "en/content/blog")/(slug+".md")
  if not source.exists():raise RuntimeError(f"Blog index slug missing source {source}")
  published=str(post.get("date",""))
  md=lastmod(source) or (published if re.fullmatch(r"20\d\d-\d\d-\d\d",published) else None)
  url=BASE+("/post?slug=" if lang=="ru" else "/en/post?slug=")+quote(slug,safe="")
  output.append((url,md,None))
  stats[f"blog_posts_{lang}"]+=1

def sortentries(xs):
 return sorted(xs,key=lambda e:e[0])
counts={}
for filename,urls in [
 ("sitemap-pages.xml",generalRU),
 ("sitemap-articles.xml",articleRU),
 ("sitemap-blog.xml",blogRU),
 ("sitemap-usernames.xml",userRU),
 ("en/sitemap.xml",english)
]:
 sort=sortentries(urls)
 assert len(sort)==len(set(e[0] for e in sort)),filename
 counts[filename]=save_urlset(filename,sort)
root=ET.Element(f"{{{NS}}}sitemapindex")
for name in ("sitemap-pages.xml","sitemap-blog.xml","sitemap-articles.xml","sitemap-usernames.xml","en/sitemap.xml"):
 item=ET.SubElement(root,f"{{{NS}}}sitemap")
 ET.SubElement(item,f"{{{NS}}}loc").text=BASE+"/"+name
ET.indent(root,space="  ")
setfile(Path("sitemap.xml"),'<?xml version="1.0" encoding="utf-8"?>\n'+ET.tostring(root,encoding="unicode")+'\n')
stats["sitemap_urls_total"]=sum(counts.values())
stats["files_modified"]=len(modified)
print("SEO_PREP_SUMMARY",json.dumps({"counts":counts,"stats":dict(stats),"sample_updated":sorted(modified)[:45]},ensure_ascii=False))
