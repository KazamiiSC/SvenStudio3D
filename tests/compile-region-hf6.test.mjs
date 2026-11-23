import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBrush} from '../src/engine/geometry.ts';
import {exportMap,validateProject} from '../src/engine/exportMap.ts';
import {buildRegionProject,regionFromObjects,regionMapName,regionSealTexture,sealingBrushes,validRegion} from '../src/engine/compileRegion.ts';
import {planTextureReplace,textureUsage,validTextureName} from '../src/engine/textureReplace.ts';

const box=(id,pos,size,texture='CRETE1')=>{const b=createBrush('box',pos,size,id);return {...b,id,faces:b.faces.map(f=>({...f,texture}))};};
const entity=(id,classname,position,extra={})=>({id,kind:'entity',name:id,classname,position,props:{},layer:'Gameplay',...extra});
const project=()=>({version:1,name:'t',world:{classname:'worldspawn',mapversion:'220'},wadNames:[],objects:[
  box('roomA',[0,0,-8],[512,512,16]),box('roomB',[4096,0,-8],[512,512,16],'BRICK'),
  entity('spawnA','info_player_start',[0,0,40]),entity('lightB','light',[4096,0,64]),
  entity('door','func_door',[4096,200,0]),{...box('doorBrush',[4096,200,64],[64,16,128],'DOOR1'),entityId:'door'}
]});

test('region from selection is padded, snapped to 16 and at least 64 units',()=>{
  const r=regionFromObjects(project().objects,['spawnA']);
  assert.ok(validRegion(r));
  assert.ok(r.min.every(v=>v%16===0)&&r.max.every(v=>v%16===0));
  assert.ok(r.min[0]<=-64&&r.max[0]>=64);
  assert.equal(regionFromObjects(project().objects,[]),null);
});

test('region build keeps only what touches the box, seals it and exports a valid MAP',()=>{
  const p=project();
  const r=regionFromObjects(p.objects,['roomA']);
  const build=buildRegionProject(p,r,regionSealTexture(p,[]));
  const ids=build.project.objects.map(o=>o.id);
  assert.ok(ids.includes('roomA')&&ids.includes('spawnA'));
  assert.ok(!ids.includes('roomB')&&!ids.includes('lightB')&&!ids.includes('door')&&!ids.includes('doorBrush'));
  assert.equal(ids.filter(id=>id.startsWith('region-seal-')).length,6);
  assert.equal(build.spawnInside,true);
  assert.equal(build.sealTexture,'CRETE1','falls back to the most used texture when SKY is not loaded');
  assert.deepEqual(validateProject(build.project),[]);
  const map=exportMap(build.project,[]);
  assert.equal((map.match(/^\{/gm)||[]).length>=1,true);
  // The editable project itself is untouched.
  assert.equal(p.objects.length,6);
});

test('brush entities come along with their brushes; SKY seals when loaded',()=>{
  const p=project();
  const r=regionFromObjects(p.objects,['doorBrush']);
  const build=buildRegionProject(p,r,regionSealTexture(p,['sky','CRETE1']));
  const ids=build.project.objects.map(o=>o.id);
  assert.ok(ids.includes('door')&&ids.includes('doorBrush'));
  assert.equal(build.sealTexture,'sky');
  assert.equal(build.spawnInside,false);
});

test('sealing shell encloses the region on all six sides without gaps',()=>{
  const r={min:[0,0,0],max:[256,128,64]};
  const seals=sealingBrushes(r,'sky');
  const bounds=seals.map(b=>{const xs=b.vertices.map(v=>v[0]+b.position[0]),ys=b.vertices.map(v=>v[1]+b.position[1]),zs=b.vertices.map(v=>v[2]+b.position[2]);return {min:[Math.min(...xs),Math.min(...ys),Math.min(...zs)],max:[Math.max(...xs),Math.max(...ys),Math.max(...zs)]};});
  for(const b of bounds)for(let i=0;i<3;i++){assert.ok(b.min[i]<=r.min[i]||b.max[i]<=r.min[i]||b.min[i]>=r.max[i]);}
  assert.ok(bounds.some(b=>b.max[0]===0)&&bounds.some(b=>b.min[0]===256));
  assert.ok(bounds.some(b=>b.max[2]===0)&&bounds.some(b=>b.min[2]===64));
});

test('region builds use <map>_region and never exceed the 64-character map name limit',()=>{
  assert.equal(regionMapName('de_test'),'de_test_region');
  assert.equal(regionMapName('de_test_region'),'de_test_region');
  assert.throws(()=>regionMapName('a'.repeat(60)));
});

test('texture planner: case-insensitive, contains mode, usage report',()=>{
  const p=project();
  assert.equal(planTextureReplace(p.objects,{find:'crete1',replace:'NEW'}).faces,6);
  assert.equal(planTextureReplace(p.objects,{find:'R',replace:'NEW',match:'contains'}).faces,18,'CRETE1, BRICK and DOOR1 all contain R');
  assert.equal(planTextureReplace(p.objects,{find:'RE',replace:'NEW',match:'contains'}).faces,6,'only CRETE1 contains RE');
  assert.equal(textureUsage(p.objects)[0].faces,6);
  assert.ok(validTextureName('{BLUE')&&!validTextureName('two words'));
});

test('compile flow builds <map>_region and skips the CS overview for partial builds',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.match(app,/if\(region\)baseMapName=regionMapName\(settings\.mapName\)/);
  assert.match(app,/await streamCompile\(\{mapName:baseMapName,/);
  assert.match(app,/cs16&&mode==='game'&&!region&&compileSettings\.csOverview!==false\?buildCsOverview/);
});

test('vertex editing (existing tool) previews validity live and no longer blocks with alert()',()=>{
  const viewport=readFileSync(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
  const handles=viewport.slice(viewport.indexOf('function GeometryEditHandles'),viewport.indexOf('function',viewport.indexOf('function GeometryEditHandles')+30));
  assert.match(handles,/onObjectChange=\{updatePreview\}/);
  assert.match(handles,/editBrushVertices\(brush,activeIndices,d\)/);
  assert.doesNotMatch(handles,/window\.alert/);
  assert.match(handles,/className="geometry-edit-notice"/);
});

test('optional model probes answer 204 instead of 400 (clean console)',()=>{
  const server=readFileSync(new URL('../server/index.js',import.meta.url),'utf8');
  const browser=readFileSync(new URL('../src/components/ModelBrowser.tsx',import.meta.url),'utf8');
  assert.match(server,/req\.body\?\.optional===true&&[^\n]*res\.status\(204\)/);
  assert.match(browser,/fetchBinary\(gameDir,source,companionPath,true\)/);
  assert.match(browser,/response\.status===204/);
});
