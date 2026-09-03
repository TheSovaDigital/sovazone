
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
    return String(s||'').replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});
  }
  function render(data){
    var reasons = Array.isArray(data.factors) ? data.factors.slice(0,3) : [];
    while(reasons.length<3) reasons.push({title:t('Фактор','Factor'),text:t('Учтён в общей оценке.','Included in the overall estimate.')});
    result.innerHTML =
      '<div class="uv-result-top">'+
        '<div><div class="uv-result-label">'+t('Username','Username')+'</div><div class="uv-result-handle">@'+escapeHtml(data.username)+'</div><div class="uv-confidence">'+escapeHtml(data.category||'')+'</div></div>'+
        '<div><div class="uv-result-label">'+t('Ориентировочная стоимость','Estimated value')+'</div><div class="uv-price">'+range(data.priceMin,data.priceMax)+'</div></div>'+
      '</div>'+
      '<div class="uv-reasons">'+reasons.map(function(r){return reasonCard(r.title,r.text)}).join('')+'</div>'+
      '<p class="uv-result-note">'+escapeHtml(data.disclaimer||t('Оценка является ориентировочной и не гарантирует цену реальной сделки.','This is an indicative estimate and does not guarantee an actual transaction price.'))+'</p>'+
      '<div class="uv-result-actions"><a class="uv-btn uv-btn--accent" href="/sell">'+t('Продать через SovaUsername','Sell via SovaUsername')+'</a><a class="uv-btn" href="/usernames">'+t('Каталог SovaZone','SovaZone catalog')+'</a></div>';
    result.classList.add('is-visible');
  }
  form.addEventListener('submit', async function(e){
    e.preventDefault();hideError();
    var username=cleanUsername(input.value);
    if(!username){ showError(t('Введите username.','Enter a username.')); return; }
    if(username.length>30){ showError(t('Username слишком длинный.','Username is too long.')); return; }
    if(!/^[a-zA-Z0-9._]+$/.test(username)){ showError(t('Используйте латинские буквы, цифры, точку или _.','Use Latin letters, numbers, a dot, or _.')); return; }
    var now=Date.now();
    if(now-lastRun<1800){ showError(t('Подождите пару секунд перед новой оценкой.','Wait a couple of seconds before another estimate.')); return; }
    lastRun=now;setLoading(true);result.classList.remove('is-visible');
    try{
      var res=await fetch('/api/username-value',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:username,platform:platform,lang:lang,website:''})});
      var data=await res.json().catch(function(){return {}});
      if(!res.ok) throw new Error(data.error||t('Не удалось выполнить оценку.','Could not complete the estimate.'));
      render(data);
    }catch(err){showError(err.message||t('Ошибка. Попробуйте ещё раз.','Error. Please try again.'));}
    finally{setLoading(false);}
  });
})();
