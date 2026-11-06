import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import {brushWorldVertices,faceTextureAxes,lockTranslatedBrushTextures} from '../src/engine/textureStudio.ts';

const source=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const close=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
const cube=()=>{
  const vertices=[[-16,-24,-32],[16,-24,-32],[16,24,-32],[-16,24,-32],[-16,-24,32],[16,-24,32],[16,24,32],[-16,24,32]];
  const indices=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
  return {id:'brush1',kind:'brush',position:[128,-64,32],vertices,scale:[1,1,1],rotation:[0,0,0],name:'test',primitive:'box',faces:indices.map(x=>({indices:x,texture:'TESTWALL',uShift:15.25,vShift:-18.5,uScale:.25,vScale:.5,rotation:0}))};
};
const checkUvInvariant=(brush,newPosition,textureSizes=[128,128])=>{
  const oldPoints=brushWorldVertices(brush),changed={...brush,position:newPosition,faces:lockTranslatedBrushTextures(brush,newPosition)};
  const newPoints=brushWorldVertices(changed);
  for(let i=0;i<brush.faces.length;i++){
    const a=brush.faces[i],b=changed.faces[i];
    const aAxes=faceTextureAxes(oldPoints,a),bAxes=faceTextureAxes(newPoints,b);
    for(const index of a.indices){
      const u1=(dot(oldPoints[index],aAxes.u)/(a.uScale??1)+(a.uShift??0))/textureSizes[0];
      const u2=(dot(newPoints[index],bAxes.u)/(b.uScale??1)+(b.uShift??0))/textureSizes[0];
      const v1=(dot(oldPoints[index],aAxes.v)/(a.vScale??1)+(a.vShift??0))/textureSizes[1];
      const v2=(dot(newPoints[index],bAxes.v)/(b.vScale??1)+(b.vShift??0))/textureSizes[1];
      close(u1,u2,1e-7);close(v1,v2,1e-7);
    }
    assert.equal(b.texture,a.texture);
    assert.equal(b.uScale,a.uScale);assert.equal(b.vScale,a.vScale);
    assert.equal(b.rotation,a.rotation);
    assert.deepEqual(b.uAxis,a.uAxis);assert.deepEqual(b.vAxis,a.vAxis);
  }
};
test('map vertex texture remains attached for negative and positive translations on all six faces',()=>{
  for(const delta of [[32,0,0],[0,-16,0],[0,0,48],[17.25,-4.5,9.75],[-128,512,-33]]){
    const b=cube();checkUvInvariant(b,b.position.map((n,i)=>n+delta[i]));
  }
});
test('no move returns original face array by reference, no needless UV reset',()=>{
 const b=cube();assert.strictEqual(lockTranslatedBrushTextures(b,b.position),b.faces);
});
test('retains hand-edited UV rotation and independent negative/positive scales',()=>{
 const b=cube();b.faces.forEach((face,i)=>{face.rotation=13+i*17;face.uScale=i%2?-.75:.1;face.vScale=i%3?-.5:4;});
 checkUvInvariant(b,[300.5,-17.75,100],[64,256]);
});
test('supports explicit non-cardinal Valve 220 axes and rotated brushes',()=>{
 const b=cube();b.rotation=[15,28,51];b.scale=[2,.8,1.2];
 b.faces.forEach((face,i)=>{face.uAxis=[.8,.4,.3];face.vAxis=[-.2,.6,.8];face.rotation=90+i;});
 checkUvInvariant(b,[150,-72,45],[256,512]);
});
test('moving repeatedly and returning to initial position does not shift texture',()=>{
 let b=cube();const initial=structuredClone(b);
 for(const delta of [[17.5,-5,2],[14,12,5],[-8,3,-20],[-23.5,-10,13]]){
   const target=b.position.map((x,i)=>x+delta[i]);
   b={...b,position:target,faces:lockTranslatedBrushTextures(b,target)};
 }
 assert.deepEqual(b.position,initial.position);
 b.faces.forEach((f,i)=>{close(f.uShift,initial.faces[i].uShift);close(f.vShift,initial.faces[i].vShift);});
});
test('source geometry, model names and face data are immutable',()=>{
 const b=cube();const backup=structuredClone(b);
 const faces=lockTranslatedBrushTextures(b,[200,200,200]);
 assert.deepEqual(b,backup);assert.notStrictEqual(faces,b.faces);
 assert.deepEqual(faces.map(f=>f.indices),b.faces.map(f=>f.indices));
});
test('invalid translation is rejected instead of writing corrupt texture shifts',()=>{
 assert.throws(()=>lockTranslatedBrushTextures(cube(),[NaN,0,0]),/Invalid brush translation/);
 assert.throws(()=>lockTranslatedBrushTextures(cube(),[Infinity,0,0]),/Invalid brush translation/);
});
test('gizmo, direct moves, snap grid and position editing use shared lock logic',()=>{
 const geometry=source('src/engine/geometry.ts'),store=source('src/store.ts');
 assert.match(geometry,/if\(same\)return lockTranslatedBrushTextures\(before,after.position\)/);
 assert.match(store,/moveSelection:delta=>set[\s\S]*?moveObjectWithTextureLock\(o,o\.position\.map/);
 assert.match(store,/snapSelectionToGrid:\(\)=>set[\s\S]*?moveObjectWithTextureLock\(o,o\.position\.map/);
 assert.match(store,/transformSelection:updates=>set[\s\S]*?faces:rotateBrushTextureLock\(o,next\)/);
 assert.match(store,/updateObject:\(id,changes\)=>set[\s\S]*?faces:rotateBrushTextureLock\(o,next\)/);
 assert.match(store,/if\(copy.kind===\x27brush\x27\)copy.faces=rotateBrushTextureLock\(copy,/);
 assert.match(store,/if\(o.kind!==\x27brush\x27\|\|\x27faces\x27 in changes\)/);
 assert.match(source('src/engine/prefabs.ts'),/lockTranslatedBrushTextures\(original,nextPosition\)/);
});
test('all modified TypeScript/TSX files parse',()=>{
 for(const name of ['src/engine/textureStudio.ts','src/engine/geometry.ts','src/engine/prefabs.ts','src/store.ts','src/App.tsx']){
  const code=source(name),file=ts.createSourceFile(name,code,ts.ScriptTarget.Latest,true,name.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(file.parseDiagnostics.length,0,`${name}: ${file.parseDiagnostics.map(x=>x.messageText).join('; ')}`);
 }
});
test('exporter, BSP viewer, backend and terrain unchanged against baseline',()=>{
 assert.match(source('src/engine/exportMap.ts'),/safeFaceTextureAxes\(vertices,face\)/, 'Valve 220 UV safety is intentional');
 assert.equal(crypto.createHash('sha256').update(source('src/components/BspViewer.tsx')).digest('hex'),'161bfa4aa59ca07ee8015222cae7e71355b2025240ed8fba02bbe74909f48919','src/components/BspViewer.tsx');
 assert.equal(crypto.createHash('sha256').update(source('server/index.js')).digest('hex'),'4d1de7967aec89380064fb0022891043f5268124b27a4813e44b10141641752d','server/index.js');
 assert.equal(crypto.createHash('sha256').update(source('src/engine/terrain.ts')).digest('hex'),'29628c8ded1c8fac682848408444f678683d72839ba67b63ab89dfb90a3736f1','src/engine/terrain.ts');
});
