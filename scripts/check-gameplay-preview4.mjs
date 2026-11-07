/** Gameplay Studio Preview 4 — graph-only behavior, without changing native Svengine keys. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import {createRequire} from 'node:module';
const root=process.cwd();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-gameplay-p4-'));
let count=0;
const check=(name,fn)=>{fn();count++;console.log('PASS '+name)};
try{
  // Compile current engine modules rather than a hardcoded snapshot of Preview 4.
  const sources=fs.readdirSync(path.join(root,'src/engine'))
    .filter(name=>name.endsWith('.ts'))
    .map(name=>`src/engine/${name}`)
    .concat(['src/i18n.ts','src/store.ts']);
  for(const file of sources){
    const output=path.join(temp,file.replace(/\.ts$/,'.js'));
    fs.mkdirSync(path.dirname(output),{recursive:true});
    const javascript=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),
      {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
      .replace(/require\((['"])(\.{1,2}\/[^'"]+)\.ts\1\)/g,(_match,quote,target)=>`require(${quote}${target}.js${quote})`);
    fs.writeFileSync(output,javascript);
  }
  fs.writeFileSync(path.join(temp,'package.json'),'{"type":"commonjs"}');
  fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
  const req=createRequire(path.join(temp,'entry.cjs'));
  const graph=req('./src/engine/gameplayGraph.js');
  const {exportMap}=req('./src/engine/exportMap.js');
  const {validateProjectFile}=req('./src/engine/projectValidation.js');
  const {useEditor}=req('./src/store.js');
  const e=(id,classname,targetname='',target='',extra={})=>({id,kind:'entity',classname,name:classname,position:[0,0,64],props:{...(targetname?{targetname}:{}),...(target?{target}:{}),...extra},layer:'Gameplay'});
  const objects=[e('button','func_button','btn_01','relay_01'),e('relay','trigger_relay','relay_01','camera_01'),
    e('camera','trigger_camera','camera_01','look_01',{moveto:'path_01'}),e('look','info_target','look_01'),
    e('path1','path_corner','path_01','path_02'),e('path2','path_corner','path_02'),
    e('lock','trigger_once','lock_01','relay_01',{master:'relay_01',killtarget:'look_01'}),
    e('npc','monster_scientist','scientist_01')];
  const original=JSON.stringify(objects);
  const links=graph.getGameplayGraphConnections(objects);
  check('Native target, camera moveto, master and killtarget render as distinct graph-only references',()=>{
    assert.ok(links.some(x=>x.from==='button'&&x.to==='relay'&&x.via==='target'));
    assert.ok(links.some(x=>x.from==='camera'&&x.to==='look'&&x.via==='target'));
    assert.ok(links.some(x=>x.from==='camera'&&x.to==='path1'&&x.via==='moveto'));
    assert.ok(links.some(x=>x.from==='lock'&&x.to==='relay'&&x.via==='master'));
    assert.ok(links.some(x=>x.from==='lock'&&x.to==='look'&&x.via==='killtarget'));
    assert.equal(JSON.stringify(objects),original);
  });
  check('Filters: all, category, text, neighborhood and connected-only work without deleting entities',()=>{
    assert.equal(graph.filterGameplayNodes(objects,links,{}).length,objects.length);
    assert.equal(graph.filterGameplayNodes(objects,links,{category:'camera'}).length,4);
    assert.equal(graph.filterGameplayNodes(objects,links,{query:'scientist'}).length,1);
    assert.equal(graph.filterGameplayNodes(objects,links,{onlyReferenced:true}).some(x=>x.id==='npc'),false);
    const focus=graph.filterGameplayNodes(objects,links,{neighborhood:'camera'}).map(x=>x.id);
    for(const id of ['camera','relay','look','path1'])assert.ok(focus.includes(id));
    assert.equal(JSON.stringify(objects),original);
  });
  check('Automatic grid layout is finite, unique and deterministic for many entities and cycles',()=>{
    const many=[...objects,...Array.from({length:212},(_,i)=>e('extra'+i,'info_target','t'+i))];
    many.push(e('cycleA','path_corner','cycle_a','cycle_b'),e('cycleB','path_corner','cycle_b','cycle_a'));
    const all=graph.getGameplayGraphConnections(many);
    const positions=graph.layoutGameplayGraph(many,all);
    assert.equal(Object.keys(positions).length,many.length);
    assert.deepEqual(positions,graph.layoutGameplayGraph(many,all));
    assert.equal(new Set(Object.values(positions).map(p=>p.x+','+p.y)).size,many.length);
    for(const p of Object.values(positions))assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0);
    const bounds=graph.graphBounds(many.map(x=>x.id),positions);
    assert.ok(bounds.width>200&&bounds.height>100);
  });
  check('Saving and undoing only node positions does not touch native MAP export or entity keys',()=>{
    const project={version:1,target:'svengine',name:'Graph Preview',world:{classname:'worldspawn'},wadNames:[],objects};
    const before=exportMap(project);
    useEditor.getState().loadProject(project);
    const layout=graph.layoutGameplayGraph(objects,links);
    useEditor.getState().setGraphPositions(Object.fromEntries(Object.entries(layout).map(([id,p])=>[id,[p.x,p.y]])));
    const saved=useEditor.getState().project;
    assert.equal(exportMap(saved),before);
    assert.equal(JSON.stringify(saved.objects),original);
    const reloaded=validateProjectFile(saved);
    assert.equal(exportMap(reloaded),before);
    assert.equal(Object.keys(reloaded.graphPositions).length,objects.length);
    useEditor.getState().loadProject({ ...project,objects:[e('spawn','info_player_start')] });
  });
  check('Graph navigation features exist and all four UI locales have graph translations',()=>{
    const ui=fs.readFileSync('src/components/GameplayStudio.tsx','utf8');
    const css=fs.readFileSync('src/style.css','utf8');
    const lang=fs.readFileSync('src/i18n.ts','utf8');
    for(const item of ['autoArrange','fitNodes','adjustZoom','beginPan','gs-minimap','setCategory','centerOn','getGameplayGraphConnections'])
      assert.ok(ui.includes(item)||css.includes(item),item);
    for(const langName of ['es','ru','ko'])assert.ok(lang.includes('Object.assign('+langName+','));
    for(const phrase of ['Auto arrange all nodes','Camera entities','Graph layout and filters do not change GoldSrc entities or MAP export.'])
      assert.ok(lang.includes(phrase),phrase);
  });
  console.log(`PASS Gameplay Studio Preview 4: ${count} groups`);
} finally {fs.rmSync(temp,{recursive:true,force:true})}
