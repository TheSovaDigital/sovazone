from pathlib import Path

pages = [
    'tools/instagram-username-value.html',
    'tools/tiktok-username-value.html',
    'tools/telegram-username-value.html',
    'en/tools/instagram-username-value.html',
    'en/tools/tiktok-username-value.html',
    'en/tools/telegram-username-value.html',
]

for path in pages:
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if 'SOVAZONE VALUATION AI' not in s:
        old = 'SOVAZONE VALUATION<span></span>'
        if old not in s:
            raise SystemExit(f'branding anchor not found in {path}')
        s = s.replace(old, 'SOVAZONE VALUATION AI<span></span>', 1)
    s = s.replace('/tools/username-value.css?v=4', '/tools/username-value.css?v=5')
    s = s.replace('/tools/username-value.css"', '/tools/username-value.css?v=5"')
    p.write_text(s, encoding='utf-8')

print('Valuation AI branding aligned across platform pages')
