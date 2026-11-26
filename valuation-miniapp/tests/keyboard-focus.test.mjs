import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('platform switching changes selected platform but never automatically focuses the input',()=>{
  const start=app.indexOf('function setPlatform(p){');
  const end=app.indexOf('\nfunction showError',start);
  assert.ok(start>=0&&end>start);
  const code=app.slice(start,end);
  const input={value:'someuser',focused:0,blurred:0,focus(){this.focused++},blur(){this.blurred++}};
  const counter={textContent:''};
  const buttons=['instagram','tiktok','telegram'].map(platform=>({
    dataset:{platform},classList:{toggle(){}},setAttribute(){}
  }));
  const state={platform:'instagram'};
  const sandbox={
    els:{input,error:{hidden:false}},
    state,
    document:{activeElement:input,querySelectorAll:()=>buttons},
    clean:value=>String(value),
    $:id=>id==='counter'?counter:null
  };
  vm.runInNewContext(code+';setPlatform("tiktok");setPlatform("telegram");',sandbox);
  assert.equal(state.platform,'telegram');
  assert.equal(input.focused,0,'no implicit focus or keyboard');
  assert.equal(input.blurred,2,'the keyboard closes even if the input was previously focused');
  assert.equal(counter.textContent,'8/32');
});
test('outside taps dismiss the keyboard, whereas tapping in the input keeps it',()=>{
  const start=app.indexOf('function dismissKeyboardOutsideInput(event){');
  const end=app.indexOf('\nfunction setGlobalActions()',start);
  assert.ok(start>=0&&end>start);
  const source=app.slice(start,end);
  const input={blurred:0,blur(){this.blurred++}};
  const sandbox={els:{input},document:{activeElement:input}};
  vm.runInNewContext(source+';dismissKeyboardOutsideInput({target:els.input});',sandbox);
  assert.equal(input.blurred,0);
  vm.runInNewContext(source+';dismissKeyboardOutsideInput({target:{nodeName:"DIV"}});',sandbox);
  assert.equal(input.blurred,1);
  assert.match(app,/document\.addEventListener\('pointerdown',dismissKeyboardOutsideInput,true\)/);
  assert.match(app,/document\.addEventListener\('touchstart',dismissKeyboardOutsideInput,\{capture:true,passive:true\}\)/);
});
test('no other Mini App action invokes the input keyboard and the field keeps an accessible label',()=>{
  assert.doesNotMatch(app,/els\.input\.focus\(/);
  assert.match(html,/id="username-label" class="field-title"/);
  assert.doesNotMatch(html,/<label for="username"/);
  assert.match(html,/id="username"[^>]*placeholder="username"[^>]*aria-labelledby="username-label"/);
  assert.match(html,/app\.js\?v=10/);
});
test('Russian website valuation inputs use username placeholder on all three platforms',()=>{
  for(const platform of ['instagram','tiktok','telegram']){
    const site=readFileSync(new URL('../../tools/'+platform+'-username-value.html',import.meta.url),'utf8');
    assert.match(site,/class="uv-input"[^>]*placeholder="username" aria-label="Никнейм"/,platform);
    assert.doesNotMatch(site,/placeholder="никнейм"/,platform);
    assert.match(site,new RegExp('https://sovazone.com/tools/'+platform+'-username-value'));
  }
});
