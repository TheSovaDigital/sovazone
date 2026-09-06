from pathlib import Path

p = Path('.github/scripts/refine_valuation_seo_copy.py')
s = p.read_text(encoding='utf-8')
old = "s = replace_once(s, '<h2>Why the result is a range</h2><p>Social-media usernames do not have a transparent exchange with a single market quote. SovaZone therefore shows an indicative range based on scarcity, structure, language, global popularity and calibrated comparable handles.</p>', '<h2>How to find a username value</h2><p>If you are asking how much a username is worth, there is no single transparent market quote. SovaZone Valuation AI estimates a range from scarcity, structure, language, meaning, demand and calibrated comparable usernames.</p>', path)"
new = "s = sub1(s, r'<h2>Why the result is a range</h2><p>.*?</p>', '<h2>How to find a username value</h2><p>If you are asking how much a username is worth, there is no single transparent market quote. SovaZone Valuation AI estimates a range from scarcity, structure, language, meaning, demand and calibrated comparable usernames.</p>', path)"
if old not in s:
    raise SystemExit('Expected v1 hub replacement line not found')
s = s.replace(old, new, 1)
exec(compile(s, str(p), 'exec'), {'__name__':'__main__'})
