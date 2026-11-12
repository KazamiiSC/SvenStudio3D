import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const viewport=await readFile(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
const panel=await readFile(new URL('../src/components/ArchitectureModePanel.tsx',import.meta.url),'utf8');
test('architecture top view keeps drawing elevation and the orbit pivot in sync',()=>{
 assert.match(viewport,/if\(action==='top'&&useArchitectureMode\.getState\(\)\.mode!=='off'\)target\.y=useArchitectureMode\.getState\(\)\.options\.baseZ/);
 assert.match(viewport,/dest\.position\.copy\(target\)\.add\(offset\);dest\.lookAt\(target\);lastTarget\.current\.copy\(target\);[\s\S]{0,280}orbit\.target\.copy\(target\)/);
 assert.match(panel,/issueCameraCommand\('top'\)/);
});
test('drawing disables OrbitControls capture and refuses non-finite or off-map corner rays',()=>{
 assert.match(viewport,/const architectureDrawing=useArchitectureMode\(s=>s\.mode!=='off'\)/);
 assert.match(viewport,/enabled=\{!walkMode&&!modal&&!drawMode&&!architectureDrawing&&!uvDragging\}/);
 assert.match(viewport,/enablePan=\{!drawMode&&!architectureDrawing\}/);
 assert.match(viewport,/Number\.isFinite\(world\.x\)&&Number\.isFinite\(world\.z\)/);
 assert.match(viewport,/const p=point\(e\.point\);if\(!p\)return/);
});
