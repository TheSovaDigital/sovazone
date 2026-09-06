from pathlib import Path

backend=Path('api/username-value.js')
s=backend.read_text()
if s.count("const ENGINE_VERSION = 'instagram-v3.7';")!=1:
    raise SystemExit('unexpected engine version')
s=s.replace("const ENGINE_VERSION = 'instagram-v3.7';","const ENGINE_VERSION = 'instagram-v3.8';",1)

marker="  // Surname / double-meaning controls\n  baranov:[800,1500],"
replacement="  // Surname / double-meaning controls\n  orel:[5000,8000],\n  orlov:[2500,5000],\n  baranov:[800,1500],"
if s.count(marker)!=1:
    raise SystemExit('surname relation marker missing')
s=s.replace(marker,replacement,1)
backend.write_text(s)

frontend=Path('tools/username-value.js')
f=frontend.read_text()
if f.count("var CACHE_VERSION='instagram-v3.7';")!=1:
    raise SystemExit('frontend cache target missing')
frontend.write_text(f.replace("var CACHE_VERSION='instagram-v3.7';","var CACHE_VERSION='instagram-v3.8';",1))

changed=0
for p in [Path('tools/instagram-username-value.html'),Path('tools/tiktok-username-value.html'),Path('en/tools/instagram-username-value.html'),Path('en/tools/tiktok-username-value.html')]:
    if not p.exists(): continue
    x=p.read_text()
    if '/tools/username-value.js?v=12' in x:
        p.write_text(x.replace('/tools/username-value.js?v=12','/tools/username-value.js?v=13'))
        changed+=1
if changed==0:
    raise SystemExit('html cache target missing')
print('v3.8 final relation patch; html files',changed)
