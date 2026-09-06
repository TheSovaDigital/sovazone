from pathlib import Path

backend = Path('api/username-value.js')
s = backend.read_text()

old_version = "const ENGINE_VERSION = 'instagram-v3.5';"
new_version = "const ENGINE_VERSION = 'instagram-v3.6';"
if s.count(old_version) != 1:
    raise SystemExit('unexpected backend version target')
s = s.replace(old_version, new_version, 1)

# Strengthen the classifier guidance without changing transport or structural pricing.
repls = {
"- Owner preference examples: King > Money > Cloud > Gold > Dream > Hello > Fast > Love > Work.":
"- Preserve this demand order and do not collapse these words into one band: King > Money > Cloud > Gold > Dream > Hello > Fast > Love > Work. Hello is roughly $20k-$30k; use materially different bands above and below it.",
"- Alex > Sasha > Alexander. Den > Denis > Denchik. Pavel > Pasha > Pashka. Stepa > Stepan > Stepashka. Kolyan > Kolya > Nikolay > Kolyanchik. Nastya > Anastasia > Nastenka.":
"- Preserve these real username-demand orders even when a longer formal name is globally familiar: Alex > Sasha > Alexander. Den > Denis > Denchik. Pavel > Pasha > Pashka. Stepa > Stepan > Stepashka. Kolyan > Kolya > Nikolay > Kolyanchik. Nastya > Anastasia > Nastenka. Do not reward the formal/full form merely for being formal or internationally recognisable.",
"Population alone is not enough. Consider connected population, wealth, digital/IT affinity, visibility, tourism/prestige and actual demand. Country/city/resort status by itself gives little automatic premium.":
"Population alone is not enough. Consider connected population, wealth, digital/IT affinity, visibility, tourism/prestige and actual demand. Country/city/resort status by itself gives little automatic premium. Calibration: Paris is roughly $3k-$5k, Yerevan roughly $500-$1k; Dubai can be much stronger because the digitally affluent buyer pool is different.",
"- No fixed leetspeak discount: value depends on underlying term and how natural the substitution looks. M4D can be strong; h0me is much weaker.":
"- No fixed leetspeak discount: value depends on underlying term and how natural the substitution looks. M4D is a strong compact form and should be several times more valuable than ordinary h0me; h0me is weak/ordinary."
}
for old, new in repls.items():
    if s.count(old) != 1:
        raise SystemExit('calibration marker not found: ' + old[:40])
    s = s.replace(old, new, 1)

# Deterministic calibration bands for owner-confirmed reference families.
insert_marker = "const GLOBAL_BRANDS = new Set([\n"
pos = s.find(insert_marker)
if pos < 0:
    raise SystemExit('GLOBAL_BRANDS marker not found')
# Insert after the GLOBAL_BRANDS declaration, before CALIBRATION.
cal_marker = "\n\nconst CALIBRATION = `"
cal_pos = s.find(cal_marker, pos)
if cal_pos < 0:
    raise SystemExit('CALIBRATION marker not found')
if 'const SEMANTIC_CALIBRATION_BANDS' in s:
    raise SystemExit('semantic calibration already present')

block = r'''

// Reference bands are SovaZone calibration controls, not historical-sale lookups.
// They stabilise known semantic families while the model classifies unseen names/words.
const SEMANTIC_CALIBRATION_BANDS = Object.freeze({
  // Strong words / identity terms
  king:[50000,50000,true],
  money:[40000,60000],
  cloud:[30000,45000],
  gold:[25000,40000],
  dream:[22000,32000],
  hello:[20000,30000],
  fast:[15000,20000],
  love:[12000,18000],
  work:[10000,15000],
  wolf:[15000,25000],
  volk:[15000,20000],

  // Names: actual username demand can favour short/common forms over full formal forms.
  alex:[10000,15000],
  sasha:[6000,10000],
  alexander:[2500,4000],
  den:[3000,5000],
  denis:[1500,2500],
  denchik:[100,300],
  kolyan:[5000,8000],
  kolya:[4000,6500],
  nikolay:[2500,4500],
  kolyanchik:[300,600],
  nastya:[6000,10000],
  anastasia:[3500,6000],
  nastenka:[1500,3000],
  slastenka:[2500,4500],

  // Surname / double-meaning controls
  baranov:[800,1500],
  baran:[300,600],

  // Geography controls retained from SovaZone market calibration.
  paris:[3000,5000],
  yerevan:[500,1000],
  armenia:[1000,2000],
  berlin:[1000,2000],
  london:[4000,6000],
  tokyo:[2500,3500],
  moscow:[5000,10000],
  rome:[2000,5000],
  monaco:[2000,5000],
  georgia:[1500,2500],
  madrid:[1000,2000],
  dubai:[20000,50000],

  // Leetspeak controls
  m4d:[5000,8000],
  h0me:[500,800],

  // Russian transliteration calibration
  pricheska:[400,800]
});

function applySemanticCalibration(parsed,username){
  const band=SEMANTIC_CALIBRATION_BANDS[String(username||'').toLowerCase()];
  if(!band)return parsed;
  parsed.priceMin=band[0];
  parsed.priceMax=band[1];
  parsed.openEnded=Boolean(band[2]);
  parsed.uncertain=false;
  return parsed;
}'''
s = s[:cal_pos] + block + s[cal_pos:]

apply_marker = "  if(parsed.specialCase==='global_brand')return parsed;"
if s.count(apply_marker) != 1:
    raise SystemExit('applyPlatform insertion marker not found')
s = s.replace(apply_marker, apply_marker + "\n  parsed=applySemanticCalibration(parsed,username);", 1)
backend.write_text(s)

# Frontend cache bump only; API endpoint/transport remains unchanged.
frontend = Path('tools/username-value.js')
fs = frontend.read_text()
old_cache = "var CACHE_VERSION='instagram-v3.5';"
new_cache = "var CACHE_VERSION='instagram-v3.6';"
if fs.count(old_cache) != 1:
    raise SystemExit('unexpected frontend cache target')
frontend.write_text(fs.replace(old_cache, new_cache, 1))

htmls = [
    Path('tools/instagram-username-value.html'),
    Path('tools/tiktok-username-value.html'),
    Path('en/tools/instagram-username-value.html'),
    Path('en/tools/tiktok-username-value.html'),
]
changed = 0
for hp in htmls:
    if not hp.exists():
        continue
    hs = hp.read_text()
    if '/tools/username-value.js?v=10' in hs:
        hp.write_text(hs.replace('/tools/username-value.js?v=10', '/tools/username-value.js?v=11'))
        changed += 1
if changed == 0:
    raise SystemExit('no HTML cache-bust target found')

print(f'patched semantic v3.6, frontend cache, and {changed} HTML files')
