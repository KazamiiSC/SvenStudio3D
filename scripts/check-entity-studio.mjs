import ts from 'typescript';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/engine/fgd.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseFgd}=await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const sourceFgd=`@BaseClass = Targetable [
 targetname(string) : "Target name" : ""
 target(string) : "Target to trigger" : ""
 spawnflags(flags) = [
  1 : "First" : 1
  2 : "Second" : 0
 ]
]
@PointClass base(Targetable) size(-16 -16 0,16 16 72) = monster_example : "Example NPC" [
 health(integer) : "Health" : 100
 behavior(choices) : "Behavior" : 1 = [
  0 : "Idle"
  1 : "Aggressive"
 ]
]
@SolidClass base(Targetable) = func_test : "Test brush" []`;
const cls=parseFgd(sourceFgd);
assert.equal(cls.length,2);
const npc=cls.find(c=>c.name==='monster_example');
assert.equal(npc?.props.health?.defaultValue,'100');
assert.equal(npc?.props.spawnflags?.defaultValue,'1');
assert.equal(npc?.props.spawnflags?.options?.length,2);
assert.equal(npc?.props.behavior?.options?.[1]?.label,'Aggressive');
assert.equal(npc?.props.targetname?.type,'string');
assert.equal(cls.find(c=>c.name==='func_test')?.type,'solid');
console.log('PASS: Sven Co-op FGD classes, inheritance, choices, flags and defaults');
