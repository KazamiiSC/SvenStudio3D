import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveShellScale} from '../src/engine/shellScale.ts';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const app=read('src/App.tsx'),welcome=read('src/components/WelcomeScreen.tsx'),css=read('src/style.css');
test('Home and BSP are always at native 100% independent of Workspace slider',()=>{
  for(const value of [.8,.85,.9,1,1.1,1.2]){
    assert.equal(resolveShellScale(value,true,false),1);
    assert.equal(resolveShellScale(value,false,true),1);
    assert.equal(resolveShellScale(value,true,true),1);
    assert.equal(resolveShellScale(value,false,false),value);
  }
  assert.match(app,/resolveShellScale\(uiScale,welcomeOpen,bspMode\)/);
  assert.match(app,/zoom:shellScale,width:`\$\{100\/shellScale\}vw`/);
});
test('hover hitboxes are stationary, effects animate only pointer-inert child faces',()=>{
  assert.match(welcome,/className="ss-home-tool-face" aria-hidden="true"/);
  assert.match(welcome,/className="ss-home-capability-face" aria-hidden="true"/);
  assert.match(welcome,/className="ss-home-start-face" aria-hidden="true"/);
  assert.match(welcome,/const box=element.getBoundingClientRect\(\)/);
  assert.match(welcome,/const localHandlers=interactive.map/);
  assert.doesNotMatch(welcome,/__ssLocalMove|__ssLocalLeave/);
  assert.match(css,/\.ss-home-parallax \.ss-home-tool-face,[\s\S]*?pointer-events:none!important/);
  assert.match(css,/\.ss-home-parallax \.ss-home-tool\.ss-home-tilt-active \.ss-home-tool-face\{/);
  assert.match(css,/\.ss-home-parallax \.ss-home-start\.ss-home-tilt-active \.ss-home-start-face\{/);
});
