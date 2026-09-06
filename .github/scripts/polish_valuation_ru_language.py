from pathlib import Path
import re

ru_pages = [
    'tools/instagram-username-value.html',
    'tools/tiktok-username-value.html',
    'tools/telegram-username-value.html',
]

replacements = {
    'Двухсимвольные никнейм Instagram':'Двухсимвольные никнеймы Instagram',
    'Двухсимвольные никнейм TikTok':'Двухсимвольные никнеймы TikTok',
    'Почему одинаковые по длине никнейма могут':'Почему одинаковые по длине никнеймы могут',
    'которым такой username может быть нужен':'которым такой никнейм может быть нужен',
    'Как цифры влияют на стоимость username?':'Как цифры влияют на стоимость никнейма?',
    'снижают универсальность username':'снижают универсальность никнейма',
    'делают username менее редким':'делают никнейм менее редким',
    'с чистыми username без точки':'с чистыми никнеймами без точки',
    'Это цена, за которую username точно можно продать?':'Это цена, за которую никнейм точно можно продать?',
    'У username нет прозрачного ликвидного рынка':'У никнеймов нет прозрачного ликвидного рынка',
    'логику качества username':'логику качества никнейма',
    'перевод username в collectible NFT':'перевод никнейма в коллекционный NFT',
    'Четырёхсимвольные collectible username':'Четырёхсимвольные коллекционные никнеймы',
    'Бессмысленный длинный username':'Бессмысленный длинный никнейм',
    'что username столько и стоит?':'что никнейм столько и стоит?',
    'четырёхсимвольные collectible username':'четырёхсимвольные коллекционные никнеймы',
    'получения collectible NFT':'получения коллекционного NFT',
    'Tiktok':'TikTok',
}

for path in ru_pages:
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    for old, new in replacements.items():
        s = s.replace(old, new)
    # Guard visible body copy. Preserve the SovaUsername brand, but remove generic English "username" from RU text.
    body = s.split('</head>', 1)[1]
    visible = ' '.join(re.findall(r'>([^<>]+)<', body))
    visible_guard = visible.replace('SovaUsername', '').replace('sovausername', '')
    if 'username' in visible_guard.lower():
        i = visible_guard.lower().find('username')
        raise SystemExit(f'Visible username remains in RU page {path}: {visible_guard[max(0,i-80):i+120]}')
    p.write_text(s, encoding='utf-8')

# Main RU H1: keep the exact search phrase; AI already lives in the brand kicker.
p = Path('tools/username-value.html')
s = p.read_text(encoding='utf-8')
s = s.replace('<span class="uv-title-line">никнейма AI</span>', '<span class="uv-title-line">никнейма</span>', 1)
p.write_text(s, encoding='utf-8')

# Shared result CTA also uses Russian terminology only.
p = Path('tools/username-value.js')
s = p.read_text(encoding='utf-8')
s = s.replace("t('Как продать username','How to sell a username')", "t('Как разместить объявление','How to sell a username')", 1)
p.write_text(s, encoding='utf-8')

# Cache bust for the shared UI copy.
for path in ru_pages + [
    'en/tools/instagram-username-value.html',
    'en/tools/tiktok-username-value.html',
    'en/tools/telegram-username-value.html',
]:
    p = Path(path)
    s = p.read_text(encoding='utf-8').replace('/tools/username-value.js?v=17','/tools/username-value.js?v=18')
    p.write_text(s, encoding='utf-8')

print('Russian Valuation AI terminology polished')
