import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {validateProjectFile} from '../src/engine/projectValidation.ts';
import {exportMap,validateProject} from '../src/engine/exportMap.ts';
import {inspectMapImport} from '../src/engine/importMap.ts';
import {inspectCS16Project} from '../src/engine/gameProfiles.ts';
import {parseFgd} from '../src/engine/fgd.ts';

test('CS map example preserves CT and T spawns and bombsite after Valve 220 MAP export/import',async()=>{
 const project=validateProjectFile(JSON.parse(await fs.readFile('examples/cs16_de_training.svenstudio.json','utf8')));
 assert.equal(project.target,'cs16');assert.deepEqual(validateProject(project),[]);
 assert.deepEqual(inspectCS16Project(project),[]);
 const map=exportMap(project);
 assert.match(map,/Counter-Strike 1\.6 \/ GoldSrc/);
 const parsed=inspectMapImport(map,'de_training.map');
 assert.equal(parsed.report.skippedBrushes,0);
 const names=parsed.project.objects.filter(o=>o.kind==='entity').map(o=>o.classname);
 for(const classname of ['info_player_start','info_player_deathmatch','func_bomb_target'])assert.ok(names.includes(classname));
 assert.equal(parsed.project.objects.filter(o=>o.kind==='brush').length,7);
 const shipped=await fs.readFile('examples/cs16_de_training.map','utf8');
 assert.equal(shipped,map);
});
test('CS 1.6 FGD inheritance preserves buyzone team choices',async()=>{
 const definitions=parseFgd(await fs.readFile('server/cs16-basic.fgd','utf8'));
 assert.ok(definitions.length>=30);
 const buy=definitions.find(d=>d.name==='func_buyzone');
 assert.equal(buy?.type,'solid');assert.ok(buy.props.team.options.length>=3);
 assert.ok(buy.props.targetname);
});
test('Svengine projects stay backward compatible and CS profile enforces two teams',async()=>{
 const old=validateProjectFile(JSON.parse(await fs.readFile('examples/gameplay_button_relay_door.svenstudio.json','utf8')));
 assert.equal(old.target,'svengine');assert.deepEqual(validateProject(old),[]);
 const incomplete=structuredClone(old);incomplete.target='cs16';
 assert.match(validateProject(incomplete).join('\n'),/Terrorist spawn/);
 incomplete.objects.push({id:'t',kind:'entity',name:'T',classname:'info_player_deathmatch',position:[24,0,40],props:{}});
 assert.deepEqual(validateProject(incomplete),[]);
});
