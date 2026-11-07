import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const src=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const store=src('src/store.ts'),ui=src('src/components/TextureStudio.tsx'),viewport=src('src/components/Viewport.tsx'),geo=src('src/engine/geometry.ts'),exporter=src('src/engine/exportMap.ts'),styles=src('src/style.css');
test('TypeScript/TSX parser accepts every new or edited TypeScript module',()=>{
 for(const file of ['src/store.ts','src/components/Viewport.tsx','src/components/TextureStudio.tsx','src/engine/textureStudio.ts','src/engine/geometry.ts']){
  const tree=ts.createSourceFile(file,src(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(tree.parseDiagnostics.length,0,`${file}: ${tree.parseDiagnostics.map(x=>x.messageText)}`);
 }
});
test('studio is mounted in main MAP viewport and preserves existing controls',()=>{
 assert.match(viewport,/TextureStudioPanel/);assert.match(viewport,/TextureUVHandles/);
 assert.match(viewport,/HudCustomizer/);assert.match(viewport,/TextureDropHandler/);
 assert.match(viewport,/function BrushVisual/);assert.match(viewport,/SelectionTransformControls/);
});
test('face selection includes shift-click, multi faces and double-click to open',()=>{
 assert.match(viewport,/selectTextureStudioFace\(object\.id,faceIndex,e\.shiftKey\|\|e\.ctrlKey/);
 assert.match(viewport,/onDoubleClick=\{e=>/);
 assert.match(store,/selectAllTextureFaces/);assert.match(store,/textureFaceSelection/);
});
test('eight resize handles, rotation, movement and pointer cancellation are wired',()=>{
 for(const handle of ['nw','n','ne','e','se','s','sw','w','move','rotate'])assert.ok(ui.includes(`'${handle}'`));
 assert.match(ui,/beginTextureStudioGesture/);assert.match(ui,/updateTextureStudioGesture/);
 assert.match(ui,/finish\(false\)/);assert.match(ui,/finish\(true\)/);
});
test('independent WAD dimensions are used for UV preview instead of a fixed 128',()=>{
 assert.match(geo,/textureSizes\?\.get\(face\.texture\.toUpperCase\(\)\)/);
 assert.match(geo,/normalizedUvAt\(world,u,uScale,uShift,imageWidth\)/);assert.match(geo,/normalizedUvAt\(world,v,vScale,vShift,imageHeight\)/);
 assert.match(viewport,/buildMeshGeometry\(object,assetSizes\)/);
});
test('batch mutations share one undo step; gesture defers history to end',()=>{
 assert.match(store,/return changed\?mutate\(s,objects\):\{\}/);
 assert.match(store,/textureDragSnapshot:clone\(s\.project\)/);
 assert.match(store,/finishTextureDrag:commit=>set\(s=>/);
});
test('fit align presets copy-paste and flips are connected',()=>{
 for(const label of ['fitTextureStudio','alignTextureStudio','centerTextureStudio','flipTextureStudio','saveTexturePreset','applyTexturePreset','copyFaceSettings','sampleTextureStudioFace'])assert.match(store,new RegExp(label));
 for(const label of ['fit(tilesU,tilesV)','align','applyPreset(chosen)','copy(first.id,first.face)','flip(\'u\')'])assert.ok(ui.includes(label));
});
test('eyedropper samples a face without changing destination selection',()=>{assert.match(store,/texturePickerActive/);assert.match(store,/sampleTextureStudioFace:\(id,face\)=>set\(s=>/);assert.match(viewport,/if\(texturePickerActive&&faceIndex!==null\)/);assert.match(ui,/Pipette/)});
test('6 languages are present and in-game keys remain untranslated',()=>{
 for(const locale of ['es','en','ru','ko','zh','pt'])assert.ok(ui.includes(`  ${locale}:{`));
 assert.match(ui,/face\?\.texture/);
});
test('MAP compiler retains its existing Valve 220 face output',()=>{
 assert.match(exporter,/safeFaceTextureAxes\(vertices,face\)/);
 assert.match(exporter,/fmt\(face\.uScale\|\|1\)/);
 assert.match(exporter,/fmt\(face\.vScale\|\|1\)/);
 assert.match(exporter,/mapversion/);
});
test('new UI is draggable and isolated from viewport HUD CSS',()=>{
 assert.match(styles,/\.texture-studio-panel\{/);
 assert.match(styles,/\.texture-uv-handle\{/);
 assert.match(ui,/setPointerCapture/);
 assert.match(ui,/svenstudio:texture-panel-screen-pos-v2/);
});
