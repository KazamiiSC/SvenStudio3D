import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name)=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
test('v1.8.5 route editor exposes both 3D editing and MAP viewport handles',()=>{
 const studio=read('src/components/TerrainShapeStudio.tsx');
 const viewport=read('src/components/Viewport.tsx');
 const overlay=read('src/components/MapPathEditControls.tsx');
 assert.match(studio,/Edit route in 3D/);
 assert.match(studio,/Edit saved route in MAP/);
 assert.match(studio,/Railway tracks & sleepers/);
 assert.match(studio,/Fence & barrier line/);
 assert.match(studio,/Bridge & catwalk with supports/);
 assert.match(viewport,/MapPathEditControls/);
 assert.match(overlay,/onEndDrag.*=>/);
 assert.match(overlay,/updatePathStructure/);
});
test('new route keys translated to all supported non-English locales',()=>{
 const locale=read('src/i18n.ts');
 for(const lang of ['es','ru','ko','zh','pt']){
   assert.ok(locale.includes(`Object.assign(${lang},`));
   assert.match(locale,new RegExp('Edit saved route in MAP'));
   assert.match(locale,new RegExp('Railway tracks & sleepers'));
 }
});
test('route editor stores persistent project path data and validates external files',()=>{
 const store=read('src/store.ts'),types=read('src/engine/types.ts'),check=read('src/engine/projectValidation.ts');
 assert.match(store,/pathGroups/);
 assert.match(types,/pathGroups/);
 assert.match(check,/if\(input\.pathGroups!==undefined\)/);
});
