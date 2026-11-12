import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {entityBehindBrushHit} from '../src/engine/occludedEntitySelection.ts';
import {DEFAULT_ENTITY_APPEARANCE,normalizeEntityAppearance} from '../src/engine/entityAppearance.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=p=>readFileSync(path.join(root,p),'utf8');
const brush={object:{userData:{brushId:'wall'}}};
const light={object:{userData:{entityPickerId:'light-1'}}};
const button={object:{userData:{entityPickerId:'button-1'}}};
test('HF10 X-ray is available by default, existing local settings migrate safely',()=>{
 assert.equal(DEFAULT_ENTITY_APPEARANCE.markerOcclusion,'xray');
 assert.equal(normalizeEntityAppearance({}).markerOcclusion,'xray');
 assert.equal(normalizeEntityAppearance({markerOcclusion:'normal'}).markerOcclusion,'normal');
 assert.equal(normalizeEntityAppearance({markerOcclusion:'xray',markerMode:'uniform'}).markerMode,'uniform');
});
test('normal mode can be saved independently of shape, opacity, labels',()=>{
 const cfg=normalizeEntityAppearance({...DEFAULT_ENTITY_APPEARANCE,markerShape:'cone',markerSize:1.7,markerOcclusion:'normal'});
 assert.equal(cfg.markerOcclusion,'normal');assert.equal(cfg.markerShape,'cone');assert.equal(cfg.markerSize,1.7);
});
test('a brush in front of a marker does not steal the marked entity selection',()=>{
 assert.equal(entityBehindBrushHit([brush,light],id=>id==='light-1'),'light-1');
});
test('multiple marker candidates choose first valid closest entity',()=>{
 assert.equal(entityBehindBrushHit([brush,light,button],id=>id==='button-1'),'button-1');
 assert.equal(entityBehindBrushHit([brush,button,light],()=>true),'button-1');
});
test('locked or hidden or deleted point entities are not selected',()=>{
 assert.equal(entityBehindBrushHit([brush,light],()=>false),null);
});
test('brush intersection alone never takes over selection',()=>{
 assert.equal(entityBehindBrushHit([brush],()=>true),null);
 assert.equal(entityBehindBrushHit([],()=>true),null);
});
test('no accidental selection on non-pickable decorations and preview meshes',()=>{
 const decoration={object:{userData:{entityId:'light-1'}}};
 assert.equal(entityBehindBrushHit([brush,decoration],()=>true),null);
});
test('entity marker ids must be real nonempty strings',()=>{
 assert.equal(entityBehindBrushHit([{object:{userData:{entityPickerId:7}}}],()=>true),null);
 assert.equal(entityBehindBrushHit([{object:{userData:{entityPickerId:''}}}],()=>true),null);
});
test('point markers use depth-ignoring material but do not write geometry',()=>{
 const v=source('src/components/Viewport.tsx');
 assert.match(v,/new THREE\.MeshBasicMaterial\(\{color,transparent:true,opacity:selected\?\.90:\.62,depthTest:false,depthWrite:false/);
 assert.match(v,/userData=\{\{entityId:object\.id,entityPickerId:object\.id\}\}/);
 assert.match(v,/appearance\.markerOcclusion==='xray'/);
});
test('brush-linked entity indicator is pickable as an entity',()=>{
 const v=source('src/components/Viewport.tsx');
 assert.match(v,/userData=\{\{entityPickerId:associatedEntity\.id\}\}/);
 assert.match(v,/selectObject\(associatedEntity\.id/);
});
test('object selection only: UV face editing and architecture keep priority',()=>{
 const v=source('src/components/Viewport.tsx');
 assert.match(v,/!architecturePlacement&&!measureMode&&!faceMode&&geometryMode==='object'&&!texturePickerActive/);
 assert.match(v,/pointerOnSelectedGizmo\(e\)\)return;/);
 assert.match(v,/selectOccludedEntity\(e\.intersections/);
});
test('modal has toggle and explanation in all six languages',()=>{
 const u=source('src/components/EntityAppearanceModal.tsx');
 assert.match(u,/appearance\.markerOcclusion/);assert.match(u,/value="normal"/);assert.match(u,/value="xray"/);
 const l=source('src/i18n.ts');for(const locale of ['es','en','ru','ko','zh','pt'])assert.ok(l.includes(`Object.assign(${locale},{`));
});
test('MAP exporter and BSP viewer are isolated from entity display settings',()=>{
 const exp=source('src/engine/exportMap.ts'),bsp=source('src/components/BspViewer.tsx');
 assert.ok(!exp.includes('markerOcclusion'));assert.ok(!bsp.includes('markerOcclusion'));
});
