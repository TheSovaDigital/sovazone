from pathlib import Path

backend = Path('api/username-value.js')
s = backend.read_text()

old_version = "const ENGINE_VERSION = 'instagram-v3.4';"
new_version = "const ENGINE_VERSION = 'instagram-v3.5';"
if s.count(old_version) != 1:
    raise SystemExit('unexpected backend version target')
s = s.replace(old_version, new_version, 1)

start = s.find('function structuralResult(username,platform,lang){')
if start < 0:
    raise SystemExit('structuralResult not found')
marker = "\n  if(/^\\d{3}$/.test(lower)){"
pos = s.find(marker, start)
if pos < 0:
    raise SystemExit('numeric 3-char insertion marker not found')
if 'Two-character handles use a deterministic SovaZone scarcity formula.' in s:
    raise SystemExit('two-char block already present')

block = r'''

  if(len===2){
    // Two-character handles use a deterministic SovaZone scarcity formula.
    const chars=[...lower],a=chars[0],b=chars[1];
    const same=a===b,bothLetters=/^[a-z]{2}$/.test(lower),bothDigits=/^\d{2}$/.test(lower);
    const letterDigit=/^[a-z]\d$/.test(lower),digitLetter=/^\d[a-z]$/.test(lower),hasSeparator=/[._]/.test(lower);
    const letterWeight=c=>c==='a'?3:c==='x'?2.4:c==='s'?2.2:c==='z'?2.1:WEAK_LETTERS.has(c)?0.3:1.3;
    const digitWeight=c=>c==='1'?3:c==='7'?2.5:c==='0'?2.1:c==='5'?1.8:c==='8'?0.5:c==='9'?0.3:1.3;
    let min=15000,max=20000,score=55,liq='medium',pattern='balanced';

    if(hasSeparator){
      min=15000;max=(a==='.'||a==='_')?16500:17500;score=38;liq='low';pattern='separator';
    }else if(bothLetters){
      const total=letterWeight(a)+letterWeight(b);
      if(same){
        min=niceRound(15000+letterWeight(a)*1600);
        max=niceRound(18000+letterWeight(a)*4000);
        score=Math.round(68+letterWeight(a)*9);liq='high';pattern='letter-repeat';
      }else if(total>=4.2){
        min=15000;max=30000;score=92;liq='high';pattern='strong-letter-pair';
      }else if(total>=3){
        min=17000;max=23000;score=78;liq='high';pattern='clean-letter-pair';
      }else if(total<=0.8){
        min=15000;max=20000;score=48;liq='medium';pattern='weak-letter-pair';
      }else{
        min=15000;max=22000;score=64;liq='medium';pattern='letter-pair';
      }
    }else if(bothDigits){
      const total=digitWeight(a)+digitWeight(b);
      if(same){
        min=niceRound(15000+digitWeight(a)*1000);
        max=niceRound(18000+digitWeight(a)*4000);
        score=Math.round(70+digitWeight(a)*7);liq='high';pattern='digit-repeat';
      }else if(total>=5){
        min=17000;max=25000;score=84;liq='high';pattern='strong-digit-pair';
      }else if(total>=3){
        min=16000;max=22000;score=72;liq='medium';pattern='digit-pair';
      }else{
        min=15000;max=19000;score=54;liq='medium';pattern='weak-digit-pair';
      }
    }else if(letterDigit){
      const total=letterWeight(a)+digitWeight(b);
      if(total>=5.8){min=18000;max=25000;score=88;liq='high';pattern='premium-letter-digit';}
      else if(total>=5.2){min=17000;max=24000;score=84;liq='high';pattern='strong-letter-digit';}
      else if(total>=4.5){min=15000;max=22000;score=82;liq='high';pattern='strong-letter-digit';}
      else if(total>=3.2){min=15000;max=21000;score=70;liq='medium';pattern='letter-digit';}
      else if(total<=1){min=15000;max=18000;score=38;liq='medium';pattern='weak-letter-digit';}
      else{min=15000;max=20000;score=58;liq='medium';pattern='letter-digit';}
    }else if(digitLetter){
      const total=digitWeight(a)+letterWeight(b);
      if(total>=5.8){min=16000;max=22000;score=86;liq='high';pattern='premium-digit-letter';}
      else if(total>=4.5){min=15000;max=21000;score=78;liq='medium';pattern='strong-digit-letter';}
      else if(total<=1){min=15000;max=17000;score=35;liq='low';pattern='weak-digit-letter';}
      else{min=15000;max=20000;score=58;liq='medium';pattern='digit-letter';}
    }

    const factors=lang==='en'
      ? [{title:'Scarcity',text:'Every two-character Instagram username has a strong scarcity floor.'},{title:'Composition',text:pattern.includes('repeat')?'Repetition adds memorability and collectible demand.':pattern.includes('weak')?'The symbol mix is comparatively weak, so most value comes from scarcity.':'Letter/digit quality, order and visual balance determine the premium above the floor.'},{title:'Demand',text:liq==='high'?'The combination has a broad buyer pool for a two-character handle.':liq==='medium'?'The handle is scarce, but the buyer pool is more selective.':'The handle remains scarce, while the specific composition has narrow demand.'}]
      : [{title:'Редкость',text:'Любой двухсимвольный Instagram username имеет сильный минимум за редкость.'},{title:'Состав',text:pattern.includes('repeat')?'Повтор усиливает запоминаемость и коллекционный спрос.':pattern.includes('weak')?'Сочетание символов сравнительно слабое, поэтому основную ценность даёт редкость.':'Качество букв и цифр, их порядок и визуальный баланс определяют премию выше минимума.'},{title:'Спрос',text:liq==='high'?'Для двухсимвольного ника сочетание имеет широкий круг потенциальных покупателей.':liq==='medium'?'Ник редкий, но аудитория покупателей более избирательна.':'Редкость сохраняется, однако спрос именно на это сочетание сравнительно узкий.'}];
    return make(min,max,false,lang==='en'?'Two-character username':'Двухсимвольный username','short',score,liq,factors);
  }'''

s = s[:pos] + block + s[pos:]
backend.write_text(s)

frontend = Path('tools/username-value.js')
fs = frontend.read_text()
old_cache = "var CACHE_VERSION='instagram-v3.4';"
new_cache = "var CACHE_VERSION='instagram-v3.5';"
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
    if '/tools/username-value.js?v=9' in hs:
        hp.write_text(hs.replace('/tools/username-value.js?v=9', '/tools/username-value.js?v=10'))
        changed += 1
if changed == 0:
    raise SystemExit('no HTML cache-bust target found')

print(f'patched backend/frontend and {changed} HTML files')
