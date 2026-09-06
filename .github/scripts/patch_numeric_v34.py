from pathlib import Path

backend = Path('api/username-value.js')
s = backend.read_text()

old_version = "const ENGINE_VERSION = 'instagram-v3.3';"
new_version = "const ENGINE_VERSION = 'instagram-v3.4';"
if s.count(old_version) != 1:
    raise SystemExit('unexpected backend engine version target count')
s = s.replace(old_version, new_version, 1)

old_score = """function numericScore3(lower){
  const s=numericSignals(lower),chars=s.chars;
  let score=chars.reduce((a,c)=>a+symbolTier(c),0)/3;
  if(s.allSame)score+=5;
  if(s.palindrome&&!s.allSame)score+=2;
  if(s.ascending)score+=4;
  if(s.descending)score+=3.5;
  if(!s.allSame&&(s.pairPrefix||s.pairSuffix))score+=1;
  if(s.allSame&&['1','7','0'].includes(chars[0]))score+=3;
  const culture={'404':4,'007':1,'666':2.5,'100':2,'999':0.5,'888':0.4,'200':1.2,'911':0.7,'420':0.3};
  if(Object.prototype.hasOwnProperty.call(culture,lower))score+=culture[lower];
  return score;
}"""

new_score = """function numericRange3(lower){
  const s=numericSignals(lower),chars=s.chars;
  const strong=chars.filter(c=>STRONG_DIGITS.has(c)).length;
  const weak=chars.filter(c=>WEAK_DIGITS.has(c)).length;
  const out=(min,max,score,liq='medium',open=false)=>({min,max,score,liq,open});

  // Repeating triples: repetition is the main premium, then digit demand separates tiers.
  if(s.allSame){
    if(['1','7','0'].includes(chars[0]))return out(50000,50000,94,'high',true);
    if(['5','6','9'].includes(chars[0]))return out(10000,15000,80,'high');
    if(chars[0]==='8')return out(7000,12000,76,'high');
    return out(5000,10000,70,'medium');
  }

  // Recognisable cultural / internet / emergency codes get semantic demand on top of structure.
  if(lower==='404')return out(10000,20000,86,'high');
  if(lower==='007')return out(5000,10000,72,'medium');
  if(lower==='911')return out(3000,5000,64,'medium');
  if(lower==='420')return out(1500,2000,55,'low');

  // Round hundreds generalise by the leading digit rather than exact-number lookup.
  if(chars[1]==='0'&&chars[2]==='0'){
    if(chars[0]==='1')return out(10000,15000,80,'high');
    if(chars[0]==='2')return out(5000,10000,70,'medium');
    if(STRONG_DIGITS.has(chars[0]))return out(7000,12000,74,'medium');
    if(WEAK_DIGITS.has(chars[0]))return out(3000,5000,62,'medium');
    return out(5000,8000,67,'medium');
  }

  // 101 is a particularly recognisable palindrome (binary / introductory-course notation).
  if(lower==='101')return out(7000,10000,78,'high');

  // Other palindromes scale with the quality of their digits.
  if(s.palindrome){
    if(strong===3)return out(5000,8000,72,'medium');
    if(strong>=2)return out(5000,8000,70,'medium');
    if(weak>=2)return out(2000,3500,59,'low');
    return out(3000,5000,64,'medium');
  }

  // Ascending sequences are stronger when they start cleanly and avoid weak digits.
  if(s.ascending){
    if(chars[0]==='1'&&weak===0)return out(10000,15000,80,'high');
    if(weak>=2)return out(3000,5000,64,'medium');
    if(strong>=2)return out(5000,10000,70,'medium');
    return out(3000,5000,64,'medium');
  }

  // Descending sequences carry a smaller premium than comparable ascending sequences.
  if(s.descending){
    if(strong>=2)return out(5000,8000,69,'medium');
    return out(3000,5000,64,'medium');
  }

  // Non-pattern triples stay close to scarcity floor unless digit quality itself is strong.
  if(weak>=2)return out(1500,2000,55,'low');
  if(strong>=2)return out(3000,5000,64,'medium');
  if(strong===1&&weak===0)return out(2000,3500,60,'low');
  return out(1500,2500,56,'low');
}"""

if s.count(old_score) != 1:
    raise SystemExit('unexpected numericScore3 target count')
s = s.replace(old_score, new_score, 1)

old_block = """  if(/^\\d{3}$/.test(lower)){
    const s=numericScore3(lower);let min,max,open=false,score,liq;
    if(s>=8.5){min=50000;max=50000;open=true;score=94;liq='high';}
    else if(s>=6.15){min=10000;max=20000;score=86;liq='high';}
    else if(s>=4){min=10000;max=15000;score=80;liq='high';}
    else if(s>=2.5){min=5000;max=10000;score=72;liq='medium';}
    else if(s>=1.5){min=3000;max=6000;score=64;liq='medium';}
    else{min=1500;max=3500;score=55;liq='low';}
    const factors=lang==='en'
      ? [{title:'Numeric scarcity',text:'Three-digit handles are scarce; pattern quality determines the premium.'},{title:'Pattern',text:'Repetition, symmetry, sequence, digit quality and cultural meaning are scored together.'},{title:'Demand',text:liq==='high'?'The number pattern has broad real buyer appeal.':liq==='medium'?'The pattern has clear but narrower demand.':'Scarcity remains, but the pattern itself is comparatively weak.'}]
      : [{title:'Редкость',text:'Трёхзначные ники редки; премию определяет качество числового паттерна.'},{title:'Паттерн',text:'Повторы, симметрия, последовательность, качество цифр и культурный смысл учитываются вместе.'},{title:'Спрос',text:liq==='high'?'У числового паттерна широкий реальный спрос.':liq==='medium'?'У паттерна заметный, но более узкий спрос.':'Редкость сохраняется, но сам паттерн сравнительно слабый.'}];
    return make(min,max,open,lang==='en'?'Numeric username':'Цифровой username','numeric',score,liq,factors);
  }"""

new_block = """  if(/^\\d{3}$/.test(lower)){
    const r=numericRange3(lower),min=r.min,max=r.max,open=r.open,score=r.score,liq=r.liq;
    const factors=lang==='en'
      ? [{title:'Numeric scarcity',text:'Three-digit handles are scarce; pattern quality determines the premium.'},{title:'Pattern',text:'Repetition, symmetry, sequence, digit quality and cultural meaning are scored together.'},{title:'Demand',text:liq==='high'?'The number pattern has broad real buyer appeal.':liq==='medium'?'The pattern has clear but narrower demand.':'Scarcity remains, but the pattern itself is comparatively weak.'}]
      : [{title:'Редкость',text:'Трёхзначные ники редки; премию определяет качество числового паттерна.'},{title:'Паттерн',text:'Повторы, симметрия, последовательность, качество цифр и культурный смысл учитываются вместе.'},{title:'Спрос',text:liq==='high'?'У числового паттерна широкий реальный спрос.':liq==='medium'?'У паттерна заметный, но более узкий спрос.':'Редкость сохраняется, но сам паттерн сравнительно слабый.'}];
    return make(min,max,open,lang==='en'?'Numeric username':'Цифровой username','numeric',score,liq,factors);
  }"""

if s.count(old_block) != 1:
    raise SystemExit('unexpected 3-digit structural block target count')
s = s.replace(old_block, new_block, 1)
backend.write_text(s)

frontend = Path('tools/username-value.js')
js = frontend.read_text()
old_cache = "var CACHE_VERSION='instagram-v3.3';"
new_cache = "var CACHE_VERSION='instagram-v3.4';"
if js.count(old_cache) != 1:
    raise SystemExit('unexpected frontend cache target count')
frontend.write_text(js.replace(old_cache, new_cache, 1))

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
    if '/tools/username-value.js?v=8' in hs:
        hp.write_text(hs.replace('/tools/username-value.js?v=8', '/tools/username-value.js?v=9'))
        changed += 1
if changed == 0:
    raise SystemExit('no HTML cache-bust target found')

print(f'patched backend, frontend cache, and {changed} HTML pages')
