from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'expected text not found in {path}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')

# Landing pages: the valuation tool should only point to the self-service selling guide.
replace_once(
    'tools/username-value.html',
    '<div class="uv-sell-callout"><div><strong>Хотите продать Instagram username?</strong><p>Отправьте Instagram username на рассмотрение через площадку SovaUsername.</p></div><a href="/sell">Продать Instagram username →</a></div>',
    '<div class="uv-sell-callout"><div><strong>Хотите продать Instagram username?</strong><p>Откройте инструкцию по самостоятельному размещению объявления в Telegram-канале SovaUsername.</p></div><a href="/sell">Как продать username →</a></div>'
)
replace_once(
    'en/tools/username-value.html',
    '<div class="uv-sell-callout"><div><strong>Want to sell an Instagram username?</strong><p>Submit an Instagram handle through SovaUsername for review.</p></div><a href="/en/sell">Sell an Instagram username →</a></div>',
    '<div class="uv-sell-callout"><div><strong>Want to sell an Instagram username?</strong><p>Open the selling guide for instructions on publishing your listing yourself in the SovaUsername Telegram channel.</p></div><a href="/en/sell">How to sell a username →</a></div>'
)

# Instagram estimator pages: remove any implication that a sale request is sent to SovaZone.
replace_once(
    'tools/instagram-username-value.html',
    '<div class="uv-sell-callout"><div><strong>Хотите продать username?</strong><p>Разместите предложение через нашу площадку SovaUsername — заявку можно отправить прямо на сайте.</p></div><a href="/sell">Продать через SovaUsername →</a></div>',
    '<div class="uv-sell-callout"><div><strong>Хотите продать Instagram username?</strong><p>Откройте страницу «Как продать» и следуйте инструкции по самостоятельной публикации объявления в Telegram-канале SovaUsername.</p></div><a href="/sell">Как продать username →</a></div>'
)
replace_once(
    'tools/instagram-username-value.html',
    '<details><summary>Я хочу продать свой username. Что делать?</summary><p>Вы можете отправить его на размещение через <a href="/sell" style="color:#e0b88e">SovaUsername</a>. Мы рассмотрим предложение и при подходящем формате сможем разместить его на нашей площадке.</p></details>',
    '<details><summary>Я хочу продать свой username. Что делать?</summary><p>Откройте страницу <a href="/sell" style="color:#e0b88e">«Как продать»</a> и следуйте инструкции. Объявление о продаже публикуется самостоятельно в Telegram-канале SovaUsername.</p></details>'
)
replace_once(
    'en/tools/instagram-username-value.html',
    '<div class="uv-sell-callout"><div><strong>Want to sell an Instagram username?</strong><p>Submit it through SovaUsername and we will review the Instagram handle and its market potential.</p></div><a href="/en/sell">Sell an Instagram username →</a></div>',
    '<div class="uv-sell-callout"><div><strong>Want to sell an Instagram username?</strong><p>Open the selling guide and follow the instructions to publish your listing yourself in the SovaUsername Telegram channel.</p></div><a href="/en/sell">How to sell a username →</a></div>'
)

# Result action is informational: it opens the selling instructions, not a contact/request flow.
replace_once(
    'tools/username-value.js',
    "'+t('Продать через SovaUsername','Sell via SovaUsername')+'",
    "'+t('Как продать username','How to sell a username')+'"
)

# Bust the shared JS cache consistently on all estimator pages.
for path in [
    'tools/instagram-username-value.html','tools/tiktok-username-value.html','tools/telegram-username-value.html',
    'en/tools/instagram-username-value.html','en/tools/tiktok-username-value.html','en/tools/telegram-username-value.html'
]:
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if '/tools/username-value.js?v=15' not in s:
        raise SystemExit(f'expected JS cache version not found in {path}')
    p.write_text(s.replace('/tools/username-value.js?v=15', '/tools/username-value.js?v=16', 1), encoding='utf-8')

# Guard against the misleading phrases returning.
combined = '\n'.join(Path(p).read_text(encoding='utf-8') for p in [
    'tools/username-value.html','tools/instagram-username-value.html',
    'en/tools/username-value.html','en/tools/instagram-username-value.html'
])
for banned in [
    'Отправьте Instagram username на рассмотрение',
    'заявку можно отправить прямо на сайте',
    'Мы рассмотрим предложение',
    'Submit an Instagram handle through SovaUsername for review',
    'we will review the Instagram handle'
]:
    if banned in combined:
        raise SystemExit(f'misleading sales copy remains: {banned}')

print('Self-service selling guidance patch prepared')
