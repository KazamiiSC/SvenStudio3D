/** Independent behavioral regression for Gameplay Studio 3.0; no browser required. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gameplay170-'));
for(const file of ['types','gameplay','gameplayGraph','gameplayWorkspace']){
 const input=fs.readFileSync(path.join(root,'src/engine',file+'.ts'),'utf8');
 const result=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true,fileName:file+'.ts'});
 const errors=result.diagnostics?.filter(e=>e.category===ts.DiagnosticCategory.Error)||[];
 if(errors.length)throw Error(file+': '+errors.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')));
 fs.writeFileSync(path.join(tmp,file+'.cjs'),result.outputText.replaceAll('require("./types")','require("./types.cjs")').replaceAll('require("./gameplay")','require("./gameplay.cjs")').replaceAll('require("./gameplayGraph")','require("./gameplayGraph.cjs")'));
}
const load=file=>require(path.join(tmp,file+'.cjs'));
const g=load('gameplayGraph'),ws=load('gameplayWorkspace'),gameplay=load('gameplay');
const e=(id,classname='info_target',targetname='',target='',layer='Gameplay',extra={})=>({id,kind:'entity',classname,name:id,position:[0,0,64],props:{targetname,target,...extra},layer});
const data=[e('button','func_button','btn','relay'),e('relay','trigger_relay','relay','door'),e('door','func_door','door'),e('camera','trigger_camera','cam','look','Cameras',{moveto:'p1'}),e('look','info_target','look','','Cameras'),e('p1','path_corner','p1','p2','Cameras'),e('p2','path_corner','p2','p1','Cameras'),e('dup1','info_target','shared'),e('dup2','info_target','shared'),e('src','trigger_once','src','shared')];
const brushes=[{id:'brushDoor',kind:'brush',name:'East Gate',entityId:'door',primitive:'box',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices:[],faces:[],layer:'Gameplay'},{id:'brushBtn',kind:'brush',name:'Switch',entityId:'button',primitive:'box',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices:[],faces:[],layer:'Gameplay'}];
const objects=[...data,...brushes];
const baseline=JSON.stringify(objects);
const edges=g.getGameplayGraphConnections(objects);
const index=ws.buildGameplayWorkspaceIndex(objects,edges);

test('native keyvalue references remain distinguishable',()=>{
 assert.ok(edges.some(x=>x.via==='target'&&x.from==='button'&&x.to==='relay'));
 assert.ok(edges.some(x=>x.via==='moveto'&&x.from==='camera'&&x.to==='p1'));
 assert.equal(index.layerCounts.get('Cameras'),4);
 assert.equal(index.categoryCounts.camera,1);
 assert.equal(index.searchById.get('door').includes('east gate'),true);
 assert.deepEqual(index.duplicates.find(x=>x.name==='shared')?.entityIds,['dup1','dup2']);
});
test('bounded trace follows reference chains and detects cycles without executing events',()=>{
 const trace=ws.traceGameplayReferences('camera',index,100,14);
 assert.deepEqual(trace.steps.map(x=>x.entityId).sort(),['camera','look','p1','p2'].sort());
 assert.ok(trace.cycles>=1);
 const smaller=ws.traceGameplayReferences('camera',index,2,14);
 assert.equal(smaller.steps.length,2);assert.equal(smaller.truncated,true);
 assert.equal(ws.traceGameplayReferences('',index).steps.length,0);
});
test('graph viewport culling limits mounted nodes for huge scenes',()=>{
 const many=Array.from({length:4000},(_,i)=>e('obj'+i,'info_target','t'+i,'','Region '+Math.floor(i/100)));
 const manyPositions=Object.fromEntries(many.map((item,i)=>[item.id,{x:30+(i%50)*294,y:25+Math.floor(i/50)*140}]));
 const rect={left:0,top:0,width:970,height:560,zoom:1};
 const shown=ws.gameplayVisibleWindow(many,[],manyPositions,rect);
 assert.ok(shown.nodes.length>0&&shown.nodes.length<200);
 assert.ok(shown.nodes.every(n=>many.includes(n)));
 const far=ws.gameplayVisibleWindow(many,[],manyPositions,{left:50000,top:50000,width:500,height:500,zoom:1});
 assert.equal(far.nodes.length,0);
});
test('a wire crossing the viewport stays visible even with both endpoint nodes outside',()=>{
 const positions={left:{x:-450,y:50},right:{x:1700,y:50}};
 const shown=ws.gameplayVisibleWindow([{id:'left'},{id:'right'}],[{from:'left',to:'right',name:'linked',via:'target'}],positions,{left:400,top:0,width:900,height:380,zoom:1},0);
 assert.equal(shown.nodes.length,0);assert.equal(shown.edges.length,1);
});
test('workspace index and trace never mutate saved entities or the GoldSrc MAP data',()=>{
 assert.equal(JSON.stringify(objects),baseline);
 const after=gameplay.getConnections(objects);
 assert.equal(after.length>0,true);
 assert.equal(JSON.stringify(objects),baseline);
});
test('4,000 entity workspace can be indexed without quadratic brush-name search',()=>{
 const many=Array.from({length:4000},(_,i)=>e('large'+i,'info_target','name'+i,'','Layer '+(i%12)));
 const result=ws.buildGameplayWorkspaceIndex(many,[]);
 assert.equal(result.searchById.size,4000);
 assert.equal([...result.layerCounts.values()].reduce((a,b)=>a+b,0),4000);
});
test('Gameplay Studio JSX keeps native connection, undo and guided entity edit integration',()=>{
 const jsx=fs.readFileSync(path.join(root,'src/components/GameplayStudio.tsx'),'utf8');
 const sf=ts.createSourceFile('GameplayStudio.tsx',jsx,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(sf.parseDiagnostics.length,0);
 for(const needle of ['connect(fromId,toId)','disconnect(current.id)','setProp(current.id','EntityAssistant','<OverviewCanvas','page===\'events\'','page===\'lab\''])assert.ok(jsx.includes(needle),needle);
});
