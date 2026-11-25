'use strict';
const tg=window.Telegram?.WebApp;
try{tg?.ready();tg?.expand();}catch{}
const el=id=>document.getElementById(id);
const fmt=n=>Math.max(0,Number(n)||0).toLocaleString('ru-RU');
function lines(node,data){
  node.replaceChildren();
  const max=Math.max(1,...Object.values(data).map(Number));
  for(const [key,value] of Object.entries(data)){
    const wrap=document.createElement('div');wrap.className='item';
    const name=document.createElement('span');name.textContent=key;
    const track=document.createElement('div');track.className='track';
    const bar=document.createElement('div');bar.className='fill';bar.style.width=Math.max(0,Math.min(100,Number(value)/max*100))+'%';
    track.append(bar);
    const count=document.createElement('b');count.textContent=fmt(value);
    wrap.append(name,track,count);node.append(wrap);
  }
}
function show(data){
  el('registered').textContent=fmt(data.registeredUsers);
  el('active7').textContent=fmt(data.uniqueActiveUsers7);
  el('valuations').textContent=fmt(data.valuationCount30);
  el('optin').textContent=fmt(data.optInUsers);
  el('new').textContent=fmt(data.newRegistrations30);
  el('starts').textContent=fmt(data.botStarts30);
  el('opens').textContent=fmt(data.appOpens30);
  el('evaluators').textContent=fmt(data.uniqueEvaluators30);
  lines(el('platforms'),{Instagram:data.byPlatform?.instagram||0,TikTok:data.byPlatform?.tiktok||0,Telegram:data.byPlatform?.telegram||0});
  const sources=data.sources||{};
  lines(el('sources'),{'Прямой вход':sources.direct||0,'Поделиться':sources.share||0,'Другие источники':sources.other||0,'Mini App ссылка':sources.startapp||0});
  const days=data.daily||[],max=Math.max(1,...days.map(x=>Number(x.events)||0));el('chart').replaceChildren();
  days.forEach(x=>{
    const bar=document.createElement('div');bar.className='bar';
    bar.style.height=Math.max(1,Math.round((Number(x.events)||0)/max*100))+'%';
    bar.setAttribute('data-label',x.day+': '+fmt(x.events));bar.title=x.day+': '+fmt(x.events);
    el('chart').append(bar);
  });
  el('startdate').textContent=days[0]?.day||'—';el('enddate').textContent=days.at(-1)?.day||'—';
  el('note').textContent='Обновлено: '+new Date(data.asOf).toLocaleString('ru-RU')+' · Первые данные по событиям собираются с момента включения новой аналитики. Исторические оценки до её запуска восстановить нельзя. '+(data.warning||'');
  el('data').hidden=false;el('status').textContent='Статистика доступна только для подтверждённого Telegram администратора.';
}
(async()=>{
  if(!tg?.initData){el('status').textContent='Откройте /stats в @ValuationAiBot и нажмите «Открыть статистику». В обычном браузере доступ закрыт.';return}
  try{
    const res=await fetch('/api/admin-stats',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg.initData}),cache:'no-store'});
    if(res.status===403){el('status').textContent='Нет доступа. Укажите свой Telegram ID в VALUATION_ADMIN_IDS в настройках Vercel.';return}
    if(res.status===401){el('status').textContent='Подпись Telegram недействительна. Откройте приложение заново из бота.';return}
    if(!res.ok)throw Error('HTTP '+res.status);
    const body=await res.json();
    if(!body?.stats)throw Error('Missing metrics');
    show(body.stats);
  }catch(e){el('status').textContent='Не удалось получить статистику: '+String(e.message||'Ошибка сервера')}
})();