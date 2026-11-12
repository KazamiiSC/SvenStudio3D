import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {planViewBox,planScreenToWorld,planZoomAt,planFitPoints,planPanFromDrag,PLAN_MAX_SPAN,PLAN_MIN_SPAN} from '../src/engine/pathPlanCamera.ts';
const root=path.dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('plan viewBox preserves viewport aspect ratio at wide and tall sizes',()=>{
 for(const size of [{width:1000,height:300},{width:320,height:840},{width:800,height:600}]){
  const box=planViewBox({centerX:120,centerY:-70,spanY:512},size);
  assert.ok(Math.abs(box.width/box.height-size.width/size.height)<1e-9);
 }
});
test('screen-to-world maps center to camera and corners to viewBox boundaries',()=>{
 const cam={centerX:48,centerY:128,spanY:640},size={width:1200,height:600},box=planViewBox(cam,size);
 assert.deepEqual(planScreenToWorld(cam,size,600,300),[48,128]);
 assert.deepEqual(planScreenToWorld(cam,size,0,0),[box.x,box.y]);
});
test('wheel zoom preserves point under the cursor',()=>{
 const cam={centerX:48,centerY:128,spanY:640},size={width:1200,height:600};
 for(const [x,y] of [[0,0],[250,300],[1100,580],[600,300]]){
  const world=planScreenToWorld(cam,size,x,y);
  const zoomed=planZoomAt(cam,size,x,y,0.8);
  const after=planScreenToWorld(zoomed,size,x,y);
  assert.ok(Math.hypot(world[0]-after[0],world[1]-after[1])<1e-8);
 }
});
test('wheel zoom has safe min/max spans',()=>{
 const cam={centerX:0,centerY:0,spanY:300},s={width:1000,height:500};
 assert.equal(planZoomAt(cam,s,500,250,0.00000001).spanY,PLAN_MIN_SPAN);
 assert.equal(planZoomAt(cam,s,500,250,999999999).spanY,PLAN_MAX_SPAN);
});
test('dragging the map pans world opposite to pointer movement',()=>{
 const cam={centerX:0,centerY:0,spanY:500},s={width:1000,height:500};
 assert.deepEqual(planPanFromDrag(cam,s,100,-50),{centerX:-100,centerY:50,spanY:500});
});
test('fit path includes all control points with profile width padding',()=>{
 const pts=[[-1200,-600],[300,400],[2100,800]],size={width:1230,height:670};
 const cam=planFitPoints(pts,96,size),box=planViewBox(cam,size);
 for(const p of pts){assert.ok(p[0]-96>box.x);assert.ok(p[0]+96<box.x+box.width);assert.ok(p[1]-96>box.y);assert.ok(p[1]+96<box.y+box.height);}
});
test('fit handles empty routes and extremely distant points without invalid dimensions',()=>{
 for(const pts of [[],[[0,0]],[[0,0],[500000,0]]]){
  const cam=planFitPoints(pts,32,{width:850,height:400});
  assert.ok(Number.isFinite(cam.centerX)&&Number.isFinite(cam.centerY)&&cam.spanY>0);
 }
});
test('route editor uses map click placement, not immediate origin insertion',()=>{
 const source=read('src/components/TerrainShapeStudio.tsx');
 assert.match(source,/tab==='paths'&&!pathView3D\?<PathPlanEditor/);
 assert.doesNotMatch(source,/tab==='paths'\?applyPath:applyRocks/);
 assert.match(source,/startTerrainPlacement\(\{kind:'path',draft,path:pathOptions\}\)/);
 assert.match(source,/tab==='terrain'&&record&&<button/);
});
test('controls include enlarging, focus and history',()=>{
 const source=read('src/components/TerrainShapeStudio.tsx');
 for(const snippet of ['setExpandedStudio','setFocusRoute','setExpandedElevation','onClick={undoPath}','onClick={redoPath}'])assert.ok(source.includes(snippet),snippet);
});
test('six locales have main route navigation controls',()=>{
 const source=read('src/i18n.ts');
 for(const locale of ['es','ru','ko','zh','pt'])assert.match(source,new RegExp('Object\\.assign\\('+locale+', \\{[^;]*"Fit route"'));
 assert.match(source,/export type Locale = 'es'\|'en'\|'ru'\|'ko'\|'zh'\|'pt'/);
});
