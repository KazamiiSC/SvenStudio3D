import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {guideForClass,guideKeys,editableSoundKeys,entityGuideWarnings,builtInGuideClasses,entityCapabilities,localizedGuideForClass} from '../src/engine/entityGuide.ts';
const root=new URL('../src/components/', import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const entity=(id,classname,props={})=>({id,name:classname,kind:'entity',classname,position:[0,0,0],props});
test('all curated entity guides have steps, purpose, category and example',()=>{
 assert.ok(builtInGuideClasses.length>=20);
 for(const name of builtInGuideClasses){const g=guideForClass(name);assert.ok(g.summary.length>20,name);assert.ok(g.steps.length>=2,name);assert.ok(g.category,name);assert.ok(g.example,name);}
});
test('button and door example connects matching target and targetname',()=>{
 assert.match(guideForClass('func_button').example,/door_01/);
 assert.match(guideForClass('func_door').example,/angles = 0 -1 0/);
});
test('fallback covers unknown FGD classes safely without adding invented keyvalues',()=>{
 const def={name:'custom_computer',type:'point',description:'Computer custom',props:{foobar:{label:'Foobar',type:'string'},noise:{label:'Noise',type:'sound'}}};
 assert.match(guideForClass(def.name,def).summary,/Entidad/);
 assert.deepEqual(guideKeys(def.name,def),['noise']);
 assert.deepEqual(editableSoundKeys(def.name,def),['noise']);
});
test('do not create fake sound keys on unknown classes',()=>{
 assert.deepEqual(editableSoundKeys('monster_foo'),[]);
 assert.deepEqual(editableSoundKeys('func_door'),['noise1','noise2','locked_sound_override','unlocked_sound_override']);
 assert.deepEqual(editableSoundKeys('func_button'),['noise','locked_sound_override','unlocked_sound_override']);
});
test('show FGD native option keys and never overwrite foreign key ids',()=>{
 const def={name:'func_button',type:'solid',description:'Button',props:{target:{label:'Target',type:'string'},sounds:{label:'Sounds',type:'choices',options:[{value:'0',label:'None'},{value:'7',label:'Plunger'}]},noise:{label:'Sound Override',type:'sound'}}};
 assert.ok(guideKeys(def.name,def).includes('sounds'));
 assert.ok(guideKeys(def.name,def).includes('noise'));
 assert.ok(guideKeys(def.name,def).includes('target'));
});
test('validation finds missing button targets, preserves path targets and warns about vertical door clearance',()=>{
 const b=entity('b','func_button',{target:'door_01'}),d=entity('d','func_door',{targetname:'door_01',angle:'-1'});
 assert.equal(entityGuideWarnings(b,[b]).length,1);
 assert.deepEqual(entityGuideWarnings(b,[b,d]),[]);
 assert.equal(entityGuideWarnings(d,[b,d]).length,1);
 assert.deepEqual(entityGuideWarnings(entity('p','path_corner',{target:'later'}),[]),[]);
});
test('entity guide linked across asset browser, properties and gameplay editor',()=>{
 for(const name of ['Panels.tsx','GameplayStudio.tsx'])assert.match(read(name),/EntityAssistant/);
 assert.match(read('Panels.tsx'),/entity-guide-modal/);
 assert.match(read('EntityAssistant.tsx'),/connect\(entity.id,e.target.value,true\)/);
});
test('sound picker uses game backend and saves native sound relative path',()=>{
 const source=read('EntityAssistant.tsx');
 assert.match(source,/\/api\/assets\/sounds/);
 assert.match(source,/\/api\/assets\/sound\?/);
 assert.match(source,/update\(k,item.path\)/);
 assert.match(source,/AbortController/);
});
test('six language sets exist and classnames/keyvalues remain unchanged',()=>{
 const source=read('EntityAssistant.tsx');
 for(const key of ['es:','en:','ru:','ko:','zh:','pt:'])assert.ok(source.includes(key),key);
 assert.match(source,/entity\.props\[field\]/);
 assert.match(source,/definition\?\.props\[field\]/);
});

test('custom FGD capabilities are inferred only from actual field names',()=>{
 const d={name:'custom_relay',type:'point',description:'Custom relay',props:{target:{label:'Target',type:'string'},noise:{label:'Sound',type:'sound'},health:{label:'Health',type:'integer'}}};
 assert.ok(entityCapabilities(d).some(s=>s.includes('Conexiones')));
 assert.ok(entityCapabilities(d).some(s=>s.includes('sonido')));
 assert.ok(!entityCapabilities(d).some(s=>s.includes('Iluminación')));
 assert.ok(entityCapabilities(d,'en').some(s=>s.includes('Sound')));
});
test('English guide has dedicated explanations and no translated classname or keyvalue',()=>{
 const g=localizedGuideForClass('func_button',undefined,'en');
 assert.match(g.summary,/Activates/);
 assert.match(g.example,/Button/);
 const fallback=localizedGuideForClass('custom_unknown',undefined,'en');
 assert.match(fallback.summary,/FGD/);
});
