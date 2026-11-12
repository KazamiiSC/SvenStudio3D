import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 applySurfacePreset,addEmissiveSurface,setSurfaceSound,generateSurfaceMaterialsTxt,
 inspectSurfaceSounds,materialLookupKey,materialSoundPath,linkSurfaceMaterialFile,
 inspectTextureAnimations,surfaceMaterialDoctor,SURFACE_PRESETS,SURFACE_CODES
} from '../src/engine/materialSurface.ts';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const brush=(id='brush',texture='BRICK')=>({
 id,kind:'brush',name:id,primitive:'box',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],
 vertices:[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
 faces:Array.from({length:6},(_,i)=>({indices:i<2?[0,1,2,3]:[4,5,6,7],texture,uShift:5,uScale:0.5}))
});
const project=(objects=[brush()])=>({version:1,target:'svengine',name:'test',objects,world:{message:'Keep this key'},wadNames:[]});
const opt=(extra={})=>({amount:180,color:[250,200,160],...extra});
test('Surface Studio native presets are limited to documented brush entities',()=>{
 assert.equal(SURFACE_PRESETS.glass.classname,'func_wall');assert.equal(SURFACE_PRESETS.grate.mode,'4');
 assert.equal(SURFACE_PRESETS.water.classname,'func_water');assert.equal(SURFACE_PRESETS.additive.classname,'func_illusionary');
});
test('glass conversion links a world brush to a real func_wall with one undo-ready project change',()=>{
 const original=project();const after=applySurfacePreset(original,['brush'],'glass',opt(),()=> 'entity1');
 assert.equal(original.objects.length,1);assert.equal(after.objects.length,2);
 const b=after.objects.find(o=>o.id==='brush'),entity=after.objects.find(o=>o.id==='entity1');
 assert.equal(b.entityId,'entity1');assert.equal(entity.classname,'func_wall');assert.equal(entity.props.rendermode,'2');
 assert.equal(entity.props.renderamt,'180');assert.equal(entity.props.rendercolor,'250 200 160');
 assert.deepEqual(b.faces,original.objects[0].faces);assert.deepEqual(after.world,original.world);
});
test('multi-brush conversion never groups unrelated brushes inside one entity',()=>{
 let n=0;const result=applySurfacePreset(project([brush('a'),brush('b')]),['a','b'],'glass',opt(),()=>`entity${++n}`);
 assert.equal(result.objects.filter(o=>o.kind==='entity').length,2);
 assert.notEqual(result.objects[0].entityId,result.objects[1].entityId);
});
test('existing solitary matching brush entity is updated without losing user keys',()=>{
 const b={...brush(),entityId:'e'};
 const e={id:'e',kind:'entity',name:'func_wall',classname:'func_wall',position:[3,2,1],props:{targetname:'screen',spawnflags:'4',rendermode:'0'}};
 const p=project([b,e]),result=applySurfacePreset(p,['brush'],'glass',opt({amount:120}),()=>{throw Error('should not generate an ID')});
 assert.equal(result.objects.length,2);assert.equal(result.objects[1].props.targetname,'screen');
 assert.equal(result.objects[1].props.spawnflags,'4');assert.equal(result.objects[1].props.renderamt,'120');
});
test('linked multi-brush entities and incompatible entities are protected',()=>{
 const e={id:'e',kind:'entity',classname:'func_wall',name:'func_wall',position:[0,0,0],props:{}};
 const p=project([{...brush('a'),entityId:'e'},{...brush('b'),entityId:'e'},e]);
 assert.throws(()=>applySurfacePreset(p,['a'],'glass',opt(),()=> 'new'),/owns 2 brushes/);
 assert.throws(()=>applySurfacePreset(project([{...brush(),entityId:'e'},{...e,classname:'func_door'}]),['brush'],'glass',opt(),()=> 'new'),/Detach it first/);
});
test('hidden and locked brushes cannot be converted, invalid opacities/colors are rejected',()=>{
 for(const flag of ['hidden','locked'])assert.throws(()=>applySurfacePreset(project([{...brush(),[flag]:true}]),['brush'],'glass',opt(),()=> 'e'));
 for(const amount of [0,256,1.5,NaN])assert.throws(()=>applySurfacePreset(project(),['brush'],'glass',opt({amount}),()=> 'e'));
 assert.throws(()=>applySurfacePreset(project(),['brush'],'glass',opt({color:[255,-1,0]}),()=> 'e'));
});
test('grate requires { cutout textures; water requires a cuboid ! liquid brush',()=>{
 assert.throws(()=>applySurfacePreset(project(),['brush'],'grate',opt(),()=> 'e'),/transparent/);
 const grate=applySurfacePreset(project(),['brush'],'grate',opt({texture:'{GRATE01',paintAll:true}),()=> 'e');
 assert.ok(grate.objects[0].faces.every(f=>f.texture==='{GRATE01'));
 assert.equal(grate.objects[1].props.rendermode,'4');
 assert.throws(()=>applySurfacePreset(project(),['brush'],'water',opt(),()=> 'e'),/liquid/);
 const water=applySurfacePreset(project(),['brush'],'water',opt({texture:'!WATER0',paintAll:true,waveHeight:2}),()=> 'e');
 assert.equal(water.objects[1].classname,'func_water');assert.equal(water.objects[1].props.WaveHeight,'2');
 assert.equal(water.objects[0].faces[0].uShift,5);
 assert.throws(()=>applySurfacePreset(project([{...brush(),primitive:'cone'}]),['brush'],'water',opt({texture:'!WATER0',paintAll:true}),()=> 'e'),/cuboid/);
});
test('emissive light_surface preserves geometry, rejects missing face and duplicate per texture',()=>{
 const p=project([brush('b','LIGHT')]);const a=addEmissiveSurface(p,'b','LIGHT',280,()=> 'lightId');
 assert.equal(a.objects[1].classname,'light_surface');assert.equal(a.objects[1].props._light,'255 255 255 280');
 assert.throws(()=>addEmissiveSurface(a,'b','LIGHT',280,()=> 'other'),/already has/);
 assert.throws(()=>addEmissiveSurface(p,'b','OTHER',80,()=> 'other'),/currently used/);
});
test('emissive native helper blocks conflicting info_texlights definitions',()=>{
 const p=project([brush('b','LIGHT'),{id:'texlights',kind:'entity',name:'info_texlights',classname:'info_texlights',position:[0,0,0],props:{LIGHT:'255 255 255 500'}}]);
 assert.throws(()=>addEmissiveSurface(p,'b','LIGHT',80,()=> 'new'),/info_texlights/);
});
test('surface sound mapping is project-only until explicitly linked; generated text is ASCII/CRLF',()=>{
 const initial=project();const updated=setSurfaceSound(initial,'PLANKS1','W');const multi=setSurfaceSound(updated,'METAL1','M');
 assert.equal(initial.surfaceSounds,undefined);assert.equal(updated.world.materials_file,undefined);
 const text=generateSurfaceMaterialsTxt(multi.surfaceSounds);
 assert.equal(text,'M METAL1\r\nW PLANKS1\r\n');assert.ok([...text].every(c=>c.charCodeAt(0)<128));
 const linked=linkSurfaceMaterialFile(multi,'surface_map');assert.equal(linked.world.materials_file,'sound/surface_map/surface_map_materials.txt');
 const removed=setSurfaceSound(linked,'METAL1',null);assert.equal(removed.surfaceSounds.METAL1,undefined);
});
test('materials.txt lookup validates prefixes, collisions and unsupported codes',()=>{
 assert.ok(Object.keys(SURFACE_CODES).includes('Y'));assert.equal(materialLookupKey('+0LIGHT001'),'LIGHT001');
 assert.equal(materialLookupKey('~BRIGHT'),'BRIGHT');
 assert.throws(()=>setSurfaceSound(project(),'../FILE','M'),/WAD texture/);
 assert.throws(()=>setSurfaceSound(project(),'TEXTURE','Z'),/material/);
 assert.ok(inspectSurfaceSounds({'TEST_LONG_NAME':'W','TEST_LONG_NAM2':'M'}).some(x=>x.includes('collide')));
 assert.throws(()=>materialSoundPath('../evil'));
});
test('animated WAD sequence inspector detects missing frames without generating files',()=>{
 const rows=inspectTextureAnimations(['+0ANIMATE','+2ANIMATE','+AANIMATE','+BANIMATE','BRICK']);
 assert.equal(rows.length,1);assert.deepEqual(rows[0].missing,['+1ANIMATE']);
});
test('Material Doctor diagnoses invalid native surface combos and sound install',()=>{
 const water=applySurfacePreset(project(),['brush'],'glass',opt(),()=> 'e');
 const bad={...water,objects:water.objects.map(o=>o.kind==='entity'?{...o,classname:'func_water'}:o),surfaceSounds:{BRICK:'W'}};
 const warnings=surfaceMaterialDoctor(bad,['BRICK']);
 assert.ok(warnings.some(w=>w.includes('func_water')));assert.ok(warnings.some(w=>w.includes('materials_file')));
});
test('resource tab, packager and project validation integrate Surface Studio',()=>{
 const panels=read('src/components/Panels.tsx'),store=read('src/store.ts'),packager=read('src/components/MapPackagerStudio.tsx'),server=read('server/mapPackager.js'),validation=read('src/engine/projectValidation.ts');
 assert.match(panels,/resource==='materials'/);assert.match(panels,/<MaterialSurfaceStudio\/>/);
 assert.match(store,/applyNativeSurfacePreset/);assert.match(store,/history:\[\.\.\.s\.history\.slice\(-70\),clone\(s\.project\)\]/);
 assert.match(packager,/generateSurfaceMaterialsTxt\(surfaceSounds\)/);assert.match(server,/key==='materials_file'/);
 assert.match(validation,/surfaceSounds!==undefined/);
});
