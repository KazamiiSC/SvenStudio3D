import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('True Lighting connects controls and build confirmation to locale translator',()=>{
 const ui=read('src/components/TrueLightingPreview.tsx');
 assert.match(ui,/const t=useT\(\)/);
 for(const key of ['Compile True Lighting?','Choose compiler before compiling','Compile lighting','Free camera: WASD move','Rebuild True Lighting','Compiled lighting \/ calibration']){
  assert.ok(ui.includes(key),'Missing localized UI key: '+key);
 }
 assert.match(ui,/t\("Close True Lighting \(reopen from Studios\)"\)/);
});
test('locale dictionaries include Spanish Russian Korean Chinese and Portuguese strings',()=>{
 // v2.3 HF4: translations live in src/locales/<lang>.json.
 for (const lang of ['es','ru','ko','zh','pt']) {
  const dict=JSON.parse(read(`src/locales/${lang}.json`));
  for(const key of ['Compile True Lighting?','Choose compiler before compiling','Compile lighting','MAP changed or compiler settings changed since this bake. Rebuild to update lighting.','Lightmap gain'])
   assert.ok(typeof dict[key]==='string'&&dict[key].length>0,lang+' missing '+key);
 }
});
