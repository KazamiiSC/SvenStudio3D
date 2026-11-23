import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBrush,transformedVertices} from '../src/engine/geometry.ts';
import {validateBrush} from '../src/engine/exportMap.ts';
import {buildSpiralStairs,defaultSpiralStairs,planScatterAround,scatterSpots,defaultScatter,clipBrushesByPlane,analyzePlayerClearance,seededRandom} from '../src/engine/mapTools24.ts';
import {createRockCluster} from '../src/engine/terrain.ts';
import {createArchitecture} from '../src/engine/architecture.ts';
import {planScatterOnArea} from '../src/engine/mapTools24.ts';
import {visibleMarkerIds,normalizeMapLabelSettings} from '../src/engine/mapEntityLabels.ts';

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const box=(center,size,name='b')=>({...createBrush('box',center,size,name),name});
const zs=b=>transformedVertices(b).map(p=>p[2]);

test('spiral stairs: one valid convex brush per step, rising by the step height, plus the column',()=>{
  const steps=buildSpiralStairs({...defaultSpiralStairs,steps:12,stepHeight:16,column:true});
  assert.equal(steps.length,13);
  for(const b of steps)assert.deepEqual(validateBrush(b),[],b.name);
  assert.equal(Math.max(...zs(steps[0])),16);
  assert.equal(Math.max(...zs(steps[11])),192);
  const solid=buildSpiralStairs({...defaultSpiralStairs,steps:4,solid:true,column:false,innerRadius:0});
  assert.equal(solid.length,4);
  for(const b of solid){assert.deepEqual(validateBrush(b),[]);assert.equal(Math.min(...zs(b)),0);}
  assert.throws(()=>buildSpiralStairs({...defaultSpiralStairs,outerRadius:20}),/Outer radius/);
});

test('World Builder rocks: classic, jagged and ring layouts stay valid and deterministic',()=>{
  const base={origin:[0,0,0],count:8,radius:192,height:96,seed:7,texture:'ROCK1'};
  const classic=createRockCluster(base),jagged=createRockCluster({...base,roughness:.7}),again=createRockCluster({...base,roughness:.7});
  for(const r of [...classic,...jagged])assert.deepEqual(validateBrush(r),[],r.name);
  assert.deepEqual(jagged.map(r=>r.vertices),again.map(r=>r.vertices));
  const ring=createRockCluster({...base,layout:'ring',count:12,radius:300});
  assert.equal(ring.length,12);
  for(const r of ring){const v=transformedVertices(r),cx=v.reduce((s,p)=>s+p[0],0)/v.length,cy=v.reduce((s,p)=>s+p[1],0)/v.length;assert.ok(Math.hypot(cx,cy)>200,'ring rocks sit on the circle');}
  assert.ok(seededRandom(1)()!==seededRandom(2)());
});

test('scatter around a click: spacing, ids and copies standing on the floor below (terrain too)',()=>{
  const low=box([-256,0,-8],[512,1024,16],'low floor'),high=box([256,0,24],[512,1024,48],'high floor');
  const zombie={id:'z',kind:'entity',name:'z',classname:'monster_zombie',position:[0,0,500],props:{classname:'monster_zombie',targetname:'boss'}};
  const crate=box([0,0,600],[32,32,32],'crate');
  const project={version:1,name:'s',objects:[low,high,zombie,crate],world:{},wadNames:[]};
  const opts={...defaultScatter,count:30,radius:400,minSpacing:56,seed:4};
  const out=planScatterAround(project,[zombie,crate],[0,0,0],opts);
  assert.ok(out.length>=15);
  assert.equal(new Set(out.map(o=>o.id)).size,out.length);
  for(const o of out){
    const x=o.kind==='entity'?o.position[0]:transformedVertices(o).reduce((s,p)=>s+p[0]/8,0);
    const floor=x<0?0:48;
    if(o.kind==='entity'){assert.equal(o.position[2],floor+1);assert.equal(o.props.targetname,undefined);}
    else{assert.ok(Math.abs(Math.min(...zs(o))-floor)<.01,`brush on floor ${floor}`);assert.deepEqual(validateBrush(o),[]);}
  }
  const spots=scatterSpots(opts);
  for(let i=0;i<spots.length;i++)for(let j=i+1;j<spots.length;j++)assert.ok(Math.hypot(spots[i][0]-spots[j][0],spots[i][1]-spots[j][1])>=56);
  assert.throws(()=>planScatterAround(project,[],[0,0,0],opts),/Select the objects/);
});
test('free clip: a diagonal plane splits a box into two valid pieces; misses are reported',()=>{
  const b=box([0,0,0],[128,128,128]);
  const parts=clipBrushesByPlane([b],[0,0,0],[1,1,0],'both').get(b.id);
  assert.equal(parts.length,2);
  for(const p of parts)assert.deepEqual(validateBrush(p),[]);
  const front=clipBrushesByPlane([b],[0,0,0],[0,0,1],'front').get(b.id);
  assert.equal(front.length,1);assert.equal(Math.min(...zs(front[0])),0);
  assert.throws(()=>clipBrushesByPlane([b],[500,0,0],[1,0,0],'both'),/does not cross/);
});

test('player-size check finds narrow gaps, low ceilings and high steps in a sealed box',()=>{
  const objects=[
    box([0,0,-8],[1024,512,16],'floor'),box([0,0,264],[1024,512,16],'roof'),
    box([0,-264,128],[1024,16,272],'wall s'),box([0,264,128],[1024,16,272],'wall n'),
    box([-520,0,128],[16,512,272],'wall w'),box([520,0,128],[16,512,272],'wall e'),
    // A divider with a 16u slot: too narrow.
    box([-200,-132,128],[16,248,256],'divider a'),box([-200,132,128],[16,248,256],'divider b'),
    // Low ceiling (48u free) over one strip: crouch only.
    box([200,0,152],[128,496,208],'low ceiling'),
    // A 30u block: needs a jump.
    box([400,0,15],[64,64,30],'block')
  ];
  const report=analyzePlayerClearance({version:1,name:'t',objects,world:{},wadNames:[]});
  const kinds=new Set(report.issues.map(i=>i.kind));
  assert.ok(kinds.has('narrow'),'narrow slot found');
  assert.ok(kinds.has('crouch'),'crouch strip found');
  assert.ok(kinds.has('jump'),'30u block needs a jump');
  assert.ok(report.floors>0);
  assert.deepEqual(analyzePlayerClearance({version:1,name:'e',objects:[],world:{},wadNames:[]}).issues,[]);
});

test('entity markers honour distance and count limits; selected ones always stay',()=>{
  const entries=[{id:'a',distanceSquared:100,selected:false},{id:'b',distanceSquared:1e7,selected:false},{id:'c',distanceSquared:9e8,selected:true},{id:'d',distanceSquared:400,selected:false}];
  assert.deepEqual([...visibleMarkerIds(entries,3000,600)].sort(),['a','c','d']);
  assert.deepEqual([...visibleMarkerIds(entries,0,1)].sort(),['a','c']);
  assert.deepEqual([...visibleMarkerIds(entries,0,5000)].sort(),['a','b','c','d']);
  const s=normalizeMapLabelSettings({});assert.equal(s.markerDistance,6000);assert.equal(s.maxMarkers,600);
  assert.equal(normalizeMapLabelSettings({markerDistance:0}).markerDistance,0);
  const viewport=read('src/components/Viewport.tsx');
  assert.match(viewport,/<EntityMarkerCuller\/>/);
  assert.match(viewport,/<group ref=\{markerRef\}>/);
});

test('UI wiring: tools live in their studios (World Builder, Map Doctor), no loose dialogs',()=>{
  const app=read('src/App.tsx');
  assert.doesNotMatch(app,/openMapTool\(/,'no loose tool entries in the Studios menu');
  const wb=read('src/components/TerrainShapeStudio.tsx');
  assert.match(wb,/setTab\('scatter'\)/);
  assert.doesNotMatch(wb,/setTab\('stairs'\)/,'spiral stairs live in Smart Build now (one place for all stairs)');
  assert.match(wb,/startTerrainPlacement\(\{kind:'scatter'/);
  assert.match(wb,/layout:rockLayout,roughness:rockRoughness/);
  assert.match(read('src/components/MapDoctor.tsx'),/openMapTool\('player'\)/);
  assert.match(read('src/app/RibbonToolGroups.tsx'),/setFreeClipMode/);
  assert.match(read('src/components/OrthoViews.tsx'),/ortho-clip-bar/);
  const panels=read('src/components/Panels.tsx');
  for(const action of ['assignLayer','toggleLayerLocked','renameLayer','isolateLayer'])assert.match(panels,new RegExp(action));
});
test('Smart Build structures: live 3D preview, click placement with ghost, translated texts',()=>{
  const panel=read('src/components/ArchitectureBuilder.tsx');
  assert.match(panel,/<BrushPreview brushes=\{preview\.brushes\}/);
  assert.match(panel,/startTerrainPlacement\(\{kind:'structure'/);
  assert.doesNotMatch(panel,/[áéíóúñ¿]/,'no hard-coded Spanish left');
  assert.match(read('src/store.ts'),/s\.buildArchitecture\(request\.structure\.kind,request\.structure\.options,origin\)/);
  assert.match(read('src/components/viewport/ClickPlacement.tsx'),/request\.kind==='structure'&&request\.structure\?createArchitecture/);
});

test('all stairs in one place: spiral stairs are a Smart Build structure next to straight and landing stairs',()=>{
  const opts={width:96,height:256,depth:24,frame:16,steps:16,cutOnly:false,doorLeaf:false,innerRadius:32,turn:360,column:true};
  const brushes=createArchitecture('spiralStairs',opts,null,'SV_BRICK01',undefined,[100,0,64]).objects;
  assert.equal(brushes.length,17);
  for(const b of brushes)assert.deepEqual(validateBrush(b),[]);
  assert.equal(Math.min(...brushes.flatMap(zs)),64,'starts on the floor point');
  const panel=read('src/components/ArchitectureBuilder.tsx');
  assert.match(panel,/'stairs','landingStairs','spiralStairs'/);
});

test('scatter over chosen area brushes follows their top surface',()=>{
  const low=box([-256,0,-8],[512,512,16],'low'),high=box([256,0,24],[512,512,48],'high'),other=box([0,2000,500],[64,64,64],'elsewhere');
  const lamp={id:'l',kind:'entity',name:'l',classname:'light',position:[0,0,0],props:{classname:'light'}};
  const project={version:1,name:'a',objects:[low,high,other,lamp],world:{},wadNames:[]};
  const out=planScatterOnArea(project,[lamp],[low.id,high.id],{count:20,seed:2,minSpacing:40,randomYaw:false,radius:256});
  assert.ok(out.length>=10);
  for(const o of out){assert.ok(Math.abs(o.position[1])<=256);assert.equal(o.position[2],(o.position[0]<0?0:48)+1);}
  assert.throws(()=>planScatterOnArea(project,[lamp],[],{count:3,seed:1,minSpacing:0,randomYaw:false,radius:256}),/area brushes/);
});

test('curves panel previews in 3D and picks the arc centre in the map; player check re-scans itself',()=>{
  const curves=read('src/components/CurvedGeometryPanel.tsx');
  assert.match(curves,/<BrushPreview height=\{312\}/);
  assert.match(curves,/startTerrainPlacement\(\{kind:'radial'/);
  assert.match(read('src/store.ts'),/s\.radialArraySelected\(\{\.\.\.request\.radial,origin\}\)/);
  assert.match(read('src/components/MapToolsDialogs.tsx'),/Scan again automatically after each change/);
});
test('3D entity models: all shown by default, optional distance, culled apart from markers, shared GPU data',()=>{
  const v=read('src/components/Viewport.tsx');
  assert.doesNotMatch(v,/activeModels\.has\(obj\.id\)/,'no nearest-N model budget');
  assert.match(v,/<group ref=\{modelRef\}>/);
  assert.match(v,/modelDisplay==='near'\?modelDistance\*modelDistance:Infinity/);
  assert.match(read('src/layout.ts'),/modelDisplay:'all' as 'all'\|'near',modelDistance:4000/);
  assert.match(read('src/components/ModelBrowser.tsx'),/function acquireShared\(/);
  assert.match(read('src/components/DockWorkspace.tsx'),/setModelDisplay/);
});

test('Gameplay Studio v2.5 engine: floors, activation chain, logic layout and spatial picking',async()=>{
  const {detectFloors,gameplayChain,layoutLogicGraph,PointGrid,outlineSegments}=await import('../src/engine/gameplayMapGL.ts');
  const ent=(id,z)=>({id,kind:'entity',name:id,classname:'info_target',position:[0,0,z],props:{}});
  const floors=detectFloors([...[0,8,16,20,4].map((z,i)=>ent('a'+i,z)),...[300,310,320,305].map((z,i)=>ent('b'+i,z)),ent('lamp',600)]);
  assert.equal(floors.length,2,'a single lamp joins the closest floor instead of creating one');
  const links=[{from:'btn',to:'relay',via:'target'},{from:'relay',to:'door',via:'target'},{from:'door',to:'relay',via:'target'},{from:'other',to:'x',via:'target'}];
  const chain=gameplayChain(links,'relay');
  assert.deepEqual([...chain.nodes].sort(),['btn','door','relay']);
  assert.ok(!chain.nodes.has('other'));
  const pos=layoutLogicGraph(['btn','relay','door'],links);
  assert.ok(pos.get('btn')[0]<pos.get('relay')[0]&&pos.get('relay')[0]<pos.get('door')[0],'left to right even with a cycle');
  const grid=new PointGrid(Float32Array.from([0,100,1000]),Float32Array.from([0,0,0]),64);
  assert.deepEqual(grid.query(5,0,20),[0]);
  assert.equal(outlineSegments([{id:'b',zMin:0,zMax:1,polygon:[[0,0],[10,0],[10,10]],bounds:{minX:0,maxX:10,minY:0,maxY:10}}]).length,12);
  const studio=read('src/components/GameplayStudio.tsx');
  assert.match(studio,/new THREE\.WebGLRenderer/);
  assert.match(studio,/page==='logic'/);
  assert.match(read('src/App.tsx'),/viewportPaused:covering/);
});
