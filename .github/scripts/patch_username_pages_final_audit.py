from pathlib import Path
import re

ROOT = Path('.')

platform_pages = {
    'tools/instagram-username-value.html': ('instagram', 'https://sovazone.com/tools/instagram-username-value', 30),
    'tools/tiktok-username-value.html': ('tiktok', 'https://sovazone.com/tools/tiktok-username-value', 30),
    'tools/telegram-username-value.html': ('telegram', 'https://sovazone.com/tools/telegram-username-value', 32),
    'en/tools/instagram-username-value.html': ('instagram', 'https://sovazone.com/tools/instagram-username-value', 30),
    'en/tools/tiktok-username-value.html': ('tiktok', 'https://sovazone.com/tools/tiktok-username-value', 30),
    'en/tools/telegram-username-value.html': ('telegram', 'https://sovazone.com/tools/telegram-username-value', 32),
}

all_pages = list(platform_pages) + ['tools/username-value.html', 'en/tools/username-value.html']


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def add_xdefault(text, url):
    if 'hreflang="x-default"' in text:
        return text
    matches = list(re.finditer(r'<link rel="alternate" hreflang="(?:ru|en)" href="[^"]+">', text))
    if not matches:
        raise SystemExit('alternate hreflang block not found')
    pos = matches[-1].end()
    return text[:pos] + f'\n  <link rel="alternate" hreflang="x-default" href="{url}">' + text[pos:]


# Shared page consistency, cache busting, accessibility and input limits.
for path, (platform, xdefault, maxlength) in platform_pages.items():
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    s = s.replace('/tools/username-value.css?v=3', '/tools/username-value.css?v=4')
    s = s.replace('/tools/username-value.css"', '/tools/username-value.css?v=4"')
    s = s.replace('/tools/username-value.js?v=14', '/tools/username-value.js?v=15')
    s = add_xdefault(s, xdefault)
    s = re.sub(r'(<a class="uv-tab is-active" href="[^"]+")>', r'\1 aria-current="page">', s, count=1)
    marker = '<input class="uv-input" name="username"'
    replacement = f'<input class="uv-input" name="username" maxlength="{maxlength}"'
    if marker in s and 'class="uv-input" name="username" maxlength=' not in s:
        s = s.replace(marker, replacement, 1)
    if path.startswith('en/'):
        s = s.replace('<div class="uv-kicker">SovaZone Valuation</div>', '<div class="uv-hero-kicker"><span></span>SOVAZONE VALUATION<span></span></div>')
        s = s.replace('"item":"https://sovazone.com/tools/username-value"', '"item":"https://sovazone.com/en/tools/username-value"')
    write(path, s)

# Russian copy fixes.
for path in ['tools/instagram-username-value.html', 'tools/tiktok-username-value.html']:
    s = Path(path).read_text(encoding='utf-8').replace('официального прайс-листа', 'фиксированного прайс-листа')
    write(path, s)

p = Path('tools/tiktok-username-value.html')
s = p.read_text(encoding='utf-8').replace('Двухсимвольные Instagram username относятся к наиболее редким.', 'Двухсимвольные TikTok username относятся к наиболее редким.')
write(p, s)

# Sales CTA is Instagram-only. Remove generic sell callouts from TikTok/Telegram pages.
for path in ['tools/tiktok-username-value.html', 'tools/telegram-username-value.html', 'en/tools/tiktok-username-value.html', 'en/tools/telegram-username-value.html']:
    s = Path(path).read_text(encoding='utf-8')
    s = re.sub(r'\n?<div class="uv-sell-callout"><div>.*?</div><a [^>]+>.*?</a></div>\n?', '\n', s, count=1, flags=re.S)
    write(path, s)

# Add the missing English Instagram sell CTA only on the Instagram page.
p = Path('en/tools/instagram-username-value.html')
s = p.read_text(encoding='utf-8')
if 'uv-sell-callout' not in s:
    callout = '<div class="uv-sell-callout"><div><strong>Want to sell an Instagram username?</strong><p>Submit it through SovaUsername and we will review the Instagram handle and its market potential.</p></div><a href="/en/sell">Sell an Instagram username →</a></div>\n'
    s = s.replace('<section class="uv-seo">', callout + '<section class="uv-seo">', 1)
write(p, s)

# RU landing page: add Telegram to SEO, choices and hero; make sales CTA explicitly Instagram-only.
p = Path('tools/username-value.html')
s = p.read_text(encoding='utf-8')
s = s.replace('/tools/username-value.css?v=3', '/tools/username-value.css?v=4')
s = add_xdefault(s, 'https://sovazone.com/tools/username-value')
s = s.replace('Оценка стоимости username Instagram и TikTok | SovaZone', 'Оценка username Instagram, TikTok и Telegram | SovaZone')
s = s.replace('Онлайн-оценка стоимости username. Выберите Instagram или TikTok и получите ориентировочный диапазон цены по модели SovaZone.', 'Онлайн-оценка username для Instagram, TikTok и Telegram. Выберите платформу и получите ориентировочный диапазон стоимости по модели SovaZone.')
s = s.replace('<section class="uv-hero"><h1>Оценка стоимости username</h1><p>Выберите Instagram или TikTok и получите ориентировочный диапазон стоимости по модели SovaZone.</p></section>', '<section class="uv-hero"><div class="uv-hero-kicker"><span></span>SOVAZONE VALUATION<span></span></div><h1>Оценка стоимости username</h1><p>Выберите Instagram, TikTok или Telegram и получите ориентировочный диапазон стоимости по модели SovaZone.</p></section>')
choices_ru = '<section class="uv-choices"><a class="uv-choice" href="/tools/instagram-username-value"><div class="uv-choice-top"><h2>Instagram</h2><span class="uv-choice-arrow">→</span></div><p>Оценка Instagram username по длине, редкости, словам, именам, фамилиям, географии, цифрам и международному спросу.</p><div class="uv-choice-meta">Открыть оценку Instagram</div></a><a class="uv-choice" href="/tools/tiktok-username-value"><div class="uv-choice-top"><h2>TikTok</h2><span class="uv-choice-arrow">→</span></div><p>Та же логика качества username с отдельным коэффициентом спроса и ценности внутри TikTok.</p><div class="uv-choice-meta">Открыть оценку TikTok</div></a><a class="uv-choice" href="/tools/telegram-username-value"><div class="uv-choice-top"><h2>Telegram</h2><span class="uv-choice-arrow">→</span></div><p>Отдельная модель Telegram на очищенных данных Fragment, редкости, смысле и реальном спросе. Диапазон показывается в TON и USD.</p><div class="uv-choice-meta">Открыть оценку Telegram</div></a></section>'
s = re.sub(r'<section class="uv-choices">.*?</section>', choices_ru, s, count=1, flags=re.S)
s = re.sub(r'<div class="uv-sell-callout"><div>.*?</div><a [^>]+>.*?</a></div>', '<div class="uv-sell-callout"><div><strong>Хотите продать Instagram username?</strong><p>Отправьте Instagram username на рассмотрение через площадку SovaUsername.</p></div><a href="/sell">Продать Instagram username →</a></div>', s, count=1, flags=re.S)
s = re.sub(r'<script src="/tools/username-value\.js(?:\?v=\d+)?"></script>', '', s)
write(p, s)

# EN landing page: add Telegram, versioned CSS, consistent hero and Instagram-only sell CTA.
p = Path('en/tools/username-value.html')
s = p.read_text(encoding='utf-8')
s = s.replace('/tools/username-value.css"', '/tools/username-value.css?v=4"')
s = add_xdefault(s, 'https://sovazone.com/tools/username-value')
s = s.replace('Username Value Estimator for Instagram &amp; TikTok | SovaZone', 'Username Value Estimator for Instagram, TikTok &amp; Telegram | SovaZone')
s = s.replace('Estimate a social-media username value online. Choose Instagram or TikTok and get an indicative SovaZone valuation range.', 'Estimate a username value for Instagram, TikTok or Telegram and get an indicative SovaZone valuation range.')
s = s.replace('<div class="uv-kicker">SovaZone Valuation</div>', '<div class="uv-hero-kicker"><span></span>SOVAZONE VALUATION<span></span></div>')
s = s.replace('<section class="uv-hero"><div class="uv-hero-kicker"><span></span>SOVAZONE VALUATION<span></span></div><h1>Username value estimator</h1><p>Choose a platform and get an indicative SovaZone valuation range for a username.</p></section>', '<section class="uv-hero"><div class="uv-hero-kicker"><span></span>SOVAZONE VALUATION<span></span></div><h1>Username value estimator</h1><p>Choose Instagram, TikTok or Telegram and get an indicative SovaZone valuation range for a username.</p></section>')
choices_en = '<section class="uv-choices"><a class="uv-choice" href="/en/tools/instagram-username-value"><div class="uv-choice-top"><h2>Instagram</h2><span class="uv-choice-arrow">→</span></div><p>Estimate an Instagram handle using scarcity, word/name type, language, global demand and SovaZone pricing calibration.</p><div class="uv-choice-meta">Open Instagram estimator</div></a><a class="uv-choice" href="/en/tools/tiktok-username-value"><div class="uv-choice-top"><h2>TikTok</h2><span class="uv-choice-arrow">→</span></div><p>Estimate a TikTok handle using the same quality model with a platform-specific demand coefficient.</p><div class="uv-choice-meta">Open TikTok estimator</div></a><a class="uv-choice" href="/en/tools/telegram-username-value"><div class="uv-choice-top"><h2>Telegram</h2><span class="uv-choice-arrow">→</span></div><p>Use a separate Telegram model based on cleaned Fragment evidence, scarcity, meaning and real buyer demand, with ranges in TON and USD.</p><div class="uv-choice-meta">Open Telegram estimator</div></a></section>'
s = re.sub(r'<section class="uv-choices">.*?</section>', choices_en, s, count=1, flags=re.S)
if 'uv-sell-callout' not in s:
    s = s.replace('<section class="uv-seo">', '<div class="uv-sell-callout"><div><strong>Want to sell an Instagram username?</strong><p>Submit an Instagram handle through SovaUsername for review.</p></div><a href="/en/sell">Sell an Instagram username →</a></div>\n<section class="uv-seo">', 1)
s = re.sub(r'<script src="/tools/username-value\.js(?:\?v=\d+)?"></script>', '', s)
write(p, s)

# Frontend: Telegram format validation, special-case presentation and Instagram-only sell action.
p = Path('tools/username-value.js')
s = p.read_text(encoding='utf-8')
s = s.replace("    if(data&&data.specialCase==='global_brand')return t('Особый случай','Special case');", "    if(data&&data.specialCase==='global_brand')return t('Особый случай','Special case');\n    if(data&&data.specialCase==='invalid_username')return t('Недопустимый username','Invalid username');", 1)
s = s.replace("    if(platform!=='telegram'||!data||data.specialCase==='global_brand')return '';", "    if(platform!=='telegram'||!data||(data.specialCase&&data.specialCase!=='none'))return '';", 1)
needle = "    if(!valid){showError(platform==='telegram'?t('Для Telegram используйте латинские буквы, цифры или _.','For Telegram use Latin letters, numbers, or _.'):t('Используйте латинские буквы, цифры, точку или _.','Use Latin letters, numbers, a dot, or _.'));return;}\n"
extra = needle + "    if(platform==='telegram'&&username.length<4){showError(t('Telegram collectible username должен содержать минимум 4 символа.','A Telegram collectible username must contain at least 4 characters.'));return;}\n    if(platform==='telegram'&&(username.charAt(0)==='_'||username.charAt(username.length-1)==='_')){showError(t('Username Telegram не может начинаться или заканчиваться символом _.','A Telegram username cannot start or end with _.'));return;}\n"
if needle not in s:
    raise SystemExit('frontend validation insertion point not found')
s = s.replace(needle, extra, 1)
marker = "    result.classList.add('is-visible');"
insert = "    if(platform!=='instagram'||(data.specialCase&&data.specialCase!=='none')){var sellButton=result.querySelector('.uv-btn--accent');if(sellButton)sellButton.remove();}\n    " + marker
if marker not in s:
    raise SystemExit('render action insertion point not found')
s = s.replace(marker, insert, 1)
write(p, s)

# CSS: three platform cards, three mobile tabs, visible keyboard focus and responsive cards.
p = Path('tools/username-value.css')
s = p.read_text(encoding='utf-8')
s = s.replace('.uv-choices{display:grid;grid-template-columns:1fr 1fr;', '.uv-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));', 1)
focus_anchor = '.uv-faq p{margin:9px 0 0;color:#a4a3b2;font-size:13px;line-height:1.72;max-width:1000px}\n'
focus_rules = focus_anchor + '.uv-tab:focus-visible,.uv-submit:focus-visible,.uv-btn:focus-visible,.uv-choice:focus-visible,.uv-faq summary:focus-visible{outline:2px solid var(--uv-accent);outline-offset:3px}\n'
if focus_anchor not in s:
    raise SystemExit('CSS focus anchor not found')
s = s.replace(focus_anchor, focus_rules, 1)
s = s.replace('@media(max-width:720px){', '@media(max-width:900px){.uv-choices{grid-template-columns:1fr}}\n@media(max-width:720px){', 1)
s = s.replace('.uv-tabs{width:100%;display:grid;grid-template-columns:1fr 1fr;border-radius:15px}.uv-tab{min-width:0;border-radius:11px;height:40px;padding:0 10px}', '.uv-tabs{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px;border-radius:15px}.uv-tab{min-width:0;border-radius:11px;height:40px;padding:0 6px;gap:5px;font-size:12px}.uv-dot{width:6px;height:6px;box-shadow:0 0 0 4px rgba(217,179,140,.06)}', 1)
write(p, s)

print('Final username pages audit patch prepared')
