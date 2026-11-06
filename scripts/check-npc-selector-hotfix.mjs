import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
const engine=fs.readFileSync('src/engine/customNpc.ts','utf8');
const npc=fs.readFileSync('src/components/NpcStudio.tsx','utf8');
const importer=fs.readFileSync('src/components/CustomNpcImporter.tsx','utf8');
assert.match(engine,/export const EMPTY_CUSTOM_NPCS:/);
for(const [name,source] of [['NPC Studio',npc],['Custom NPC Importer',importer]]) {
  assert.match(source,/useEditor\(s=>s\.project\.customNpcs\?\?EMPTY_CUSTOM_NPCS\)/,`${name} must use a stable fallback`);
  assert.doesNotMatch(source,/useEditor\(s=>s\.project\.customNpcs\s*(?:\|\||\?\?)\s*\[\]\)/,`${name} must not create a new array in the Zustand selector`);
}
// A stable missing-value fallback must return the same reference on every read.
const empty=Object.freeze([]);
const selector=s=>s.project.customNpcs??empty;
const oldProject={project:{objects:[]}};
assert.strictEqual(selector(oldProject),selector(oldProject));
assert.ok(Object.isFrozen(selector(oldProject)));
const list=[{classname:'custom_gorilla'}];
assert.strictEqual(selector({project:{customNpcs:list}}),list);
assert.notStrictEqual(selector({project:{customNpcs:[]}}),empty);
for(const [name,source] of [['NPC Studio',npc],['Custom NPC Importer',importer]]) {
  const result=ts.transpileModule(source,{fileName:'check.tsx',compilerOptions:{jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.equal(result.diagnostics?.length??0,0,`${name} JSX transpilation`);
}
console.log('PASS React/Zustand selector hotfix in NPC Studio and Custom NPC Importer.');
