'use strict';
/* All figures come from /api/admin-stats. No sample/placeholder data is ever substituted. */
const tg=window.Telegram?.WebApp||null;
try{tg?.ready();tg?.expand();}catch{}
const el=id=>document.getElementById(id);
const fmt=value=>Math.max(0,Number(value)||0).toLocaleString('ru-RU');
const percent=(num,den)=>den>0?(num/den*100).toLocaleString('ru-RU',{maximumFractionDigits:1})+'%':'—';
const decimal=(num)=>Number(num).toLocaleString('ru-RU',{maximumFractionDigits:2});
const dateUTC=(day)=>new Date(day+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'});
const state={stats:null,period:14,chartMetric:'valuations',eventFilter:'all',busy:false,signedInitData:tg?.initData||''};
const ns='http://www.w3.org/2000/svg';
const sourceLabels={direct:'Прямой переход',share:'Поделились ссылкой',startapp:'Ссылка Mini App',other:'Другие'};
const eventLabels={bot_start:['Запуск бота','i-arrow'],bot_registered:['Новая регистрация','i-users'],app_open:['Открыто приложение','i-grid'],estimate_success:['Успешная оценка','i-check']};
const platformLabels={instagram:'Instagram',tiktok:'TikTok',telegram:'Telegram'};
function node(tag,cls,textValue){const item=document.createElement(tag);if(cls)item.className=cls;if(textValue!==undefined)item.textContent=textValue;return item}
function svgNode(tag,attrs){const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,String(v));return e}
function svgIcon(name){const s=svgNode('svg',{'aria-hidden':'true'}),u=svgNode('use',{href:'#'+name});s.append(u);return s}
function renderStatus(message,isError=false){el('auth-message').textContent=message;el('auth-message').classList.toggle('error-text',isError)}
function showLogin(message){
  el('auth-panel').hidden=false;el('dashboard').hidden=true;el('login-form').hidden=Boolean(state.signedInitData);
  el('login-error').hidden=true;
  renderStatus(message||'Чтобы открыть панель с компьютера, получите код через /stats в @ValuationAiBot.');
  el('refresh-btn').disabled=true;el('export-btn').disabled=true;
}
function setBusy(value){state.busy=value;el('refresh-btn').disabled=value;el('export-btn').disabled=value||!state.stats;el('login-btn').disabled=value}
async function getStats(){
  if(state.busy)return;
  setBusy(true);
  el('sync-state').textContent='Обновление данных…';
  try{
    const response=await fetch('/api/admin-stats',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(state.signedInitData?{initData:state.signedInitData}:{})});
    if(response.status===401||response.status===403){
      state.stats=null;
      showLogin(state.signedInitData?'Ваш Telegram ID не получил доступ к статистике либо сессия устарела. Попробуйте /stats в боте и войдите заново.':'Доступ только администратору. Отправьте /stats в @ValuationAiBot и вставьте одноразовый код.');
      return;
    }
    if(!response.ok)throw Error('Сервер вернул HTTP '+response.status+'. Проверьте подключение хранилища.');
    const data=await response.json();
    if(!data?.ok||!data?.stats||!data.stats.periods)throw Error('Сервер вернул неполную статистику. Обновите приложение.');
    state.stats=data.stats;
    el('auth-panel').hidden=true;el('dashboard').hidden=false;
    el('logout-btn').hidden=Boolean(state.signedInitData);
    el('sync-state').textContent='Статистика синхронизирована';
    render();
  }catch(e){
    if(!state.stats){showLogin('Не удалось загрузить статистику: '+String(e.message||e));el('login-form').hidden=Boolean(state.signedInitData);}
    else{el('sync-state').textContent='Ошибка обновления — показаны предыдущие данные';}
  }finally{setBusy(false)}
}
function periodData(){return state.stats?.periods?.[String(state.period)]||null}
function series(){return (state.stats?.series30||[]).slice(-state.period)}
function number(id,value){el(id).textContent=fmt(value)}
function renderKpi(p){
  number('registered',state.stats.registeredUsers);number('active',p.uniqueActiveUsers);
  number('valuation-total',p.valuations);number('optins',state.stats.optInUsers);
  number('new-registrations',p.registrations);number('bot-starts',p.botStarts);
  number('app-opens',p.appOpens);number('unique-evaluators',p.uniqueEvaluators);
  el('active-period').textContent=state.period+' ДНЕЙ';el('valuations-period').textContent=state.period+' ДНЕЙ';
  el('optin-rate').textContent='От всех пользователей: '+percent(state.stats.optInUsers,state.stats.registeredUsers);
  el('insight-optin').textContent=percent(state.stats.optInUsers,state.stats.registeredUsers);
  el('insight-evaluations').textContent=p.uniqueEvaluators?decimal(p.valuations/p.uniqueEvaluators):'—';
  number('insight-unique-starts',p.uniqueBotUsers);
  number('insight-unique-evaluators',p.uniqueEvaluators);
  number('insight-blocked',state.stats.blockedUsers);
}
function renderSources(p){
  const box=el('sources-list');box.replaceChildren();
  for(const key of ['direct','share','startapp','other']){
    const count=Number(p.sources?.[key])||0,part=p.botStarts?count/p.botStarts*100:0;
    const row=node('div','source-row'),top=node('div','source-title'),track=node('div','track'),bar=node('div','track-fill');
    top.append(node('span','',sourceLabels[key]),node('strong','',fmt(count)+' · '+(p.botStarts?percent(count,p.botStarts):'0%')));
    bar.style.width=Math.max(0,Math.min(100,part))+'%';track.append(bar);row.append(top,track);box.append(row);
  }
}
function renderPlatforms(p){
  const values=['instagram','tiktok','telegram'].map(key=>Number(p.byPlatform?.[key])||0);
  const total=values.reduce((a,b)=>a+b,0),circ=2*Math.PI*76;let offset=0;
  ['instagram','tiktok','telegram'].forEach((key,index)=>{
    const element=el('donut-'+key),length=total?values[index]/total*circ:0;
    element.setAttribute('stroke-dasharray',length+' '+Math.max(0,circ-length));
    element.setAttribute('stroke-dashoffset',String(-offset));
    offset+=length;
  });
  number('donut-total',total);
  const container=el('platforms-list');container.replaceChildren();
  for(const [i,key] of ['instagram','tiktok','telegram'].entries()){
    const row=node('div','platform-item'),left=node('span','platform-label'),dot=node('span','platform-dot');
    dot.style.backgroundColor=['#b573f5','#8b82ff','#5fbeff'][i];
    left.append(dot,node('span','',platformLabels[key]));
    const right=node('b','',fmt(values[i]));right.append(node('small','',total?'('+percent(values[i],total)+')':'(0%)'));
    row.append(left,right);container.append(row);
  }
}
function renderFunnel(p){
  const f=p.funnel||{started:0,opened:0,evaluated:0},box=el('funnel-list');box.replaceChildren();
  const rows=[['Запустили бота',f.started],['Открыли Mini App после /start',f.opened],['Завершили оценку',f.evaluated]];
  for(const [label,count] of rows){
    const row=node('div','funnel-row'),top=node('div','funnel-top'),track=node('div','funnel-track'),bar=node('div','funnel-fill');
    top.append(node('span','',label),node('strong','',fmt(count)));
    bar.style.width=(f.started?Math.min(100,count/f.started*100):0)+'%';
    bar.textContent=f.started?percent(count,f.started):'0%';
    track.append(bar);row.append(top,track);box.append(row);
  }
}
function drawChart(data){
  const svg=el('activity-chart');svg.replaceChildren();
  const metric=state.chartMetric,values=data.map(x=>Math.max(0,Number(x[metric])||0));
  const max=Math.max(1,...values);const scaleMax=Math.max(1,Math.ceil(max*1.16));
  const left=47,right=911,top=25,bottom=211,width=right-left,height=bottom-top;
  const atX=i=>left+(data.length===1?0:i/(data.length-1))*width;
  const atY=v=>bottom-v/scaleMax*height;
  const defs=svgNode('defs'),gradient=svgNode('linearGradient',{id:'chart-fill',x1:'0',y1:'0',x2:'0',y2:'1'});
  gradient.append(svgNode('stop',{offset:'0%','stop-color':'#a879ee','stop-opacity':'.26'}),svgNode('stop',{offset:'100%','stop-color':'#a879ee','stop-opacity':'0'}));
  defs.append(gradient);svg.append(defs);
  for(let t=0;t<=4;t++){
    const y=bottom-t/4*height;
    svg.append(svgNode('line',{x1:left,x2:right,y1:y,y2:y,class:'gridline'}));
    const label=svgNode('text',{x:39,y:y+4,'text-anchor':'end',class:'axis-label'});
    label.textContent=fmt(Math.round(scaleMax*t/4));svg.append(label);
  }
  if(!data.length){el('chart-hint').textContent='Пока нет данных по дням';return}
  const points=data.map((row,i)=>[atX(i),atY(values[i])]);
  const path=points.map(([x,y],i)=>(i?'L':'M')+x.toFixed(2)+','+y.toFixed(2)).join(' ');
  const area=svgNode('path',{d:path+' L'+points.at(-1)[0]+','+bottom+' L'+points[0][0]+','+bottom+' Z',class:'area'});
  svg.append(area,svgNode('path',{d:path,class:'chart-line'}));
  const hint=el('chart-hint');
  points.forEach(([x,y],i)=>{
    const dot=svgNode('circle',{cx:x,cy:y,r:'4.6',class:'dot'});
    const target=svgNode('rect',{x:x-13,y:top,width:26,height:bottom-top,class:'hitbox',tabindex:'0',role:'button','aria-label':data[i].day+': '+fmt(values[i])});
    const focus=()=>{hint.textContent=dateUTC(data[i].day)+' · '+(metric==='valuations'?'Оценки':metric==='appOpens'?'Открытия':'Запуски')+': '+fmt(values[i]);};
    target.addEventListener('focus',focus);target.addEventListener('mouseenter',focus);
    target.addEventListener('mouseleave',()=>{hint.textContent='Наведите на точку, чтобы увидеть значение';});
    svg.append(dot,target);
  });
  el('chart-first-day').textContent=dateUTC(data[0].day);
  el('chart-last-day').textContent=dateUTC(data.at(-1).day);
}
function renderEvents(){
  const box=el('events-list');box.replaceChildren();
  const cutoff=series()[0]?.day;
  const all=(state.stats.recentEvents||[]).filter(x=>
    (state.eventFilter==='all'||x.type===state.eventFilter)&&(!cutoff||x.time.slice(0,10)>=cutoff));
  if(!all.length){box.append(node('div','empty','За выбранный период событий этого типа нет.'));return}
  for(const e of all.slice(0,12)){
    const row=node('div','event-row'),badge=node('span','event-icon'+(e.type==='estimate_success'?' success':'')),
    info=node('div','event-content'),name=eventLabels[e.type]||['Событие','i-info'];
    badge.append(svgIcon(name[1]));
    info.append(node('strong','',name[0]),node('small','',e.type==='estimate_success'?platformLabels[e.platform]||'Платформа':e.type==='bot_start'?sourceLabels[e.source]||'Источник':'Telegram'));
    const t=new Date(e.time),time=node('span','event-time',Number.isFinite(t.getTime())?t.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—');
    row.append(badge,info,time);box.append(row);
  }
}
function render(){
  const p=periodData();if(!p)return;
  const d=new Date(state.stats.asOf);
  el('updated').textContent='Обновлено '+(Number.isFinite(d.getTime())?d.toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}):'—');
  const limited=Boolean(state.stats.eventsTruncated||state.stats.registeredUsersTruncated);
  el('data-alert').hidden=!limited;
  el('data-alert-text').textContent=limited?'Достигнут лимит чтения хранилища. Часть показателей может быть неполной. Увеличьте лимиты аналитики.':'';
  el('health-completeness').textContent=limited?'Неполная выборка':'Без превышения лимита';
  el('health-completeness').classList.toggle('health-ok',!limited);
  renderKpi(p);drawChart(series());renderPlatforms(p);renderSources(p);renderFunnel(p);renderEvents();
}
function exportCsv(){
  if(!state.stats)return;
  const rows=[['Дата (UTC)','Новые регистрации','Запуски бота','Открытия Mini App','Успешные оценки','Уникальные пользователи','Instagram','TikTok','Telegram']];
  series().forEach(s=>rows.push([s.day,s.registrations,s.botStarts,s.appOpens,s.valuations,s.uniqueUsers,s.instagram,s.tiktok,s.telegram]));
  const clean=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+\-@\t\r]/,'\u0027$&')+'"';
  const csv='\ufeff'+rows.map(r=>r.map(clean).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const anchor=node('a');anchor.href=url;anchor.download='valuation-ai-analytics-'+state.period+'d-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function menu(open){el('shell').classList.toggle('menu-open',open);el('menu-toggle').setAttribute('aria-expanded',String(open));el('sidebar-backdrop').hidden=!open}
el('menu-toggle').addEventListener('click',()=>menu(!el('shell').classList.contains('menu-open')));
el('sidebar-backdrop').addEventListener('click',()=>menu(false));
document.querySelectorAll('.nav-link').forEach(link=>link.addEventListener('click',()=>{
  document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('is-active',a===link));menu(false);
}));
el('period').addEventListener('change',e=>{state.period=Number(e.target.value)||14;if(state.stats)render()});
document.querySelectorAll('[data-chart]').forEach(b=>b.addEventListener('click',()=>{
  state.chartMetric=b.dataset.chart;
  document.querySelectorAll('[data-chart]').forEach(x=>x.classList.toggle('is-selected',x===b));
  if(state.stats)drawChart(series());
}));
el('event-filter').addEventListener('change',e=>{state.eventFilter=e.target.value;if(state.stats)renderEvents()});
el('refresh-btn').addEventListener('click',getStats);
el('export-btn').addEventListener('click',exportCsv);
el('login-form').addEventListener('submit',async event=>{
  event.preventDefault();if(state.busy)return;
  const code=el('login-code').value.trim();el('login-error').hidden=true;
  if(!code){el('login-error').textContent='Введите код из Telegram.';el('login-error').hidden=false;return}
  setBusy(true);
  try{
    const response=await fetch('/api/admin-login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({code})});
    if(!response.ok){if(response.status===401)throw Error('Код неверный, просрочен или уже использован. Запросите новый через /stats.');throw Error('Ошибка входа (HTTP '+response.status+').')}
    el('login-code').value='';state.signedInitData='';
  }catch(e){el('login-error').textContent=String(e.message||e);el('login-error').hidden=false;setBusy(false);return}
  setBusy(false);await getStats();
});
el('logout-btn').addEventListener('click',async()=>{
  try{await fetch('/api/admin-login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})})}catch{}
  state.stats=null;showLogin('Сессия завершена. Для нового входа запросите код через /stats.');
});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape')menu(false);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='r'&&state.stats){e.preventDefault();getStats()}
});
getStats();
