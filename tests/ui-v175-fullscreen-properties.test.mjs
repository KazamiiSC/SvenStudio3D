import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=(p)=>{const file=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(file.parseDiagnostics.length,0,file.parseDiagnostics.map(d=>d.messageText).join('\n'));return read(p);};
const fakeTarget=()=>{
  const handlers=new Map();return {
    addEventListener:(name,fn)=>{const a=handlers.get(name)||[];a.push(fn);handlers.set(name,a)},
    removeEventListener:(name,fn)=>{handlers.set(name,(handlers.get(name)||[]).filter(h=>h!==fn))},
    fire:(name,event={})=>(handlers.get(name)||[]).forEach(fn=>fn(event)),
    count:(name)=>(handlers.get(name)||[]).length,
  };
};
test('Escape exit uses a single 1500ms hold and short Escape does not exit',async()=>{
 const sourceText=source('src/engine/fullscreenEscapeHold.ts');
 assert.match(sourceText,/FULLSCREEN_ESCAPE_HOLD_MS=1500/);
 const output=ts.transpileModule(sourceText,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(output,{exports,setTimeout,clearTimeout});
 const win=fakeTarget(),doc=fakeTarget();let exits=0;
 doc.fullscreenElement={};doc.exitFullscreen=async()=>{exits++};
 const cleanup=exports.bindFullscreenEscapeHold(doc,win,45);
 win.fire('keydown',{key:'Escape',code:'Escape',repeat:false});
 await new Promise(resolve=>setTimeout(resolve,5));win.fire('keyup',{key:'Escape'});
 await new Promise(resolve=>setTimeout(resolve,60));assert.equal(exits,0,'short Escape must keep fullscreen');
 win.fire('keydown',{key:'Escape',code:'Escape',repeat:false});
 await new Promise(resolve=>setTimeout(resolve,75));assert.equal(exits,1,'long Escape exits once');
 win.fire('keyup',{key:'Escape'});cleanup();
 assert.equal(win.count('keydown'),0);assert.equal(win.count('keyup'),0);
});
test('fullscreen RMB uses real pointer lock and suppresses native menu in viewport',()=>{
 const app=source('src/App.tsx'),view=source('src/components/Viewport.tsx');
 assert.match(app,/bindFullscreenEscapeHold\(document,window\)/);
 assert.match(app,/keyboard\.lock\(\['Escape'/);
 const down=view.slice(view.indexOf('const down=(event:PointerEvent)=>{',view.indexOf('const allowed=()=>')),view.indexOf('const up=(event:PointerEvent)=>{',view.indexOf('const allowed=()=>')));
 assert.match(down,/canvas\.requestPointerLock/);
 assert.doesNotMatch(down,/canvas\.setPointerCapture/);
 assert.doesNotMatch(down,/if\(document\.fullscreenElement\)/);
 assert.match(view,/className=\{`viewport-frame \${universalActive\?/);
 assert.match(view,/onContextMenuCapture=\{e=>\{e\.preventDefault\(\)\}\}/);
 assert.match(view,/canvas\.addEventListener\('pointermove',move,true\)/);
});
test('properties dock scroll extends to the actual pane bottom and resets for selection',()=>{
 const css=read('src/style.css'),panel=source('src/components/Panels.tsx');
 const current=css.slice(css.indexOf('/* v1.7.10 — One grid'));
 assert.match(current,/\.dock-pane\[data-pane="properties"\]>\.dock-pane-body\s*\{[^}]*display:grid!important/s);
 assert.match(current,/\.dock-pane\[data-pane="properties"\]>\.dock-pane-body>\.properties\s*\{[^}]*display:contents!important/s);
 assert.match(current,/\.properties>\.property-scroll\s*\{[^}]*overflow-y:auto!important/s);
 assert.match(current,/grid-template-rows:max-content minmax\(0,1fr\)!important/);
 assert.match(panel,/scroller.scrollTop=0/);
 assert.equal((panel.match(/ref=\{propertyRoot\} className="properties"/g)||[]).length,3);
});
