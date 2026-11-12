import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const explorer=readFileSync(new URL('../src/components/ExplorerOrganized.tsx',import.meta.url),'utf8');

test('Explorer selector keeps the same snapshot on a new/incognito project',()=>{
  assert.match(explorer,/const EMPTY_BRUSH_COMPOSITES:BrushCompositeRecord\[\]=\[\];/);
  const expression=explorer.match(/const composites=useEditor\((s=>s\.project\.brushComposites)\)\?\?EMPTY_BRUSH_COMPOSITES;/)?.[1];
  assert.ok(expression,'Zustand selector must return the project value, not create a new fallback array');
  const select=new Function(`return (${expression})`)();
  const empty={project:{version:1,name:'New Map',objects:[],world:{},wadNames:[]}};
  assert.strictEqual(select(empty),select(empty),'empty project snapshot must be stable across calls');
  assert.strictEqual(select(empty),undefined);
  const composites=[];
  const existing={project:{...empty.project,brushComposites:composites}};
  assert.strictEqual(select(existing),composites);
  assert.strictEqual(select(existing),select(existing),'loaded project snapshot must retain identity');
});

test('Stable fallback is applied outside useEditor, and composite navigation remains available',()=>{
  assert.match(explorer,/const composites=useEditor\(s=>s\.project\.brushComposites\)\?\?EMPTY_BRUSH_COMPOSITES;/);
  assert.match(explorer,/const record=composites\.find\(/);
  assert.doesNotMatch(explorer,/useEditor\(s=>s\.project\.brushComposites\?\?\[\]\)/);
});
