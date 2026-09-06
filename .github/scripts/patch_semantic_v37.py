from pathlib import Path

backend=Path('api/username-value.js')
s=backend.read_text()

old="const ENGINE_VERSION = 'instagram-v3.6';"
new="const ENGINE_VERSION = 'instagram-v3.7';"
if s.count(old)!=1: raise SystemExit('unexpected backend version')
s=s.replace(old,new,1)

# Add only controls already established in SovaZone calibration/history.
word_marker="  volk:[15000,20000],\n"
word_add="""  volk:[15000,20000],
  cat:[20000,30000],
  home:[15000,30000],
  storm:[10000,20000],
  black:[30000,50000],
  sun:[15000,25000],
  blue:[2000,3000],
  green:[4000,6000],
  doctor:[4000,6000],
  lawyer:[5000,10000],
"""
if s.count(word_marker)!=1: raise SystemExit('word marker missing')
s=s.replace(word_marker,word_add,1)

name_marker="  slastenka:[2500,4500],\n"
name_add="""  slastenka:[2500,4500],
  pavel:[7000,12000],
  pasha:[4000,8000],
  pashka:[1250,2500],
  stepa:[7000,12000],
  stepan:[5000,9000],
  stepashka:[250,500],
"""
if s.count(name_marker)!=1: raise SystemExit('name marker missing')
s=s.replace(name_marker,name_add,1)

surname_marker="  baran:[300,600],\n"
surname_add="""  baran:[300,600],
  petrov:[1500,2500],
  smith:[4000,6000],
  miller:[4000,6000],
  brown:[400,700],
  johnson:[1500,2500],
  garcia:[750,1250],
"""
if s.count(surname_marker)!=1: raise SystemExit('surname marker missing')
s=s.replace(surname_marker,surname_add,1)

leet_marker="  // Leetspeak controls\n"
abbrev_add="""  // Strong universal abbreviations
  vip:[20000,30000],
  ceo:[20000,30000],
  usa:[20000,30000],

  // Leetspeak controls
"""
if s.count(leet_marker)!=1: raise SystemExit('leet marker missing')
s=s.replace(leet_marker,abbrev_add,1)

# Post-guardrail examples are needed only where the separator penalty itself is calibrated.
func_marker="function applySemanticCalibration(parsed,username){"
post_block=r'''const POST_GUARDRAIL_CALIBRATION_BANDS = Object.freeze({
  'hel_lo':[100,300,true],
  'hel.lo':[100,300,true]
});

function applyPostGuardrailCalibration(parsed,username,platform){
  const band=POST_GUARDRAIL_CALIBRATION_BANDS[String(username||'').toLowerCase()];
  if(!band)return parsed;
  const scale=platform==='tiktok'?0.25:1;
  parsed.priceMin=niceRound(band[0]*scale);
  parsed.priceMax=niceRound(band[1]*scale);
  parsed.openEnded=false;
  parsed.uncertain=Boolean(band[2]);
  return parsed;
}

'''
if s.count(func_marker)!=1: raise SystemExit('semantic function marker missing')
if 'POST_GUARDRAIL_CALIBRATION_BANDS' in s: raise SystemExit('post calibration already present')
s=s.replace(func_marker,post_block+func_marker,1)

range_marker="  parsed=applyRange(parsed);"
if s.count(range_marker)!=1: raise SystemExit('range marker missing')
s=s.replace(range_marker,"  parsed=applyPostGuardrailCalibration(parsed,username,platform);\n"+range_marker,1)

# Clarify that common short words can be either premium or ordinary; semantics must dominate length alone.
prompt_old="- English often has a broader pool, but weak English does not automatically beat an attractive local word."
prompt_new="- English often has a broader pool, but weak English does not automatically beat an attractive local word. Do not assume every short dictionary word is premium: personal desirability and real buyer identity demand can differ by more than 10x between words of the same length."
if s.count(prompt_old)!=1: raise SystemExit('prompt marker missing')
s=s.replace(prompt_old,prompt_new,1)

backend.write_text(s)

frontend=Path('tools/username-value.js')
fs=frontend.read_text()
if fs.count("var CACHE_VERSION='instagram-v3.6';")!=1: raise SystemExit('frontend cache target missing')
frontend.write_text(fs.replace("var CACHE_VERSION='instagram-v3.6';","var CACHE_VERSION='instagram-v3.7';",1))

htmls=[Path('tools/instagram-username-value.html'),Path('tools/tiktok-username-value.html'),Path('en/tools/instagram-username-value.html'),Path('en/tools/tiktok-username-value.html')]
changed=0
for p in htmls:
    if not p.exists(): continue
    x=p.read_text()
    if '/tools/username-value.js?v=11' in x:
        p.write_text(x.replace('/tools/username-value.js?v=11','/tools/username-value.js?v=12'))
        changed+=1
if changed==0: raise SystemExit('no html cache target')
print('patched v3.7; html files',changed)
