import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'gs172-'));
for(const f of ['types','gameplay','gameplayGraph','gameplayWorkspace','gameplayDesigner']){
 const file=path.join(root,'src/engine',f+'.ts'),source=fs.readFileSync(file,'utf8');
 const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true,fileName:file});
 assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 fs.writeFileSync(path.join(dir,f+'.js'),result.outputText);
}
const graph=require(path.join(dir,'gameplayGraph.js')),ui=require(path.join(dir,'gameplayDesigner.js')),workspace=require(path.join(dir,'gameplayWorkspace.js'));
const ent=(id,x,y,classname='info_target',props={},layer='Gameplay')=>({id,kind:'entity',name:id,position:[x,y,64],classname,props,layer});
const source=[ent('btn',0,0,'func_button',{targetname:'button',target:'relay'}),ent('relay',24,0,'trigger_relay',{targetname:'relay',target:'door'}),ent('door',50,0,'func_door',{targetname:'door'}),ent('alone',2000,0,'monster_zombie',{},'NPC')];
const links=graph.getGameplayGraphConnections(source);
const before=JSON.stringify(source);
test('spatial sectors are bounded, stable and pure',()=>{
 const zones=ui.buildDesignZones(source,links,2);
 assert.ok(zones.length>=2);
 assert.equal(zones.reduce((s,z)=>s+z.count,0),source.length);
 assert.ok(zones.every(z=>z.entityIds.length<=12));
 assert.equal(JSON.stringify(source),before);
});
test('map category and spatial filtering do not alter keyvalues',()=>{
 const zones=ui.buildDesignZones(source,links);
 const filtered=ui.filterDesignEntities(source,zones,{query:'relay',category:'logic',layer:'Gameplay',zoneId:null});
 assert.deepEqual(filtered.map(e=>e.id),['relay']);
 const npc=ui.filterDesignEntities(source,zones,{query:'',category:'ai',layer:'NPC',zoneId:null});
 assert.deepEqual(npc.map(e=>e.id),['alone']);
 assert.deepEqual(ui.filterDesignEntities(source,zones,{query:'',category:'all',layer:'all',zoneId:'missing'}).length,source.length);
 assert.equal(JSON.stringify(source),before);
});
test('native references distinguish target from non-activation links',()=>{
 const extra=[...source,ent('camera',0,10,'trigger_camera',{targetname:'cam',moveto:'door'})];
 const rows=ui.buildDesignInteractions(graph.getGameplayGraphConnections(extra));
 assert.ok(rows.some(r=>r.from==='btn'&&r.to==='relay'&&r.via==='target'));
 assert.ok(rows.some(r=>r.from==='camera'&&r.to==='door'&&r.via==='moveto'));
 assert.equal(JSON.stringify(source),before);
});
test('planar and isometric projections are finite and different',()=>{
 const p=[128,256,64];
 assert.deepEqual(ui.projectGameplayPosition(p,'top'),[128,-256]);
 const iso=ui.projectGameplayPosition(p,'iso');
 assert.ok(iso.every(Number.isFinite));
 assert.notDeepEqual(iso,ui.projectGameplayPosition(p,'top'));
 const bounds=ui.gameplayMapBounds(source,'top');
 assert.ok(bounds.minX<bounds.maxX&&bounds.minY<bounds.maxY);
});
test('4,000 entity scenario produces paginatable spatial sectors, without 4,000 React DOM nodes',()=>{
 const many=Array.from({length:4000},(_,i)=>ent('e'+i,(i%80)*48,Math.floor(i/80)*48,'info_target',{targetname:'t'+i}));
 const copy=JSON.stringify(many),zones=ui.buildDesignZones(many,[],64);
 assert.ok(zones.length>10);
 assert.ok(zones.every(z=>z.count<=64));
 assert.equal(zones.reduce((s,z)=>s+z.count,0),4000);
 assert.equal(JSON.stringify(many),copy);
});
test('same-position entities are paginated and can all be found',()=>{
 const many=Array.from({length:1550},(_,i)=>ent('e'+i,0,0,'info_target',{targetname:'n'+i}));
 const zones=ui.buildDesignZones(many,[],64);
 assert.ok(zones.length>20);
 assert.equal(zones.reduce((s,z)=>s+z.entityIds.length,0),1550);
 assert.ok(zones.every(z=>z.count<=64));
});
test('reference tracer remains bounded with cycles',()=>{
 const cyc=[ent('a',0,0,'trigger_relay',{targetname:'a',target:'b'}),ent('b',2,2,'trigger_relay',{targetname:'b',target:'a'})];
 const index=workspace.buildGameplayWorkspaceIndex(cyc,graph.getGameplayGraphConnections(cyc));
 const t=workspace.traceGameplayReferences('a',index,12,6);
 assert.equal(t.steps.length,2);assert.ok(t.cycles>0);
});
test('new Gameplay Studio is the spatial/event/lab design with original native edit actions',()=>{
 const jsx=fs.readFileSync(path.join(root,'src/components/GameplayStudio.tsx'),'utf8');
 const parsed=ts.createSourceFile('GameplayStudio.tsx',jsx,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0);
 for(const token of ['Gameplay Studio <em>3.0</em>','page===\'map\'','page===\'events\'','page===\'lab\'','<OverviewCanvas','buildDesignZones','buildDesignInteractions','traceGameplayReferences','connect(fromId,toId)','disconnect(current.id)','setProp(current.id','EntityAssistant','tie(selectedBrush.id,type)','addDemo','undo'])assert.ok(jsx.includes(token),token);
 assert.ok(!jsx.includes('gs-node-head'));assert.ok(!jsx.includes('setGraphPosition('));
 const css=fs.readFileSync(path.join(root,'src/components/gameplayDesigner.css'),'utf8');
 assert.ok(css.includes('.gds-root'));
 assert.ok(!css.includes('.gs-v3-shell'));
});
