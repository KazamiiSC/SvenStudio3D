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
 const src=read('src/i18n.ts');
 for (const lang of ['es','ru','ko','zh','pt']) {
  const block=src.slice(src.lastIndexOf('Object.assign('+lang+',{'));
  for(const key of ['Compile True Lighting?','Choose compiler before compiling','Compile lighting','MAP changed or compiler settings changed since this bake. Rebuild to update lighting.','Lightmap gain'])
   assert.ok(block.includes(JSON.stringify(key)+':'),lang+' missing '+key);
 }
});
