/** Cross-platform engine regression test; requires Node 22 + TypeScript only.
 * No Win32 compiler or platform-specific Vite/Rollup binary is needed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const root=path.resolve(import.meta.dirname,'..');
const temp=await fs.mkdtemp(path.join(root,'.advanced-check-'));
const names=['types','geometry','exportMap','importMap','modeling','advancedModeling','prefabs'];
try{
  for(const name of names){
    const contents=await fs.readFile(path.join(root,'src','engine',`${name}.ts`),'utf8');
    let output=ts.transpileModule(contents,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    output=output.replace(/from ['"]\.\/(\w+)['"]/g,(original,dependency)=>names.includes(dependency)?`from './${dependency}.mjs'`:original);
    await fs.writeFile(path.join(temp,`${name}.mjs`),output);
  }
  const url=name=>pathToFileURL(path.join(temp,`${name}.mjs`)).href;
  const {createBrush,transformedVertices,createPlaceableShape}=await import(url('geometry'));
  const {intersectConvex,subtractConvex,unionConvex,bevelEdge,taperInsetFace,extrudeFaceBrush}=await import(url('advancedModeling'));
  const {uniqueBrushEdges}=await import(url('modeling'));
  const {validateBrush,validateProject,exportMap}=await import(url('exportMap'));
  const {importMap}=await import(url('importMap'));
  const {createPrefab,placePrefab,validatePrefab}=await import(url('prefabs'));
  let checks=0;
  const check=(name,callback)=>{callback();checks++;console.log(`PASS ${name}`)};
  const valid=items=>{for(const o of items)assert.deepEqual(validateBrush(o),[],`${o.name} must be a closed convex planar brush`)};
  const box=(p,size=[128,128,128])=>createBrush('box',p,size);
  const volume=brush=>{
    // Surface integral: outward-oriented triangular fans yield signed volume.
    const p=transformedVertices(brush);let sum=0;
    for(const f of brush.faces){
      const a=p[f.indices[0]];
      for(let j=1;j+1<f.indices.length;j++){
        const b=p[f.indices[j]],c=p[f.indices[j+1]];
        sum+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
      }
    }
    return Math.abs(sum/6);
  };
  check('boolean volume preservation and legal convex hulls',()=>{
    const a=box([0,0,0]),b=box([64,0,0]);
    const overlap=intersectConvex(a,b);assert.ok(overlap);valid([overlap]);
    assert.ok(Math.abs(volume(overlap)-1048576)<2);
    const difference=subtractConvex(a,b);valid(difference);
    assert.ok(Math.abs(difference.reduce((sum,p)=>sum+volume(p),0)-1048576)<2);
    const union=unionConvex(a,b);valid(union);
    assert.ok(Math.abs(union.reduce((sum,p)=>sum+volume(p),0)-3145728)<2);
  });
  check('subtraction inside, disjoint, and rotated brushes',()=>{
    const a=box([0,0,0]),b=box([0,0,0],[64,64,64]);
    const pieces=subtractConvex(a,b);valid(pieces);
    assert.ok(Math.abs(pieces.reduce((sum,p)=>sum+volume(p),0)-(128**3-64**3))<2);
    const separate=box([2000,0,0]);assert.equal(intersectConvex(a,separate),null);
    valid(subtractConvex(a,separate));
    const rotated=box([20,0,0]);rotated.rotation=[0,0,28];valid(subtractConvex(a,rotated));
  });
  check('bevel and tapered inset preserve closed planar solids',()=>{
    const a=box([0,0,0]),[v,w]=uniqueBrushEdges(a)[0];
    const chamfer=bevelEdge(a,v,w,12);valid([chamfer]);assert.ok(chamfer.faces.length>6);
    const rim=taperInsetFace(a,1,10);valid([rim]);assert.ok(rim.faces.length>6);
    assert.throws(()=>bevelEdge(a,v,w,1000));
  });
  check('face extrusion builds a distinct convex solid',()=>{
    const a=box([64,32,0]);a.rotation=[0,0,20];
    const extension=extrudeFaceBrush(a,1,64);
    valid([a,extension]);assert.notEqual(a.id,extension.id);
    assert.ok(Math.abs(volume(extension)-(128*128*64))<3);
  });
  check('barrel vault exports as multiple convex segments',()=>{
    const vault=createPlaceableShape('vault',[0,0,0]);assert.equal(vault.length,16);valid(vault);
  });
  check('CSG and vault Valve 220 export/import roundtrip',()=>{
    const result=subtractConvex(box([0,0,0]),box([64,0,0]));
    const project={version:1,target:'svengine',name:'advanced_test',objects:[...result,...createPlaceableShape('vault',[500,0,0]),{id:'spawn',kind:'entity',classname:'info_player_start',name:'Spawn',position:[0,0,0],props:{}}],world:{classname:'worldspawn',skyname:'desert'},wadNames:['svstudio.wad']};
    assert.deepEqual(validateProject(project),[]);
    const source=exportMap(project);const reloaded=importMap(source,'advanced_test.map');
    assert.deepEqual(validateProject(reloaded),[]);
    assert.equal(reloaded.objects.filter(o=>o.kind==='brush').length,result.length+16);
    assert.ok(source.includes('"skyname" "desert"'));
  });
  check('prefabs preserve associated brush entities and isolate duplicate IDs',()=>{
    const owner={id:'door0',kind:'entity',classname:'func_door',name:'door',position:[0,0,0],props:{targetname:'door_one'}};
    const brush=box([0,0,0]);brush.entityId=owner.id;brush.group='Door Group';
    const prefab=createPrefab([owner,brush],'Door Room');validatePrefab(prefab);
    const a=placePrefab(prefab,[1000,0,64]),b=placePrefab(prefab,[2000,0,64]);
    valid(a.filter(o=>o.kind==='brush'));valid(b.filter(o=>o.kind==='brush'));
    assert.equal(a.find(o=>o.kind==='brush').entityId,a.find(o=>o.kind==='entity').id);
    assert.notEqual(a[0].id,b[0].id);assert.notEqual(a.find(o=>o.kind==='brush').group,b.find(o=>o.kind==='brush').group);
    const orphan=createPrefab([brush],'brush only');assert.equal(orphan.objects[0].entityId,undefined);
  });
  console.log(`PASS 0.7.0: ${checks} advanced geometry/prefab checks.`);
}catch(error){console.error('FAIL advanced-check',error);process.exitCode=1}
finally{await fs.rm(temp,{recursive:true,force:true})}
