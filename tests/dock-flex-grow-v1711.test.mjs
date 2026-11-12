import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizedDockFlexGrows} from '../src/engine/dockFlex.ts';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);

test('sole properties pane with saved weight .864242 takes the entire zone',()=>{
  const result=normalizedDockFlexGrows(['properties'],{properties:.864242});
  close(result.properties,1);
});
test('two visible panels share 100% with their saved relative proportions',()=>{
  const result=normalizedDockFlexGrows(['assets','properties'],{assets:.3,properties:.45});
  close(result.assets,.4);
  close(result.properties,.6);
  close(result.assets+result.properties,1);
});
test('moving or hiding a panel renormalizes the remaining visible panels',()=>{
  const weights={assets:.25,properties:.35,explorer:.40};
  close(normalizedDockFlexGrows(['properties'],weights).properties,1);
  const result=normalizedDockFlexGrows(['properties','explorer'],weights);
  close(result.properties+result.explorer,1);
  close(result.properties,.35/.75);
});
test('invalid old weights cannot leave a blank dock area',()=>{
  const result=normalizedDockFlexGrows(['assets','properties'],{assets:NaN,properties:0});
  close(result.assets,.5);
  close(result.properties,.5);
  assert.deepEqual(normalizedDockFlexGrows([],{assets:1}),{});
});
test('DockWorkspace uses normalized growth for all sides',()=>{
  const source=readFileSync(new URL('../src/components/DockWorkspace.tsx',import.meta.url),'utf8');
  assert.match(source,/normalizedDockFlexGrows\(ids,layout\.weights\)/);
  assert.match(source,/flexGrow:grow\[id\]/);
  assert.doesNotMatch(source,/flexGrow:layout\.weights\[id\]/);
});
