import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const parsed=file=>{
 const kind=file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS;
 const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,kind);
 assert.equal(source.parseDiagnostics.length,0,source.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
};
test('fullscreen requests Escape Keyboard Lock but retains the browser emergency exit',()=>{
 parsed('src/App.tsx');const src=read('src/App.tsx');
 assert.match(src,/requestFullscreen\(\{keyboardLock:'browser'\}/);
 assert.match(src,/keyboard\.lock\(\['Escape'/);
 assert.match(src,/document\.exitFullscreen\(\)/);
 assert.match(src,/Keyboard Lock \(Escape\) unavailable/);
});
test('docked property panel has one scroll area and does not trap embedded guide scroll',()=>{
 parsed('src/components/Panels.tsx');const css=read('src/style.css');
 assert.match(css,/\.dock-pane\[data-pane="properties"\] \.properties>\.property-scroll\s*\{/);
 assert.match(css,/overflow-y:auto!important/);
 assert.match(css,/\.property-scroll \.ea-content\{max-height:none;overflow:visible\}/);
 assert.match(read('src/components/Panels.tsx'),/<FgdLoadControl compact\/>/);
});
test('Gameplay map deselects on background or right click without the native image menu',()=>{
 parsed('src/components/GameplayStudio.tsx');const src=read('src/components/GameplayStudio.tsx');
 assert.match(src,/onContextMenu=\{e=>\{e\.preventDefault\(\)/);
 assert.match(src,/if\(!nearest\)\{setStack\(null\);onClear\(\);return\}/);
 assert.match(src,/onClear=\{clearSelection\}/);
 assert.match(src,/clearSelection=\(\)=>\{setActive\(null\);select\(null\)/);
});
test('Gameplay inspector uses native keyvalues and on-demand help for selected entity only',()=>{
 parsed('src/components/FgdLoadControl.tsx');const src=read('src/components/GameplayStudio.tsx');
 assert.match(src,/<GameplayEntityFields entity=\{current\}/);
 assert.match(src,/<FgdLoadControl compact\/>/);
 assert.match(src,/<option key=\{o\.value\} value=\{o\.value\}/);
 assert.match(src,/field\?\.type==='flags'/);
 assert.match(src,/guide\.steps\.slice\(0,5\)/);
});
test('FGD auto loading coalesces concurrent requests and respects user supplied definitions',async()=>{
 parsed('src/engine/svenFgdLoader.ts');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v174-fgd-'));
 fs.mkdirSync(path.join(dir,'engine'));const file=read('src/engine/svenFgdLoader.ts');
 const out=ts.transpileModule(file,{fileName:'svenFgdLoader.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 assert.equal(out.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length||0,0);
 fs.writeFileSync(path.join(dir,'engine','svenFgdLoader.js'),out.outputText);
 fs.writeFileSync(path.join(dir,'engine','fgd.js'),"exports.parseFgd=(text)=>[{name:text,type:'point',props:{}}];");
 fs.writeFileSync(path.join(dir,'store.js'),"const state={fgdLoaded:false,fgdClasses:[],settings:{gameDir:'C:/test/svencoop'},setFgd(c){this.fgdClasses=c;this.fgdLoaded=true},setSettings(c){Object.assign(this.settings,c)},appendLogs(){}};exports.useEditor={getState:()=>state};exports.state=state;");
 const {ensureSvenCoopFgd,loadSvenCoopFgd}=require(path.join(dir,'engine','svenFgdLoader.js'));
 const {state}=require(path.join(dir,'store.js'));
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return {ok:true,text:async()=>'func_button',json:async()=>({})}};
 try{
  const [first,second]=await Promise.all([loadSvenCoopFgd(state.settings.gameDir),loadSvenCoopFgd(state.settings.gameDir)]);
  assert.equal(calls,1);assert.equal(first[0].name,'func_button');assert.deepEqual(first,second);
  await ensureSvenCoopFgd();assert.equal(state.fgdLoaded,true);assert.equal(state.fgdClasses[0].name,'func_button');
  const manually=[{name:'custom_entity',type:'point',props:{}}];state.fgdClasses=manually;
  await ensureSvenCoopFgd();assert.equal(state.fgdClasses,manually);
 }finally{global.fetch=original;fs.rmSync(dir,{recursive:true,force:true})}
});
