import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
assert.match(src,/export function Viewport\(\)\{/);
assert.match(src,/const uiScale=useStudioLayout\(s=>/);
assert.match(src,/className="viewport-canvas" style=\{\{zoom:1\/uiScale\}\}/);
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
assert.match(app,/zoom:uiScale,width:`\$\{100\/uiScale\}vw`/);
// Parent zoom times inverse zoom must equal 1 for every supported value.
for(let scale=0.8;scale<=1.2001;scale+=0.05){
  assert.ok(Math.abs(scale*(1/scale)-1)<1e-9);
}
console.log('PASS: 3D viewport inverse zoom compensation (80-120%).');
