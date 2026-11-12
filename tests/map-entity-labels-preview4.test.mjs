import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const source=await fs.readFile(new URL('../src/engine/mapEntityLabels.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022},reportDiagnostics:true});
assert.equal(js.diagnostics?.length,0);
const {layoutMapLabels,DEFAULT_MAP_LABEL_SETTINGS,normalizeMapLabelSettings,mapLabelPriority}=await import('data:text/javascript;base64,'+Buffer.from(js.outputText).toString('base64'));
const options={width:1280,height:720,limit:48,avoidOverlap:true};
const label=(i,x=i%35*36+50,y=Math.floor(i/35)*22+40)=>({id:`id${i}`,x,y,width:100,height:38,distanceSquared:i*100,priority:10,selected:false,spawn:false});
test('default optimized mode and invalid settings normalization',()=>{
 assert.equal(DEFAULT_MAP_LABEL_SETTINGS.mode,'optimized');
 assert.equal(normalizeMapLabelSettings({mode:'classic',maxLabels:Infinity,distance:-3}).mode,'classic');
 assert.equal(normalizeMapLabelSettings({mode:'classic',maxLabels:Infinity,distance:-3}).distance,200);
 assert.equal(normalizeMapLabelSettings({maxLabels:10000}).maxLabels,240);
});
test('no labels with zero entities',()=>assert.deepEqual(layoutMapLabels([] ,options),{ids:[],inView:0}));
test('zero data mutation and bounded visible labels for counts 20, 100, 500, 695, 1200',()=>{
 for(const n of [20,100,500,695,1200]){
  const candidates=Object.freeze(Array.from({length:n},(_,i)=>Object.freeze(label(i))));
  const first=layoutMapLabels(candidates,options),again=layoutMapLabels(candidates,options);
  assert.deepEqual(first,again);assert.ok(first.ids.length<=48);assert.ok(first.ids.every(id=>candidates.some(c=>c.id===id)));
  assert.equal(candidates.length,n);
 }
});
test('overlap rejected; near/target/spawn/hover priority',()=>{
 const candidates=[label(1,100,100),{...label(2,100,100),priority:400},{...label(3,100,100),priority:250}];
 assert.deepEqual(layoutMapLabels(candidates,options).ids,['id2']);
 assert.ok(mapLabelPriority('info_player_start',undefined,true,false)>mapLabelPriority('trigger_relay','go',false,false));
 assert.ok(mapLabelPriority('info_node',undefined,false,true)>mapLabelPriority('info_player_start',undefined,true,false));
});
test('selected labels bypass cap and overlap, even when collocated',()=>{
 const selected=Array.from({length:70},(_,i)=>({...label(i,100,100),selected:true}));
 const regular=Array.from({length:150},(_,i)=>label(200+i,400+i*3,350));
 const visible=layoutMapLabels([...regular,...selected],{...options,limit:8});
 assert.equal(visible.ids.filter(id=>selected.some(x=>x.id===id)).length,70);
 assert.equal(visible.ids.length<=78,true);
});
test('frustum-style screen bounds skip offscreen candidates',()=>{
 const visible=layoutMapLabels([{...label(1),x:-200},{...label(2),x:1400},label(3,600,330)],options);
 assert.deepEqual(visible.ids,['id3']);
});
test('optimized mode does not require labels to be rewritten into map data',async()=>{
 const viewport=await fs.readFile(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
 const store=await fs.readFile(new URL('../src/store.ts',import.meta.url),'utf8');
 const overlay=await fs.readFile(new URL('../src/components/MapEntityLabelOverlay.tsx',import.meta.url),'utf8');
 assert.ok(viewport.includes("id:`brush:${obj.id}`"));
 assert.ok(viewport.includes('optimizedLabels&&!walkMode&&<MapEntityLabelOverlay'));
 assert.ok(viewport.includes('!optimizedLabels&&showLabel&&<EntityNameLabel'));
 assert.ok(store.includes('mapLabelSettings:loadMapLabelSettings()'));
 assert.ok(overlay.includes("if(node.style.transform!==transform)node.style.transform=transform"));
 assert.ok(overlay.includes('root.remove()'));
});
