import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const viewport=readFileSync(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/TrueLightingPreview.tsx',import.meta.url),'utf8');
const navigation=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
test('expanding True Lighting requests pointer lock on BSP canvas from button click',()=>{
 assert.match(panel,/const toggleExpanded=\(\)=>\{/);
 assert.match(panel,/onClick=\{toggleExpanded\}/);
 assert.match(panel,/canvas\.requestPointerLock\(\)/);
 assert.match(panel,/setFly\(true\)/);
});
test('reducing releases preview pointer lock and disables its free camera',()=>{
 assert.match(panel,/if\(layout==='full'\)\{[\s\S]*?document\.exitPointerLock\?\.\(\);[\s\S]*?setFly\(false\);/);
});
test('editor MAP keyboard and frame movement cannot run while lighting occupies viewport',()=>{
 assert.match(app,/if\(document\.querySelector\('\.true-light-workbench\.true-light-full'\)\)return;/);
 assert.equal((viewport.match(/if\(document\.querySelector\('\.true-light-workbench\.true-light-full'\)\)\{keys\.current\.clear\(\);return;\}/g)||[]).length,2);
});
test('BSP fly camera uses locked canvas and WASD/QE rather than editor camera',()=>{
 assert.match(navigation,/if\(!fly\|\|document\.pointerLockElement!==gl\.domElement\)return;/);
 assert.match(navigation,/bspFlyAxes\(keys\.current\)/);
});
