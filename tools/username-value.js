
(function(){
  var root = document.querySelector('[data-username-value-tool]');
  if(!root) return;
  var platform = root.getAttribute('data-platform') || 'instagram';
  var lang = root.getAttribute('data-lang') || 'ru';
  var form = root.querySelector('.uv-form');
  var input = root.querySelector('.uv-input');
  var button = root.querySelector('.uv-submit');
  var loader = root.querySelector('.uv-loader');
  var result = root.querySelector('.uv-result');
  var error = root.querySelector('.uv-error');
  var lastRun = 0;
  var CACHE_VERSION = 'instagram-v2.3';

  function t(ru,en){ return lang === 'en' ? en : ru; }
  function cleanUsername(v){
    v = String(v || '').trim();
    v = v.replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i,'');
    v = v.replace(/^@/,'').split(/[/?#]/)[0].trim();
    return v;
  }
  function money(n){
    n = Number(n || 0);
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function range(min,max){
    min=Number(min||0);max=Number(max||0);
    if(min===max) return '≈ ' + money(min);
    return money(min) + '–' + money(max);
  }
  function showError(msg){
    error.textContent=msg;error.classList.add('is-visible');result.classList.remove('is-visible');
  }
  function hideError(){ error.classList.remove('is-visible'); error.textContent=''; }
  function setLoading(on){
    button.disabled=on;loader.classList.toggle('is-visible',on);
    button.textContent=on ? t('Оцениваем…','Valuing…') : t('Оценить','Estimate');
  }
  function reasonCard(title,text){
    return '<div class="uv-reason"><strong>'+escapeHtml(title)+'</strong><span>'+escapeHtml(text)+'</span></div>';
  }
  function escapeHtml(s){
    return String(s||'').replace(/[&<>'\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});
  }
  function qualityLabel(score){
    score=Number(score||0);
    if(score>=80) return t('Высокое качество','High quality');
    if(score>=55) return t('Хорошее качество','Good quality');
    if(score>=30) return t('Среднее качество','Average quality');
    return t('Низкое качество','Low quality');
  }
  function liquidityLabel(data){
    var v=String(data.liquidity||'low');
    if(v==='high') return t('Высокая ликвидность','High liquidity');
    if(v==='medium') return t('Средняя ликвидность','Medium liquidity');
    return t('Низкая ликвидность','Low liquidity');
  }
  function cacheKey(username){
    return ['sova-valuation',CACHE_VERSION,platform,lang,String(username||'').toLowerCase()].join(':');
  }
  function readCache(username){
    try{
      var raw=localStorage.getItem(cacheKey(username));
      if(!raw) return null;
      var data=JSON.parse(raw);
      if(!data || data.engineVersion!==CACHE_VERSION) return null;
      return data;
    }catch(e){ return null; }
  }
  function writeCache(username,data){
    try{
      if(data && data.engineVersion===CACHE_VERSION) localStorage.setItem(cacheKey(username),JSON.stringify(data));
    }catch(e){}
  }
  function render(data){
    var reasons = Array.isArray(data.factors) ? data.factors.slice(0,3) : [];
    var sellHref = lang === 'en' ? '/en/sell' : '/sell';
    var catalogHref = lang === 'en' ? '/en/usernames' : '/usernames';
    while(reasons.length<3) reasons.push({title:t('Фактор','Factor'),text:t('Учтён в общей оценке.','Included in the overall estimate.')});
    var meta = [];
    if(data.category) meta.push(escapeHtml(data.category));
    if(typeof data.qualityScore !== 'undefined') meta.push(escapeHtml(qualityLabel(data.qualityScore))+' · '+Math.round(Number(data.qualityScore)||0)+'/100');
    if(data.liquidity) meta.push(escapeHtml(liquidityLabel(data)));
    result.innerHTML =
      '<div class="uv-result-top">'+
        '<div><div class="uv-result-label">'+t('Username','Username')+'</div><div class="uv-result-handle">@'+escapeHtml(data.username)+'</div><div class="uv-confidence">'+meta.join(' · ')+'</div></div>'+
        '<div><div class="uv-result-label">'+t('Ориентировочная стоимость','Estimated value')+'</div><div class="uv-price">'+range(data.priceMin,data.priceMax)+'</div></div>'+
      '</div>'+
      '<div class="uv-reasons">'+reasons.map(function(r){return reasonCard(r.title,r.text)}).join('')+'</div>'+
      '<p class="uv-result-note">'+escapeHtml(data.disclaimer||t('Оценка является ориентировочной и не гарантирует цену реальной сделки.','This is an indicative estimate and does not guarantee an actual transaction price.'))+'</p>'+
      '<div class="uv-result-actions"><a class="uv-btn uv-btn--accent" href="'+sellHref+'">'+t('Продать через SovaUsername','Sell via SovaUsername')+'</a><a class="uv-btn" href="'+catalogHref+'">'+t('Каталог SovaZone','SovaZone catalog')+'</a></div>';
    result.classList.add('is-visible');
  }
  form.addEventListener('submit', async function(e){
    e.preventDefault();hideError();
    var username=cleanUsername(input.value);
    if(!username){ showError(t('Введите username.','Enter a username.')); return; }
    if(username.length>30){ showError(t('Username слишком длинный.','Username is too long.')); return; }
    if(!/^[a-zA-Z0-9._]+$/.test(username)){ showError(t('Используйте латинские буквы, цифры, точку или _.','Use Latin letters, numbers, a dot, or _.')); return; }

    var cached=readCache(username);
    if(cached){ render(cached); return; }

    var now=Date.now();
    if(now-lastRun<1800){ showError(t('Подождите пару секунд перед новой оценкой.','Wait a couple of seconds before another estimate.')); return; }
    lastRun=now;setLoading(true);result.classList.remove('is-visible');
    try{
      var res=await fetch('https://sovazone.vercel.app/api/username-value-v23/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:username,platform:platform,lang:lang,website:''})});
      var data=await res.json().catch(function(){return {}});
      if(!res.ok) throw new Error(data.error||t('Не удалось выполнить оценку.','Could not complete the estimate.'));
      writeCache(username,data);
      render(data);
    }catch(err){showError(err.message||t('Ошибка. Попробуйте ещё раз.','Error. Please try again.'));}
    finally{setLoading(false);}
  });
})();