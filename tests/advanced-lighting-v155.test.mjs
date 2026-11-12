import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RAD_FIELDS,RAD_PRESETS,validateRadValues,mergeRadProps,radFromProps,validateTextureName,textureLightProps,mergeTexlightsProps,validateTextureDraft,createLightingEntity,styleFromProps,mergeStyleProps,validateStyleDraft,validateShadowTarget} from '../src/engine/advancedLighting.ts';
const texture={texture:'+0~LIGHT6A',brightness:2000,color:[255,100,20],autoColor:true,gap:'3.0',maxDistance:'',targetname:''};
test('SC-RAD fields use documented info_compile_parameters keys',()=>{
 const keys=RAD_FIELDS.map(x=>x.key);assert.equal(keys.length,new Set(keys).size);
 assert.ok(keys.includes('rad_texreflectgamma'));assert.ok(keys.includes('rad_customshadowwithbounce'));
 assert.ok(keys.every(key=>key.startsWith('rad_')));
});
test('SC-RAD settings preserve CSG/BSP/VIS keys, unrelated RAD keys and spawnflags',()=>{
 const original={classname:'info_compile_parameters',bsp_noopt:'-1',vis:'3',rad_lights:'hl_lights.rad',spawnflags:'4',rad_bounce:'3',rad_blur:'1.5'};
 const next=mergeRadProps(original,{rad_bounce:'6',rad_blur:'',rad_rgbtransfers:'1'});
 assert.equal(next.rad_bounce,'6');assert.equal(next.rad_blur,undefined);assert.equal(next.rad_rgbtransfers,'1');
 for(const name of ['classname','bsp_noopt','vis','rad_lights','spawnflags'])assert.equal(next[name],original[name]);
 assert.equal(radFromProps(next).rad_bounce,'6');
});
test('SC-RAD validation rejects invalid/unsafe numeric and RGB fields',()=>{
 for(const raw of ['NaN','1 -evil','999999','1; rm','Infinity'])assert.ok(validateRadValues({rad_bounce:raw}).length,raw);
 assert.equal(validateRadValues({rad_ambient:'0.05 0.1 0.15'}).length,0);
 assert.ok(validateRadValues({rad_ambient:'0.2 1.5 0.1'}).length);
 assert.ok(validateRadValues({rad_rgbtransfers:'2'}).length);
 assert.throws(()=>mergeRadProps({}, {rad_chop:'-5'}));
});
test('SC-RAD recommended presets remain valid',()=>{
 for(const preset of Object.values(RAD_PRESETS))assert.deepEqual(validateRadValues(preset),[]);
});
test('Texture names accept real GoldSrc prefixes, reject invalid keys',()=>{
 for(const name of ['+0~LIGHT6A','!water','{grate','~bright','LIGHT'])assert.equal(validateTextureName(name),null);
 for(const name of ['','a'.repeat(16),'foo bar','origin','classname','light"\n"target','../../file'])assert.notEqual(validateTextureName(name),null);
});
test('light_surface generates compiler-native surface lighting and optional filters',()=>{
 assert.deepEqual(textureLightProps('light_surface',texture),{_tex:'+0~LIGHT6A',_light:'255 255 255 2000',_texlightgap:'3.0'});
 const withColor=textureLightProps('light_surface',{...texture,autoColor:false,maxDistance:'512',targetname:'neon_01'});
 assert.equal(withColor._texcolor,'255 100 20');assert.equal(withColor._frange,'512');assert.equal(withColor.targetname,'neon_01');
});
test('info_texlights stores exact texture name key, RGB and brightness',()=>{
 assert.deepEqual(textureLightProps('info_texlights',texture),{'+0~LIGHT6A':'255 100 20 2000'});
 assert.deepEqual(validateTextureDraft({...texture,brightness:-1},'info_texlights').length,1);
});
test('info_texlights updates case-insensitive keys without duplicating or losing others',()=>{
 const before={SV_TILE01:'30 50 70 500',SV_BRICK01:'70 80 90 120',targetname:'catalog'};
 const after=mergeTexlightsProps(before,{...texture,texture:'sv_tile01'});
 assert.equal(after.SV_TILE01,'255 100 20 2000');
 assert.equal(after.sv_tile01,undefined);assert.equal(after.SV_BRICK01,before.SV_BRICK01);
 assert.equal(after.targetname,'catalog');
});
test('Texture lighting entity is an ordinary editable point entity',()=>{
 const entity=createLightingEntity('test123','light_surface',[5,10,20],textureLightProps('light_surface',texture));
 assert.equal(entity.kind,'entity');assert.equal(entity.classname,'light_surface');assert.equal(entity.props._tex,'+0~LIGHT6A');assert.deepEqual(entity.position,[5,10,20]);
});
test('Lightstyle changes preserve unrelated bits and keyvalues',()=>{
 const before={_light:'255 210 170 500',spawnflags:'6',zhlt_lightflags:'2'};
 const after=mergeStyleProps(before,{targetname:'hall',style:'10',pattern:'mmnmmomm',initiallyDark:true});
 assert.equal(after.spawnflags,'7');assert.equal(after._light,before._light);assert.equal(after.zhlt_lightflags,'2');
 assert.equal(after.pattern,'mmnmmomm');assert.equal(styleFromProps(after).initiallyDark,true);
 const reset=mergeStyleProps(after,{targetname:'',style:'0',pattern:'',initiallyDark:false});
 assert.equal(reset.spawnflags,'6');assert.equal(reset.pattern,undefined);assert.equal(reset.style,undefined);
});
test('Dynamic style validation requires name for patterns and initially dark',()=>{
 assert.ok(validateStyleDraft({targetname:'',style:'0',pattern:'mmn',initiallyDark:false}).length);
 assert.ok(validateStyleDraft({targetname:'test',style:'0',pattern:'Bad!',initiallyDark:false}).length);
 assert.deepEqual(validateStyleDraft({targetname:'test',style:'0',pattern:'mmn',initiallyDark:true}),[]);
});
test('Switchable shadow helper diagnoses missing opaque flags',()=>{
 const map=[{kind:'entity',classname:'func_wall',props:{targetname:'door'}},{kind:'entity',classname:'func_wall',props:{targetname:'opaque',zhlt_lightflags:'2'}}];
 assert.ok(validateShadowTarget(map,'door').some(s=>s.includes('Opaque')));
 assert.deepEqual(validateShadowTarget(map,'opaque'),[]);
 assert.ok(validateShadowTarget(map,'unknown')[0].includes('No entity'));
});
test('Source integration: native MAP export and existing SC-RAD launch are unchanged',()=>{
 const exporter=fs.readFileSync(new URL('../src/engine/exportMap.ts',import.meta.url),'utf8');
 const server=fs.readFileSync(new URL('../server/index.js',import.meta.url),'utf8');
 const component=fs.readFileSync(new URL('../src/components/LightingStudio.tsx',import.meta.url),'utf8');
 assert.match(exporter,/props:\s*Record<string,string>=\{\.\.\.e\.props,classname:e\.classname\}/);
 assert.match(server,/stage==='RAD'&&extraRad/);
 for(const tab of ['Texture lights','Advanced SC-RAD','Styles & shadows'])assert.ok(component.includes(tab));
});
