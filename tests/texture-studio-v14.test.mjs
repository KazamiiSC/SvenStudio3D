import test from 'node:test';
import assert from 'node:assert/strict';
import {fitFace,faceUvBounds,centerFace,flipFace,alignFaceToReference,gesturePatch,normalizeScale,sanitizeTexturePatch,brushWorldVertices,faceTextureAxes,isTextureFaceRef,faceTexturePatch} from '../src/engine/textureStudio.ts';
const cube=(id,size=[256,256,256])=>{
  const [x,y,z]=size.map(v=>v/2);
  return {id,kind:'brush',name:id,primitive:'box',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices:[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]],faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(indices=>({indices,texture:'SV_BRICK01',uScale:1,vScale:1})),locked:false,hidden:false};
};
const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
for(const dims of [[4,4,4],[16,32,64],[128,128,128],[256,512,768],[8192,1024,256],[32768,32768,8192]]){
 test(`fit face scales across ${dims.join('×')} game units`,()=>{
  const b=cube('a',dims),p=fitFace(b,4,128,128,2,4);const bounds=faceUvBounds(b,4);
  close((bounds.maxU-bounds.minU)/(p.uScale*128),2,1e-5);
  close((bounds.maxV-bounds.minV)/(p.vScale*128),4,1e-5);
  close(bounds.minU/p.uScale+p.uShift,0);close(bounds.minV/p.vScale+p.vShift,0);
 });
}
test('WAD dimensions affect physical fitting, not the geometry',()=>{
 const b=cube('a',[256,256,256]),a=fitFace(b,4,128,128),large=fitFace(b,4,256,512);
 close(a.uScale,large.uScale*2);close(a.vScale,large.vScale*4);
 assert.equal(JSON.stringify(b),JSON.stringify(cube('a',[256,256,256])));
});
test('offset/rotate/handles use independent UV axes, including mirrored scales',()=>{
 const f=cube('a').faces[4];assert.equal(gesturePatch(f,'move',20,10).uShift,16);assert.equal(gesturePatch(f,'move',20,10).vShift,-8);
 assert.equal(gesturePatch(f,'rotate',20,0).rotation,11);
 assert.ok(gesturePatch(f,'e',50,0).uScale>1);assert.equal(gesturePatch(f,'e',50,0).vScale,undefined);
 assert.ok(gesturePatch(f,'nw',-40,-40).uScale>1);assert.ok(gesturePatch(f,'nw',-40,-40).vScale>1);
 assert.ok(gesturePatch(f,'e',40,0,true).vScale>1);
 assert.equal(gesturePatch({...f,uScale:-1},'e',40,0).uScale<0,true);
});
test('flip twice and center preserve the mapped UV center',()=>{
 const b=cube('a');const f=b.faces[4];f.uShift=9.5;f.vShift=-100;
 const first=flipFace(b,4,'u');Object.assign(f,first);const second=flipFace(b,4,'u');Object.assign(f,second);
 close(f.uScale,1);close(f.uShift,9.5);
 const centered=centerFace(b,4,128,128);const bounds=faceUvBounds(b,4);
 close(((bounds.minU+bounds.maxU)/2/f.uScale+centered.uShift)/128,.5);
 close(((bounds.minV+bounds.maxV)/2/f.vScale+centered.vShift)/128,.5);
});
test('world-aligned coplanar panels share exact UV at a point',()=>{
 const src=cube('source');const dest=cube('dest');dest.position=[256,0,0];
 src.faces[4].uShift=29;src.faces[4].vShift=-18;src.faces[4].rotation=0;
 const patch=alignFaceToReference(src,4,dest,4);const p=src.vertices[5];
 const axesA=faceTextureAxes(brushWorldVertices(src),src.faces[4]);const axesB=faceTextureAxes(brushWorldVertices(dest),{...dest.faces[4],...patch});
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 close((dot(p,axesA.u)/(src.faces[4].uScale)+src.faces[4].uShift),(dot(p,axesB.u)/patch.uScale+patch.uShift));
 close((dot(p,axesA.v)/(src.faces[4].vScale)+src.faces[4].vShift),(dot(p,axesB.v)/patch.vScale+patch.vShift));
});
test('right-angle walls keep non-degenerate UV axes',()=>{
 const b=cube('a');const p=alignFaceToReference(b,4,b,2);
 const axes=faceTextureAxes(brushWorldVertices(b),{...b.faces[2],...p});
 assert.ok(Math.hypot(...axes.u)>.9);assert.ok(Math.hypot(...axes.v)>.9);
 assert.equal(p.rotation,0);
});
test('selection does not touch locked/hidden entities',()=>{
 const a=cube('a'),b=cube('b');b.locked=true;
 assert.equal(isTextureFaceRef({id:'a',face:4},[a,b]),true);
 assert.equal(isTextureFaceRef({id:'b',face:4},[a,b]),false);
 assert.equal(isTextureFaceRef({id:'a',face:20},[a,b]),false);
 a.hidden=true;assert.equal(isTextureFaceRef({id:'a',face:4},[a,b]),false);
});
test('Valve 220 fields and texture names survive preset copies',()=>{
 const f=cube('a').faces[0];f.uAxis=[1,0,0];f.vAxis=[0,-1,0];f.uShift=-128;f.uScale=.25;
 const patch=faceTexturePatch(f);assert.deepEqual(patch.uAxis,[1,0,0]);assert.equal(patch.uScale,.25);
 assert.equal(sanitizeTexturePatch({texture:'my_brick'}).texture,'MY_BRICK');
 assert.deepEqual(sanitizeTexturePatch({uAxis:undefined,vAxis:undefined}),{uAxis:undefined,vAxis:undefined});
});
test('invalid numerical scales and input are rejected',()=>{
 for(const v of [0,NaN,Infinity,-Infinity])assert.throws(()=>normalizeScale(v));
 assert.throws(()=>fitFace(cube('a'),0,0,128));
 assert.throws(()=>sanitizeTexturePatch({texture:'ILLEGAL NAME'}));
});
test('brush rotation changes world vertices without destructive edits',()=>{
 const a=cube('a');const initial=brushWorldVertices(a);a.rotation=[0,0,90];const rotated=brushWorldVertices(a);
 close(rotated[0][0],-initial[0][1]);close(rotated[0][1],initial[0][0]);
 assert.equal(a.vertices.length,8);assert.equal(a.faces.length,6);
});
