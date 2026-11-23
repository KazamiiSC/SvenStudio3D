/** Mathematical regression checks for root viewport dimensions. Browser screenshot is still required. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
assert.match(app,/width:`\$\{100\/uiScale\}vw`/);
assert.match(app,/height:`\$\{100\/uiScale\}vh`/);
assert.doesNotMatch(app,/width:`\$\{100\/uiScale\}%`/);
for(const scale of [.8,.85,.9,.95,1,1.05,1.1,1.15,1.2]){
  for(const [vw,vh] of [[1280,720],[1650,900],[1920,1080],[2560,1440]]){
    const logicalWidth=vw/scale;
    const logicalHeight=vh/scale;
    assert.ok(Math.abs(logicalWidth*scale-vw)<.001);
    assert.ok(Math.abs(logicalHeight*scale-vh)<.001);
  }
}
console.log('PASS: viewport-unit compensation math for 80%-120% at four screen sizes.');
