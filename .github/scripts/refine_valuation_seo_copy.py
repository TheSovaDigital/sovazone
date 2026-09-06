from pathlib import Path
import json, re

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def sub1(text, pattern, repl, path):
    new, n = re.subn(pattern, repl, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f'Expected one match in {path}: {pattern}')
    return new

def set_title(text, value, path):
    return sub1(text, r'<title>.*?</title>', f'<title>{value}</title>', path)

def set_meta_name(text, name, value, path):
    pat = rf'<meta name="{re.escape(name)}" content="[^"]*">'
    return sub1(text, pat, f'<meta name="{name}" content="{value}">', path)

def set_meta_prop(text, prop, value, path):
    pat = rf'<meta property="{re.escape(prop)}" content="[^"]*">'
    return sub1(text, pat, f'<meta property="{prop}" content="{value}">', path)

def replace_once(text, old, new, path):
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]}')
    return text.replace(old, new, 1)

def replace_all(text, old, new):
    return text.replace(old, new)

def schema(platform, lang, title, description):
    if platform == 'hub':
        url = 'https://sovazone.com/tools/username-value' if lang == 'ru' else 'https://sovazone.com/en/tools/username-value'
        name = 'SovaZone Valuation AI — узнать стоимость никнейма' if lang == 'ru' else 'SovaZone Valuation AI — Username Value'
        obj = {
            '@context':'https://schema.org',
            '@type':'WebApplication',
            'name':name,
            'url':url,
            'description':description,
            'applicationCategory':'UtilitiesApplication',
            'operatingSystem':'Any',
            'offers':{'@type':'Offer','price':'0','priceCurrency':'USD'},
            'provider':{'@type':'Organization','name':'SovaZone','url':'https://sovazone.com/'}
        }
        return '<script type="application/ld+json">'+json.dumps(obj, ensure_ascii=False, separators=(',',':'))+'</script>'
    ru = lang == 'ru'
    base = '' if ru else '/en'
    url = f'https://sovazone.com{base}/tools/{platform}-username-value'
    hub = f'https://sovazone.com{base}/tools/username-value'
    crumb2 = 'Стоимость никнейма' if ru else 'Username value'
    crumb3 = f'Стоимость никнейма {platform.capitalize()}' if ru else f'{platform.capitalize()} username value'
    obj = {
        '@context':'https://schema.org',
        '@graph':[
            {
                '@type':'WebApplication','name':title,'url':url,'description':description,
                'applicationCategory':'UtilitiesApplication','operatingSystem':'Any',
                'offers':{'@type':'Offer','price':'0','priceCurrency':'USD'},
                'provider':{'@type':'Organization','name':'SovaZone','url':'https://sovazone.com/'}
            },
            {
                '@type':'BreadcrumbList','itemListElement':[
                    {'@type':'ListItem','position':1,'name':'SovaZone','item':'https://sovazone.com/' if ru else 'https://sovazone.com/en/'},
                    {'@type':'ListItem','position':2,'name':crumb2,'item':hub},
                    {'@type':'ListItem','position':3,'name':crumb3,'item':url}
                ]
            }
        ]
    }
    return '<script type="application/ld+json">'+json.dumps(obj, ensure_ascii=False, separators=(',',':'))+'</script>'

# --- RU hub ---
path = 'tools/username-value.html'
s = read(path)
title = 'Узнать стоимость никнейма — Instagram, TikTok и Telegram | SovaZone'
desc = 'Узнайте ориентировочную стоимость никнейма в Instagram, TikTok или Telegram с помощью SovaZone Valuation AI. Учитываем редкость, длину, смысл, спрос, цифры и паттерны.'
s = set_title(s, title, path)
s = set_meta_name(s, 'description', desc, path)
s = set_meta_prop(s, 'og:site_name', 'SovaZone Valuation AI', path)
s = set_meta_prop(s, 'og:title', 'Узнать стоимость никнейма | SovaZone Valuation AI', path)
s = set_meta_prop(s, 'og:description', 'Выберите Instagram, TikTok или Telegram и узнайте ориентировочную стоимость никнейма по модели SovaZone.', path)
s = set_meta_name(s, 'twitter:title', 'Узнать стоимость никнейма | SovaZone Valuation AI', path)
s = set_meta_name(s, 'twitter:description', 'Выберите Instagram, TikTok или Telegram и узнайте ориентировочную стоимость никнейма по модели SovaZone.', path)
s = replace_once(s, '<h1><span class="uv-title-line">Оценка стоимости</span> <span class="uv-title-line">username AI</span></h1><p>Выберите Instagram, TikTok или Telegram и получите ориентировочную стоимость по модели SovaZone.</p>', '<h1><span class="uv-title-line">Узнать стоимость</span> <span class="uv-title-line">никнейма AI</span></h1><p>Выберите Instagram, TikTok или Telegram и узнайте ориентировочную стоимость по модели SovaZone.</p>', path)
s = replace_once(s, '<p>Оценка Instagram username по длине, редкости, словам, именам, фамилиям, географии, цифрам и международному спросу.</p><div class="uv-choice-meta">Открыть оценку Instagram</div>', '<p>Узнайте стоимость никнейма Instagram по длине, редкости, словам, именам, фамилиям, географии, цифрам и международному спросу.</p><div class="uv-choice-meta">Узнать стоимость никнейма Instagram</div>', path)
s = replace_once(s, '<p>Та же логика качества username с отдельным коэффициентом спроса и ценности внутри TikTok.</p><div class="uv-choice-meta">Открыть оценку TikTok</div>', '<p>Узнайте стоимость никнейма TikTok с отдельным коэффициентом спроса и ценности внутри платформы.</p><div class="uv-choice-meta">Узнать стоимость никнейма TikTok</div>', path)
s = replace_once(s, '<p>Отдельная модель Telegram на очищенных данных Fragment, редкости, смысле и реальном спросе. Диапазон показывается в TON и USD.</p><div class="uv-choice-meta">Открыть оценку Telegram</div>', '<p>Узнайте стоимость никнейма Telegram по очищенным данным Fragment, редкости, смыслу и реальному спросу. Диапазон показывается в TON и USD.</p><div class="uv-choice-meta">Узнать стоимость никнейма Telegram</div>', path)
s = replace_once(s, '<strong>Узнать как разместить объявление в Telegram-канале @SovaUsername.</strong>', '<strong>Узнать, как разместить объявление в Telegram-канале @SovaUsername.</strong>', path)
s = replace_once(s, '<h2>Почему оценка даётся диапазоном</h2><p>У username нет единой рыночной котировки. Мы оцениваем ориентировочный диапазон по собственной ценовой логике и сравнительным факторам. Реальная стоимость может быть ниже или выше и в конечном итоге зависит от конкретного покупателя и продавца.</p>', '<h2>Как узнать стоимость никнейма</h2><p>У никнейма нет единой рыночной котировки. SovaZone Valuation AI показывает ориентировочный диапазон по длине, редкости, смыслу, языку, спросу, цифрам и паттернам. Реальная стоимость может быть ниже или выше и зависит от конкретного покупателя и продавца.</p>', path)
if 'application/ld+json' not in s:
    s = s.replace('</head>', schema('hub','ru',title,desc)+'</head>', 1)
write(path, s)

# --- EN hub ---
path = 'en/tools/username-value.html'
s = read(path)
title = 'Username Value — Instagram, TikTok & Telegram | SovaZone'
desc = 'Find your username value for Instagram, TikTok or Telegram with SovaZone Valuation AI. Get an indicative range based on scarcity, meaning, demand and patterns.'
s = set_title(s, title, path)
s = set_meta_name(s, 'description', desc, path)
s = set_meta_prop(s, 'og:site_name', 'SovaZone Valuation AI', path)
s = set_meta_prop(s, 'og:title', 'Username Value | SovaZone Valuation AI', path)
s = set_meta_prop(s, 'og:description', 'Find your username value for Instagram, TikTok or Telegram with the SovaZone model.', path)
s = set_meta_name(s, 'twitter:title', 'Username Value | SovaZone Valuation AI', path)
s = set_meta_name(s, 'twitter:description', 'Find your username value for Instagram, TikTok or Telegram with the SovaZone model.', path)
s = replace_once(s, '<h1><span class="uv-title-line">AI username value</span> <span class="uv-title-line">estimator</span></h1><p>Choose Instagram, TikTok or Telegram and get an indicative value based on the SovaZone model.</p>', '<h1><span class="uv-title-line">Find your username</span> <span class="uv-title-line">value</span></h1><p>Choose Instagram, TikTok or Telegram and find an indicative username value with the SovaZone model.</p>', path)
s = replace_all(s, 'Instagram handle', 'Instagram username')
s = replace_all(s, 'TikTok handle', 'TikTok username')
s = replace_all(s, 'comparable handles', 'comparable usernames')
s = replace_once(s, '<h2>Why the result is a range</h2><p>Social-media usernames do not have a transparent exchange with a single market quote. SovaZone therefore shows an indicative range based on scarcity, structure, language, global popularity and calibrated comparable handles.</p>', '<h2>How to find a username value</h2><p>If you are asking how much a username is worth, there is no single transparent market quote. SovaZone Valuation AI estimates a range from scarcity, structure, language, meaning, demand and calibrated comparable usernames.</p>', path)
if 'application/ld+json' not in s:
    s = s.replace('</head>', schema('hub','en',title,desc)+'</head>', 1)
write(path, s)

ru_pages = {
    'instagram': {
        'path':'tools/instagram-username-value.html',
        'title':'Узнать стоимость никнейма Instagram онлайн | SovaZone',
        'desc':'Узнайте ориентировочную стоимость никнейма Instagram онлайн. SovaZone Valuation AI учитывает длину, редкость, слова, имена, географию, цифры и спрос.',
        'h1':'Узнать стоимость никнейма Instagram',
        'hero':'Введите @никнейм и узнайте ориентировочную стоимость по модели SovaZone.',
    },
    'tiktok': {
        'path':'tools/tiktok-username-value.html',
        'title':'Узнать стоимость никнейма TikTok онлайн | SovaZone',
        'desc':'Узнайте ориентировочную стоимость никнейма TikTok онлайн. SovaZone Valuation AI учитывает редкость, тип никнейма, смысл, паттерны и спрос на платформе.',
        'h1':'Узнать стоимость никнейма TikTok',
        'hero':'Введите @никнейм и узнайте ориентировочную стоимость по модели SovaZone с поправкой на спрос внутри TikTok.',
    },
    'telegram': {
        'path':'tools/telegram-username-value.html',
        'title':'Узнать стоимость никнейма Telegram — Fragment и TON | SovaZone',
        'desc':'Узнайте ориентировочную стоимость никнейма Telegram по очищенным данным Fragment, редкости, смыслу, паттернам и реальному спросу. Диапазон в TON и USD.',
        'h1':'Узнать стоимость никнейма Telegram',
        'hero':'Введите @никнейм и узнайте ориентировочную стоимость по модели SovaZone на основе очищенных данных Fragment.',
    }
}

for platform, cfg in ru_pages.items():
    path = cfg['path']; s = read(path)
    s = set_title(s, cfg['title'], path)
    s = set_meta_name(s, 'description', cfg['desc'], path)
    s = set_meta_prop(s, 'og:site_name', 'SovaZone Valuation AI', path)
    s = set_meta_prop(s, 'og:title', cfg['title'], path)
    s = set_meta_prop(s, 'og:description', cfg['desc'], path)
    s = set_meta_name(s, 'twitter:title', cfg['title'], path)
    s = set_meta_name(s, 'twitter:description', cfg['desc'], path)
    s = sub1(s, r'<script type="application/ld\+json">.*?</script>', schema(platform,'ru',cfg['title'],cfg['desc']), path)
    s = sub1(s, r'<section class="uv-hero"><div class="uv-hero-kicker"><span></span>SOVAZONE VALUATION AI<span></span></div><h1>.*?</h1><p>.*?</p></section>', f'<section class="uv-hero"><div class="uv-hero-kicker"><span></span>SOVAZONE VALUATION AI<span></span></div><h1>{cfg["h1"]}</h1><p>{cfg["hero"]}</p></section>', path)
    s = replace_all(s, '<h2>Введите username</h2>', '<h2>Введите никнейм</h2>')
    s = replace_all(s, 'тип username', 'тип никнейма')
    s = replace_all(s, 'placeholder="username" aria-label="Username"', 'placeholder="никнейм" aria-label="Никнейм"')
    s = replace_all(s, '<button class="uv-submit" type="submit">Оценить</button>', '<button class="uv-submit" type="submit">Узнать стоимость</button>')
    s = replace_all(s, 'Анализируем username…', 'Анализируем никнейм…')
    s = replace_all(s, 'Как складывается стоимость username', f'Как узнать стоимость никнейма {platform.capitalize()}')
    s = replace_all(s, 'чистый username', 'чистый никнейм')
    s = replace_all(s, 'Instagram username', 'никнейм Instagram')
    s = replace_all(s, 'TikTok username', 'никнейм TikTok')
    s = replace_all(s, 'Telegram username', 'никнейм Telegram')
    s = replace_all(s, 'работы с username', 'работы с никнеймами')
    s = replace_all(s, 'за этот username', 'за этот никнейм')
    s = replace_all(s, 'по длине username', 'по длине никнейма')
    s = replace_all(s, 'username могут', 'никнеймы могут')
    s = replace_all(s, 'этот username', 'этот никнейм')
    s = replace_all(s, 'свой username', 'свой никнейм')
    s = replace_all(s, 'Хотите продать Instagram username?', 'Хотите продать никнейм Instagram?')
    s = replace_all(s, 'Как продать username →', 'Как разместить объявление →')
    if platform == 'tiktok':
        old = '<details><summary>Я хочу продать свой никнейм. Что делать?</summary><p>Вы можете отправить его на размещение через <a href="/sell" style="color:#e0b88e">SovaUsername</a>. Мы рассмотрим предложение и при подходящем формате сможем разместить его на нашей площадке.</p></details>'
        if old in s:
            s = s.replace(old, '<details><summary>Я хочу продать свой никнейм. Что делать?</summary><p>Откройте страницу <a href="/sell" style="color:#e0b88e">«Как продать»</a> и следуйте инструкции по самостоятельной публикации объявления в Telegram-канале SovaUsername.</p></details>', 1)
    write(path, s)

# Supporting long-tail phrasing on RU platform pages without changing URLs or architecture.
for platform in ('instagram','tiktok','telegram'):
    path = ru_pages[platform]['path']; s = read(path)
    marker = '<section class="uv-seo">'
    if marker not in s:
        raise SystemExit(f'SEO section missing in {path}')
    write(path, s)

en_pages = {
    'instagram': {
        'path':'en/tools/instagram-username-value.html',
        'title':'Instagram Username Value — Find What It’s Worth | SovaZone',
        'desc':'Find the value of an Instagram username with SovaZone Valuation AI. The model uses scarcity, length, words, names, geography, digits and buyer demand.',
        'h1':'Instagram username value',
        'hero':'Enter an Instagram username and find its indicative value using the SovaZone model.',
    },
    'tiktok': {
        'path':'en/tools/tiktok-username-value.html',
        'title':'TikTok Username Value — Find What It’s Worth | SovaZone',
        'desc':'Find the value of a TikTok username with SovaZone Valuation AI. The model uses scarcity, meaning, patterns and platform-specific buyer demand.',
        'h1':'TikTok username value',
        'hero':'Enter a TikTok username and find its indicative value using the SovaZone model.',
    },
    'telegram': {
        'path':'en/tools/telegram-username-value.html',
        'title':'Telegram Username Value — Fragment & TON | SovaZone',
        'desc':'Find the value of a Telegram username using cleaned Fragment sales evidence, scarcity, meaning, patterns and buyer demand. Range in TON and USD.',
        'h1':'Telegram username value',
        'hero':'Enter a Telegram username and find its indicative value from the SovaZone model and cleaned Fragment evidence.',
    }
}

for platform, cfg in en_pages.items():
    path = cfg['path']; s = read(path)
    s = set_title(s, cfg['title'], path)
    s = set_meta_name(s, 'description', cfg['desc'], path)
    s = set_meta_prop(s, 'og:site_name', 'SovaZone Valuation AI', path)
    s = set_meta_prop(s, 'og:title', cfg['title'], path)
    s = set_meta_prop(s, 'og:description', cfg['desc'], path)
    s = set_meta_name(s, 'twitter:title', cfg['title'], path)
    s = set_meta_name(s, 'twitter:description', cfg['desc'], path)
    s = sub1(s, r'<script type="application/ld\+json">.*?</script>', schema(platform,'en',cfg['title'],cfg['desc']), path)
    s = sub1(s, r'<section class="uv-hero"><div class="uv-hero-kicker"><span></span>SOVAZONE VALUATION AI<span></span></div><h1>.*?</h1><p>.*?</p></section>', f'<section class="uv-hero"><div class="uv-hero-kicker"><span></span>SOVAZONE VALUATION AI<span></span></div><h1>{cfg["h1"]}</h1><p>{cfg["hero"]}</p></section>', path)
    s = replace_all(s, 'Instagram handle', 'Instagram username')
    s = replace_all(s, 'TikTok handle', 'TikTok username')
    s = replace_all(s, 'equivalent Instagram handles', 'equivalent Instagram usernames')
    s = replace_all(s, 'handle scarcity', 'username scarcity')
    s = replace_all(s, 'geographic handles', 'geographic usernames')
    s = replace_all(s, 'comparable handles', 'comparable usernames')
    s = replace_all(s, '<button class="uv-submit" type="submit">Estimate</button>', '<button class="uv-submit" type="submit">Find value</button>')
    if platform in ('instagram','tiktok'):
        s = replace_once(s, '<h2>How the estimate works</h2>', f'<h2>How to find an {platform.capitalize()} username value</h2>', path)
        faq_anchor = '<div class="uv-faq">'
        q = f'<details><summary>How much is my {platform.capitalize()} username worth?</summary><p>The tool gives an indicative range rather than a guaranteed sale price. Scarcity, meaning, length, demand and comparable usernames can all change the result.</p></details>'
        s = replace_once(s, faq_anchor, faq_anchor+q, path)
    elif platform == 'telegram':
        faq_anchor = '<div class="uv-faq">'
        q = '<details><summary>How much is my Telegram username worth?</summary><p>The tool estimates a range from scarcity, meaning, buyer demand and cleaned Fragment evidence rather than treating one historical sale as the market price.</p></details>'
        s = replace_once(s, faq_anchor, faq_anchor+q, path)
    write(path, s)

# Shared client UI: Russian says "никнейм" and both languages use discovery-oriented CTA.
path = 'tools/username-value.js'; s = read(path)
s = replace_all(s, "t('Недопустимый username','Invalid username')", "t('Недопустимый никнейм','Invalid username')")
s = replace_all(s, "t('Username','Username')", "t('Никнейм','Username')")
s = replace_all(s, "t('Оцениваем…','Valuing…')", "t('Считаем…','Calculating…')")
s = replace_all(s, "t('Оценить','Estimate')", "t('Узнать стоимость','Find value')")
s = replace_all(s, "t('Введите username.','Enter a username.')", "t('Введите никнейм.','Enter a username.')")
s = replace_all(s, "t('Username слишком длинный.','Username is too long.')", "t('Никнейм слишком длинный.','Username is too long.')")
s = replace_all(s, "t('Telegram collectible username должен содержать минимум 4 символа.','A Telegram collectible username must contain at least 4 characters.')", "t('Коллекционный никнейм Telegram должен содержать минимум 4 символа.','A Telegram collectible username must contain at least 4 characters.')")
s = replace_all(s, "t('Username Telegram не может начинаться или заканчиваться символом _.','A Telegram username cannot start or end with _.')", "t('Никнейм Telegram не может начинаться или заканчиваться символом _.','A Telegram username cannot start or end with _.')")
write(path, s)

# Cache-bust client copy only; valuation engines are untouched.
for path in [
    'tools/instagram-username-value.html','tools/tiktok-username-value.html','tools/telegram-username-value.html',
    'en/tools/instagram-username-value.html','en/tools/tiktok-username-value.html','en/tools/telegram-username-value.html'
]:
    s = read(path)
    s = s.replace('/tools/username-value.js?v=16','/tools/username-value.js?v=17')
    write(path, s)

# Final guards: visible RU terminology and EN keyword intent.
for path in ['tools/username-value.html','tools/instagram-username-value.html','tools/tiktok-username-value.html','tools/telegram-username-value.html']:
    s = read(path)
    if 'SOVAZONE VALUATION AI' not in s:
        raise SystemExit(f'Brand missing in {path}')
    if 'Узнать стоимость' not in s:
        raise SystemExit(f'RU search intent missing in {path}')

for path in ['en/tools/username-value.html','en/tools/instagram-username-value.html','en/tools/tiktok-username-value.html','en/tools/telegram-username-value.html']:
    s = read(path).lower()
    if 'username value' not in s:
        raise SystemExit(f'EN username value intent missing in {path}')
    if 'sovazone valuation ai' not in s:
        raise SystemExit(f'Brand missing in {path}')

print('Valuation AI SEO copy refinement prepared')
