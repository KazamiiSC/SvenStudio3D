import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const source=filename=>readFileSync(new URL('../'+filename,import.meta.url),'utf8');
test('modified TSX files parse without syntax errors',()=>{
 for(const file of ['src/components/Viewport.tsx','src/components/Panels.tsx','src/App.tsx']){
  const parsed=ts.createSourceFile(file,source(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length,0,`${file}: ${parsed.parseDiagnostics.map(d=>d.messageText).join('; ')}`);
 }
});
test('RMB requests pointer lock in fullscreen and windowed mode, then releases on mouseup',()=>{
 const v=source('src/components/Viewport.tsx');
 const part=v.slice(v.indexOf('const down=(event:PointerEvent)=>{',v.indexOf('const allowed=()=>')),v.indexOf('const cancel=()=>{',v.indexOf('const allowed=()=>')));
 assert.ok(part.includes('event.button!==2||!allowed()'));
 assert.ok(part.includes('canvas.requestPointerLock?.()'));
 assert.ok(part.includes('document.exitPointerLock?.()'));
 assert.ok(!part.includes('canvas.setPointerCapture?.('));
 assert.ok(part.includes('if(!rightMouseLook.current&&document.pointerLockElement===canvas)'));
 assert.match(v,/className=\{`viewport-frame \${universalActive\?/);
 assert.ok(v.includes('onContextMenuCapture={e=>{e.preventDefault()}}'));
});
test('Properties scroll is anchored to the dock body and consumes remaining height',()=>{
 const css=source('src/style.css');
 const start=css.indexOf('/* v1.7.10 — One grid');assert.ok(start>0);
 const rules=css.slice(start);
 assert.ok(rules.includes('display:contents!important'));assert.ok(rules.includes('align-self:stretch!important'));
 assert.ok(rules.includes('overflow-y:auto!important'));
 assert.ok(rules.includes('grid-template-rows:max-content minmax(0,1fr)!important'));
 const panel=source('src/components/Panels.tsx');
 assert.ok(panel.includes("propertyRoot.current?.querySelector('.property-scroll')"));
});
