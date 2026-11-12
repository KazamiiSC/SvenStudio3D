/** Gameplay Studio 3.1: large-map visual systems without changing native entities. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gameplay171-'));
for(const file of ['types','gameplay','gameplayGraph','gameplayWorkspace']){
 const input=fs.readFileSync(path.join(root,'src/engine',file+'.ts'),'utf8');
 const result=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true,fileName:file+'.ts'});
 assert.deepEqual((result.diagnostics||[]).filter(e=>e.category===ts.DiagnosticCategory.Error),[]);
 fs.writeFileSync(path.join(tmp,file+'.cjs'),result.outputText.replaceAll('require("./types")','require("./types.cjs")').replaceAll('require("./gameplay")','require("./gameplay.cjs")').replaceAll('require("./gameplayGraph")','require("./gameplayGraph.cjs")'));
}
const ws=require(path.join(tmp,'gameplayWorkspace.cjs')),graph=require(path.join(tmp,'gameplayGraph.cjs'));
const e=(id,classname='info_target',targetname='',target='',layer='Gameplay')=>({id,kind:'entity',classname,name:id,position:[0,0,64],props:{targetname,target},layer});
const elements=[e('button','func_button','button','relay'),e('relay','trigger_relay','relay','door'),e('door','func_door','door'),e('other','monster_zombie','','','NPC'),e('silent','info_target','','','Gameplay')];
const edges=graph.getGameplayGraphConnections(elements);
const original=JSON.stringify(elements);
test('connected button/relay/door are one system; unrelated objects remain separate',()=>{
 const systems=ws.groupGameplaySystems(elements,edges);
 const connected=systems.find(s=>s.entityIds.includes('button'));
 assert.deepEqual([...connected.entityIds].sort(),['button','door','relay'].sort());
 assert.equal(connected.links,2);
 assert.equal(connected.kind,'network');
 assert.ok(systems.some(s=>s.entityIds.includes('other')&&s.kind==='unlinked'));
 assert.ok(systems.some(s=>s.entityIds.includes('silent')&&s.kind==='unlinked'));
});
test('broken outgoing target is not hidden among unlinked entities',()=>{
 const elements=[e('broken','trigger_once','','missing'),e('free','info_target')];
 const systems=ws.groupGameplaySystems(elements,[]);
 assert.equal(systems.find(s=>s.entityIds.includes('broken'))?.kind,'network');
 assert.equal(systems.find(s=>s.entityIds.includes('free'))?.kind,'unlinked');
});
test('thousands of isolated entities are paginatable batches, not thousands of DOM graph nodes',()=>{
 const many=Array.from({length:4000},(_,i)=>e('id'+i,'info_target','','','Zone '+(i%4)));
 const groups=ws.groupGameplaySystems(many,[],24);
 assert.equal(groups.reduce((sum,s)=>sum+s.count,0),4000);
 assert.ok(groups.length<180);
 assert.ok(groups.every(s=>s.count<=24));
 assert.ok(groups.every(s=>s.kind==='unlinked'));
});
test('cyclic and bidirectional references are grouped without infinite traversal',()=>{
 const cyclic=[e('a','trigger_relay','nameA','nameB'),e('b','trigger_relay','nameB','nameA')];
 const groups=ws.groupGameplaySystems(cyclic,graph.getGameplayGraphConnections(cyclic));
 assert.equal(groups.length,1);
 assert.equal(groups[0].count,2);
 assert.equal(groups[0].links,2);
});
test('overview and grouping are pure and never alter any MAP keyvalues',()=>{
 ws.groupGameplaySystems(elements,edges);
 assert.equal(JSON.stringify(elements),original);
});
test('Gameplay Studio replaces the old graph with spatial sectors, native event list and reference lab',()=>{
 const source=fs.readFileSync(path.join(root,'src/components/GameplayStudio.tsx'),'utf8');
 const sf=ts.createSourceFile('GameplayStudio.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(sf.parseDiagnostics.length,0);
 for(const needle of ["page==='map'","page==='events'","page==='lab'",'buildDesignZones','<OverviewCanvas','buildDesignInteractions','traceGameplayReferences','connect(fromId,toId)','setProp(current.id'])assert.ok(source.includes(needle),needle);
});
test('new controls are CSS-scoped to Gameplay Studio, without changing other studio styles',()=>{
 const css=fs.readFileSync(path.join(root,'src/style.css'),'utf8');
 for(const selector of ['.gs-v31-shell .gs-systems-overview','.gs-v31-shell .gs-system-card','.gs-v31-shell .gs-minimap','.gs-v31-shell .gs-scope-tabs'])assert.ok(css.includes(selector),selector);
});
