import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrush} from '../src/engine/geometry.ts';
import {createLinkedPrefab,addLinkedPrefabInstance,planLinkedPrefabSync,detachLinkedPrefab,repositionLinkedPrefabInstance,namespaceLinkedTargets,validateLinkedPrefabMetadata} from '../src/engine/linkedPrefabs.ts';
import {exportMap} from '../src/engine/exportMap.ts';
import {validateProjectFile} from '../src/engine/projectValidation.ts';
const entity=(id,name,props)=>({id,kind:'entity',name,classname:'trigger_relay',position:[64,0,48],props});
const sample=()=>{
 const b=createBrush('box',[0,0,64],[64,64,128],'Wall');
 b.id='wall';
 return {version:1,target:'svengine',name:'linked-map',world:{classname:'worldspawn',mapversion:'220'},wadNames:[],objects:[b,entity('button','Button',{targetname:'btn',target:'door'}),entity('door','Door',{targetname:'door'})]};
};
const start=()=>createLinkedPrefab(sample(),['wall','button','door'],'Test Building');
test('create link never duplicates geometry, and does not mutate source',()=>{
 const project=sample(),snapshot=structuredClone(project);
 const linked=createLinkedPrefab(project,['wall','button','door'],'Building');
 assert.deepEqual(project,snapshot);assert.equal(linked.objects.length,3);
 assert.deepEqual(linked.linkedPrefabs[0].sourceIds,['wall','button','door']);
 assert.equal(linked.linkedPrefabs[0].template.objects.length,3);
 validateProjectFile(linked);validateLinkedPrefabMetadata(linked);
});
test('linked copy uses ordinary MAP objects, remaps entity references and entityIds, and retains original',()=>{
 const project=start();const {project:copy,ids}=addLinkedPrefabInstance(project,project.linkedPrefabs[0].id,[256,0,0]);
 assert.equal(copy.objects.length,6);assert.equal(ids.length,3);assert.equal(project.objects.length,3);
 const original=copy.objects.find(x=>x.id==='button');const replicated=copy.objects.find(x=>x.id===copy.linkedPrefabs[0].instances[0].memberIds.button);
 const target=copy.objects.find(x=>x.id===copy.linkedPrefabs[0].instances[0].memberIds.door);
 assert.equal(original.props.targetname,'btn');
 assert.notEqual(replicated.props.targetname,'btn');assert.equal(replicated.props.target,target.props.targetname);
 assert.notEqual(replicated.id,original.id);
 assert.match(exportMap(copy),/worldspawn/);
 validateProjectFile(copy);
});
test('90-degree rotated instance has independent position and rotation',()=>{
 const base=start(),id=base.linkedPrefabs[0].id;
 const {project:p}=addLinkedPrefabInstance(base,id,[800,0,0],90);
 const inst=p.linkedPrefabs[0].instances[0];assert.equal(inst.yaw,90);
 assert.deepEqual(inst.anchor,[800,0,0]);assert.notDeepEqual(p.objects.find(o=>o.id===inst.memberIds.button).position,p.objects.find(o=>o.id==='button').position);
});
test('preview does not mutate anything; sync updates two copies with stable identities',()=>{
 const orig=start(),id=orig.linkedPrefabs[0].id;
 const p1=addLinkedPrefabInstance(orig,id,[300,0,0]).project;
 const p2=addLinkedPrefabInstance(p1,id,[-300,0,0],90).project;
 const old=structuredClone(p2);
 const changed={...p2,objects:p2.objects.map(o=>o.id==='wall'?{...o,name:'Renovated'}:o)};
 const preview=planLinkedPrefabSync(changed,id);
 assert.equal(preview.updated,6);assert.equal(preview.added,0);assert.equal(preview.removed,0);
 assert.deepEqual(p2,old);
 for(const inst of preview.project.linkedPrefabs[0].instances){
   assert.equal(preview.project.objects.find(o=>o.id===inst.memberIds.wall).name,'Renovated');
   assert.equal(inst.memberIds.wall,p2.linkedPrefabs[0].instances.find(x=>x.id===inst.id).memberIds.wall);
 }
 assert.equal(preview.project.objects.length,9);
 validateProjectFile(preview.project);
});
test('adopting source selection adds parts while leaving omitted original objects as standalone',()=>{
 const base=start(),id=base.linkedPrefabs[0].id;
 const oldCopy=addLinkedPrefabInstance(base,id,[400,0,0]).project;
 const extra=entity('light','New light',{targetname:'newlight'});
 const expanded={...oldCopy,objects:[...oldCopy.objects,extra]};
 const preview=planLinkedPrefabSync(expanded,id,['wall','button','light']);
 assert.equal(preview.added,1);assert.equal(preview.removed,1);
 assert.equal(preview.project.objects.some(o=>o.id==='door'),true);
 assert.equal(preview.project.objects.length,7);
 assert.deepEqual(preview.project.linkedPrefabs[0].sourceIds,['wall','button','light']);
 validateProjectFile(preview.project);
});
test('metadata detach never deletes brushes or entities',()=>{
 const base=start(),id=base.linkedPrefabs[0].id;
 const p=addLinkedPrefabInstance(base,id,[500,0,0]).project;
 const before=p.objects;
 const detached=detachLinkedPrefab(p,id,p.linkedPrefabs[0].instances[0].id);
 assert.equal(detached.linkedPrefabs[0].instances.length,0);assert.deepEqual(detached.objects,before);
 const all=detachLinkedPrefab(p,id);
 assert.deepEqual(all.objects,before);assert.equal(all.linkedPrefabs.length,0);
});
test('incomplete instance fails closed and cannot erase remaining parts',()=>{
 const base=start(),id=base.linkedPrefabs[0].id;
 const p=addLinkedPrefabInstance(base,id,[300,0,0]).project;
 const missing=p.linkedPrefabs[0].instances[0].memberIds.wall;
 const partial={...p,objects:p.objects.filter(o=>o.id!==missing)};
 assert.throws(()=>planLinkedPrefabSync(partial,id),/incomplete/);
});
test('linking refuses existing copies, duplicate source IDs and missing objects',()=>{
 const base=start(),id=base.linkedPrefabs[0].id;
 const p=addLinkedPrefabInstance(base,id,[300,0,0]).project;
 assert.throws(()=>createLinkedPrefab(p,[p.linkedPrefabs[0].instances[0].memberIds.wall],'Illegal'),/managed/);
 assert.throws(()=>createLinkedPrefab(p,['wall','wall'],'Duplicate'),/distinct/);
 assert.throws(()=>createLinkedPrefab(p,['missing'],'Missing'),/removed/);
});
test('target names with wildcards or external targets are not changed',()=>{
 const obs=[entity('a','A',{targetname:'source',target:'external'}),entity('b','B',{targetname:'door',target:'door*'})];
 const result=namespaceLinkedTargets(obs,'ssabc_');
 assert.equal(result[0].props.target,'external');assert.equal(result[1].props.target,'door*');
 assert.equal(result[1].props.targetname,'ssabc_door');
});
test('invalid linked metadata rejected before loading an imported project',()=>{
 const p=start();const tampered=structuredClone(p);
 tampered.linkedPrefabs[0].instances=[{id:'bad',anchor:[Infinity,0,0],yaw:0,prefix:'invalid',memberIds:{}}];
 assert.throws(()=>validateProjectFile(tampered),/linked/);
});

test('explicit relocation preserves object IDs, source, and other copies',()=>{
 const base=start(),id=base.linkedPrefabs[0].id;
 const p1=addLinkedPrefabInstance(base,id,[400,0,0]).project;
 const p2=addLinkedPrefabInstance(p1,id,[-400,0,0],90).project;
 const [a,b]=p2.linkedPrefabs[0].instances;
 const oldB=p2.objects.filter(o=>Object.values(b.memberIds).includes(o.id));
 const result=repositionLinkedPrefabInstance(p2,id,a.id,[800,16,0],180);
 const newA=result.project.linkedPrefabs[0].instances[0];
 assert.deepEqual(newA.anchor,[800,16,0]);assert.equal(newA.yaw,180);
 assert.deepEqual(newA.memberIds,a.memberIds);
 assert.deepEqual(result.project.objects.filter(o=>Object.values(b.memberIds).includes(o.id)),oldB);
 assert.deepEqual(result.project.objects.filter(o=>['wall','button','door'].includes(o.id)),p2.objects.filter(o=>['wall','button','door'].includes(o.id)));
 validateProjectFile(result.project);
});
test('relocation refuses missing members without modifying the project',()=>{
 const base=start(),id=base.linkedPrefabs[0].id;
 const p=addLinkedPrefabInstance(base,id,[400,0,0]).project;
 const inst=p.linkedPrefabs[0].instances[0];
 const partial={...p,objects:p.objects.filter(o=>o.id!==inst.memberIds.wall)};
 assert.throws(()=>repositionLinkedPrefabInstance(partial,id,inst.id,[300,0,0],45),/incomplete/);
});
