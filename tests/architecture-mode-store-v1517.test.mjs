import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('../node_modules/typescript/lib/typescript.js');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(mod,filename)=>{
  const code=ts.transpileModule(readFileSync(filename,'utf8'),{fileName:filename,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,allowImportingTsExtensions:true}});
  mod._compile(code.outputText,filename);
};
const {useEditor}=require('../src/store.ts');
const {useArchitectureMode}=require('../src/architectureModeState.ts');
const {DEFAULT_LAYOUT_OPTIONS}=require('../src/engine/architectureMode.ts');
const {startArchitectureMode,finishArchitectureMode}=require('../src/architectureModeController.ts');
const React=require('../node_modules/react');
const {renderToString}=require('../node_modules/react-dom/server');
const {ArchitectureModePanel}=require('../src/components/ArchitectureModePanel.tsx');

test('real store creates one undoable room and preserves data through Undo/Redo',()=>{
  const before=useEditor.getState().project.objects.length,history=useEditor.getState().history.length;
  const pts=[[0,0],[256,0],[256,256],[0,256]];
  useEditor.getState().addArchitectureLayout('room',pts,DEFAULT_LAYOUT_OPTIONS);
  const s=useEditor.getState();assert.equal(s.project.architectureLayouts.length,1);
  assert.equal(s.history.length,history+1);const count=s.project.objects.length;assert.ok(count>before);
  s.undo();assert.equal(useEditor.getState().project.objects.length,before);
  s.redo();assert.equal(useEditor.getState().project.objects.length,count);
  const rec=useEditor.getState().project.architectureLayouts[0];
  useEditor.getState().editArchitectureLayout(rec.id,[[0,0],[320,0],[320,256],[0,256]],{...rec.options,height:256});
  assert.equal(useEditor.getState().project.architectureLayouts[0].options.height,256);
  useEditor.getState().undo();assert.equal(useEditor.getState().project.architectureLayouts[0].options.height,224);
  useEditor.getState().redo();assert.equal(useEditor.getState().project.architectureLayouts[0].options.height,256);
  useEditor.getState().detachArchitectureLayout(rec.id);
  assert.equal(useEditor.getState().project.architectureLayouts.length,0);
  assert.equal(useEditor.getState().project.objects.length,count);
});

test('controller commits once then resets drawing mode without repeated state changes',()=>{
  startArchitectureMode('walls');
  const mode=useArchitectureMode.getState();
  mode.point([0,0]);mode.point([256,0]);mode.point([256,256]);
  assert.equal(finishArchitectureMode(),true);
  assert.equal(useArchitectureMode.getState().mode,'off');
  assert.equal(finishArchitectureMode(),false);
});

test('Zustand snapshot stays referentially stable when cursor remains on the same snapped point',()=>{
  const mode=useArchitectureMode.getState();mode.start('walls');mode.move([33,80]);
  const snapshot=useArchitectureMode.getState();mode.move([34,79]);
  assert.equal(useArchitectureMode.getState(),snapshot);
  mode.cancel();
});

test('Architecture Mode renders a usable React panel without requiring WebGL',()=>{
  const html=renderToString(React.createElement(ArchitectureModePanel,{onStart:()=>{}}));
  assert.match(html,/Dibujar paredes/);assert.match(html,/Dibujar habitación/);
  assert.match(html,/Architecture Mode/);assert.match(html,/Espesor/);
});
