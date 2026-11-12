import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectPathGroups} from '../src/engine/pathGroupSelector.ts';

test('missing pathGroups produces a stable snapshot, including legacy projects',()=>{
  const oldProject={version:1,name:'Legacy map',objects:[],wadNames:[],world:{}};
  const first=selectPathGroups(oldProject);
  for(let i=0;i<1000;i++)assert.strictEqual(selectPathGroups(oldProject),first);
  assert.equal(first.length,0);
  assert.ok(Object.isFrozen(first),'do not mutate the shared empty fallback');
});

test('saved path groups retain their original reference and react to updates',()=>{
  const group={id:'route-1'};
  const present=[group];
  const project={pathGroups:present};
  assert.strictEqual(selectPathGroups(project),present);
  assert.strictEqual(selectPathGroups(project),selectPathGroups(project));
  const next=[...present,{id:'route-2'}];
  assert.notStrictEqual(selectPathGroups({...project,pathGroups:next}),present);
  assert.strictEqual(selectPathGroups({...project,pathGroups:next}),next);
  assert.strictEqual(selectPathGroups({pathGroups:undefined}),selectPathGroups({}));
});

test('TerrainShapeStudio subscribes through stable selector (no allocated fallback)',()=>{
  const source=readFileSync(new URL('../src/components/TerrainShapeStudio.tsx',import.meta.url),'utf8');
  assert.match(source,/useEditor\(s=>selectPathGroups\(s\.project\)\)/);
  assert.doesNotMatch(source,/useEditor\(s=>s\.project\.pathGroups\s*\|\|\s*\[\]\)/);
});
