#!/usr/bin/env python3
"""Non-destructive static site SEO and text-quality audit."""
from pathlib import Path
from bs4 import BeautifulSoup
from collections import defaultdict, Counter
from urllib.parse import urlparse, unquote
import re, json, xml.etree.ElementTree as ET

ROOT=Path(".")
files=sorted(x for x in ROOT.rglob("*.html") if not any(z in x.parts for z in (".git","node_modules")))
public=[p for p in files if p.name not in ("header.html","footer.html","404.html") and p.parts[0] not in ("admin",) and not p.name.startswith(("google","pinterest"))]
fileset={p.as_posix() for p in files}
assets={p.as_posix() for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts}
sitemapPaths=["sitemap-pages.xml","sitemap-articles.xml","sitemap-blog.xml","sitemap-usernames.xml","en/sitemap.xml"]
indexable=[];issues=defaultdict(list);titles=defaultdict(list);descs=defaultdict(list);hreflangs={};counts=Counter()
def name(p):return p.as_posix()
def pageurl(p):
 x=name(p)
 return "https://sovazone.com/"+("" if x=="index.html" else "en/" if x=="en/index.html" else x[:-5])
def attrs(node,key):return node.get(key,"").strip() if node else ""
def localpath(url):
 if not url or url.startswith(("#","mailto:","tel:","javascript:","data:","blob:")):return None
 u=urlparse(url)
 if u.hostname and u.hostname not in ("sovazone.com","www.sovazone.com"):return None
 path=unquote(u.path)
 if not path:return None
 return path
def resolves(path):
 x=path.lstrip("/")
 if not x:return "index.html" in assets
 return x in assets or (x+".html") in assets or (x.rstrip("/")+"/index.html") in assets
for p in public:
 raw=p.read_text(encoding="utf-8",errors="replace")
 doc=BeautifulSoup(raw,"html.parser")
 head=doc.head or doc
 title=doc.title.get_text(" ",strip=True) if doc.title else ""
 desc=head.find("meta",attrs={"name":"description"})
 canonical=head.find("link",rel="canonical")
 robots=head.find("meta",attrs={"name":"robots"})
 og=head.find("meta",attrs={"property":"og:image"})
 twitter=head.find("meta",attrs={"name":"twitter:image"})
 lang=doc.html.get("lang","") if doc.html else ""
 h1=doc.find_all("h1")
 url=pageurl(p)
 noindex="noindex" in attrs(robots,"content").lower()
 if not noindex:indexable.append(name(p))
 counts["html_public"]+=1
 if noindex:counts["noindex_pages"]+=1
 if not title:issues["missing_title"].append(name(p))
 elif len(title)>75:issues["long_title"].append(name(p)+" "+str(len(title)))
 else:titles[title].append(name(p))
 if not desc or not attrs(desc,"content"):issues["missing_description"].append(name(p))
 else:
  dv=desc.get("content","")
  if len(dv)>165:issues["long_description"].append(name(p)+" "+str(len(dv)))
  descs[dv].append(name(p))
 if not canonical:issues["missing_canonical"].append(name(p))
 elif canonical.get("href","").rstrip("/")!=url.rstrip("/"):issues["canonical_mismatch"].append(name(p)+" => "+canonical.get("href",""))
 if len(h1)!=1:issues["h1_count"].append(name(p)+":"+str(len(h1)))
 if not og:issues["missing_og_image"].append(name(p))
 if not twitter:issues["missing_twitter_image"].append(name(p))
 if lang not in ("en","ru"):issues["html_lang_invalid"].append(name(p)+":"+lang)
 if (name(p).startswith("en/") and lang!="en") or (not name(p).startswith("en/") and lang!="ru"):issues["html_lang_wrong"].append(name(p)+":"+lang)
 alts={attrs(x,"hreflang"):attrs(x,"href") for x in head.find_all("link",attrs={"hreflang":True})}
 hreflangs[name(p)]=alts
 if not alts:issues["missing_hreflang"].append(name(p))
 for x in ("og", "tw"):
  n=og if x=="og" else twitter
  if n and n.get("content",""):
   local=localpath(n.get("content",""))
   if local and not resolves(local):issues["missing_social_image"].append(name(p)+" "+local)
 for a in doc.find_all("a",href=True):
  target=localpath(a.get("href",""))
  if target and not resolves(target):
   issues["broken_local_href"].append(name(p)+" -> "+target)
 for im in doc.find_all("img"):
  source=localpath(im.get("src",""))
  if source and not resolves(source):issues["missing_img_src"].append(name(p)+" -> "+source)
  if "alt" not in im.attrs:issues["missing_img_alt"].append(name(p))
 for script in doc.find_all("script",type="application/ld+json"):
  try:json.loads(script.string or script.get_text())
  except Exception as err:issues["jsonld_syntax"].append(name(p)+" "+str(err)[:70])
 for node in doc(["script","style","template","noscript","svg"]):node.decompose()
 rendered=doc.get_text(" ",strip=True)
 for pat,label in [(r"&#x20;|&amp;#x20;|&nbsp;|\\uFFFD","raw_entities"),(r"\\b(?:Lorem ipsum|TODO_PLACEHOLDER|undefined|\[object Object\])\\b","placeholder_text"),(r"([А-Яа-яЁё]{4,})([А-ЯЁ][а-яё]{2,})","joined_russian_words"),(r"([A-Za-z]{4,})([А-ЯЁ][а-яё]{2,})","joined_lang_words")]:
  for m in list(re.finditer(pat,rendered,flags=re.I if "placeholder" in label else 0))[:4]:
   issues[label].append(name(p)+" :: "+rendered[max(m.start()-35,0):m.end()+45])
 for x in ["\ufffd","&#x20;","&amp;#x20;"]:
  if x in raw:issues["source_encoding_artifact"].append(name(p)+" "+x)
 for link in head.find_all("link",attrs={"hreflang":True}):
  h=link.get("href","")
  target=localpath(h)
  if target and not resolves(target):issues["hreflang_missing_target"].append(name(p)+" => "+h)
for title,src in titles.items():
 if len(src)>1:issues["duplicate_title"].append(title[:80]+" :: "+",".join(src))
for desc,src in descs.items():
 if len(src)>1:issues["duplicate_description"].append(desc[:70]+" :: "+",".join(src))
sitemapUrls={}
for path in sitemapPaths:
 try:
  root=ET.parse(path).getroot()
  locs=[x.text.strip() for x in root.iter() if x.tag.endswith("}loc") or x.tag=="loc"]
  # image:loc also present: only URL entries at direct <url> child.
  ns={"s":"http://www.sitemaps.org/schemas/sitemap/0.9"}
  locs=[x.text.strip() for x in root.findall("./s:url/s:loc",ns) if x.text]
  sitemapUrls[path]=locs
  for url in locs:
   path2=localpath(url)
   if path2 and not resolves(path2):issues["sitemap_nonexistent"].append(path+" => "+url)
  if len(locs)!=len(set(locs)):issues["sitemap_duplicates"].append(path)
 except Exception as err:issues["sitemap_xml_error"].append(path+" "+str(err))
sitemapped=set(sum(sitemapUrls.values(),[]))
for p in indexable:
 u=pageurl(Path(p))
 if u not in sitemapped:issues["indexable_absent_sitemap"].append(p)
for page in public:
 p=name(page)
 if p.startswith("en/"):other=p[3:]
 else:other="en/"+p
 if other not in fileset:continue
 a,b=hreflangs.get(p,{}),hreflangs.get(other,{})
 u1,u2=pageurl(page),pageurl(Path(other))
 if a.get("en")!= (u2 if not p.startswith("en/") else u1) or a.get("ru")!= (u1 if not p.startswith("en/") else u2):
  issues["incomplete_hreflang_pairs"].append(p)
 if b.get("en")!= (u2 if not p.startswith("en/") else u1) or b.get("ru")!= (u1 if not p.startswith("en/") else u2):
  issues["incomplete_hreflang_pairs"].append(other)
print("AUDIT_TOTALS",json.dumps({"public_html":len(public),"indexable_html":len(indexable),"sitemap_urls":{p:len(x) for p,x in sitemapUrls.items()},"unique_sitemap_urls":len(sitemapped),"issues":{k:len(v) for k,v in sorted(issues.items())}},ensure_ascii=False))
for label,ls in sorted(issues.items(),key=lambda z:-len(z[1])):
 print("AUDIT",label,len(ls),json.dumps(list(dict.fromkeys(ls))[:17],ensure_ascii=False))
