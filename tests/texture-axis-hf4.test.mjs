import test from 'node:test';
import assert from 'node:assert/strict';
import {safeTextureAlignment,textureBasisQuality} from '../src/engine/textureAxisSafety.ts';
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const normal=(points)=>cross(sub(points[1],points[0]),sub(points[2],points[0]));
const check=(points,u,v,uShift=0,vShift=0)=>{
 const n=normal(points),alignment=safeTextureAlignment(n,points[0],u,v,uShift,vShift);
 const round=v=>v.map(x=>+x.toFixed(3));
 assert.ok(textureBasisQuality(n,round(alignment.u),round(alignment.v))>=.20);
 return alignment;
};
const badFace=[[-250.08,69.96,60],[-254.08,70.04,60],[-254.08,70.04,72],[-250.08,69.96,72]];
for(const points of [badFace,[[-253.84,82.04,60],[-249.84,81.96,60],[-249.84,81.96,72],[-253.84,82.04,72]]]) {
 test('RAD malformed face gets safe UV axes without changing plane or input',()=>{
   const input={u:[0,1,0],v:[0,0,-1],us:-65.0249,vs:60}; const orig=JSON.stringify(input);
   const result=check(points,input.u,input.v,input.us,input.vs);
   assert.equal(result.repaired,true);
   assert.equal(JSON.stringify(input),orig);
   assert.ok(result.quality<.20);
   const anchor=points[0];
   assert.ok(Math.abs(dot(anchor,input.u)+input.us-(dot(anchor,result.u)+result.uShift))<1e-7);
   assert.ok(Math.abs(dot(anchor,input.v)+input.vs-(dot(anchor,result.v)+result.vShift))<1e-7);
 });
}
test('unmodified good vertical, horizontal, rotated and mirrored axes',()=>{
 for(const [points,u,v] of [
   [[[0,0,0],[128,0,0],[128,128,0]],[1,0,0],[0,-1,0]],
   [[[0,0,0],[0,0,128],[0,128,128]],[0,1,0],[0,0,-1]],
   [[[0,0,0],[128,0,0],[128,128,0]],[.707,.707,0],[-.707,.707,0]],
   [[[0,0,0],[128,0,0],[128,128,0]],[-1,0,0],[0,1,0]]]) {
     const s=check(points,u,v,128,-40);assert.equal(s.repaired,false);
     assert.deepEqual(s.u,u);assert.deepEqual(s.v,v);assert.equal(s.uShift,128);assert.equal(s.vShift,-40);
 }
});
test('two parallel axes produce valid independent face directions',()=>{
 const s=check(badFace,[1,0,0],[1,0,0]);assert.equal(s.repaired,true);
});
test('axes both pointing into the face normal are repaired',()=>{
 const s=check(badFace,[0,1,0],[0,-1,0]);assert.equal(s.repaired,true);
});
test('invalid numeric and zero axes are repaired with finite shifts',()=>{
 const s=check(badFace,[NaN,0,0],[0,0,0]);
 assert.equal(s.repaired,true);
 assert.ok([s.uShift,s.vShift,...s.u,...s.v].every(Number.isFinite));
});
test('unrepairable face normal is rejected',()=>{
 assert.throws(()=>safeTextureAlignment([0,0,0],[0,0,0],[1,0,0],[0,1,0]),/degenerate/);
});
test('UV phase preserved on coplanar points when valid projection can be kept',()=>{
 const points=[[16,-8,32],[144,-8,32],[144,120,32],[16,120,32]];
 const u=[1,0,.3],v=[0,1,0.4],n=normal(points);
 const r=check(points,u,v,20,-14);
 for(const p of points){
  const oldU=dot(p,u)+20,newU=dot(p,r.u)+r.uShift;
  const oldV=dot(p,v)-14,newV=dot(p,r.v)+r.vShift;
  assert.ok(Math.abs(oldU-newU)<1e-7);
  assert.ok(Math.abs(oldV-newV)<1e-7);
 }
 assert.equal(r.repaired,false);
});
test('safety of the normal side face when U projection collapses',()=>{
 const r=check(badFace,[0,1,0],[0,0,-1]);
 assert.ok(textureBasisQuality(normal(badFace),r.u,r.v)>.95);
});
test('large number of labels/textures remains deterministic',()=>{
 let fixes=0;
 for(let i=0;i<1000;i++)if(check(badFace,[0,1,0],[0,0,-1]).repaired)fixes++;
 assert.equal(fixes,1000);
});

test('regression: mismatched UV repair thresholds never crash the 3D viewport',()=>{
 const n=[0,0,1], anchor=[12,34,56];
 const originalU=[4,0,30],originalV=[.9,.35,0];
 const out=safeTextureAlignment(n,anchor,originalU,originalV,8,12);
 assert.equal(out.repaired,true);
 assert.ok(textureBasisQuality(n,out.u,out.v)>=.5);
 assert.ok(textureBasisQuality(n,out.u.map(x=>+x.toFixed(3)),out.v.map(x=>+x.toFixed(3)))>=.5);
 assert.ok(Math.abs(dot(anchor,originalU)+8-(dot(anchor,out.u)+out.uShift))<1e-7);
 assert.ok(Math.abs(dot(anchor,originalV)+12-(dot(anchor,out.v)+out.vShift))<1e-7);
});

test('regression: keep valid moderate-angle repaired UV axes when they clear safety margin',()=>{
 const n=[0,0,1];
 const out=safeTextureAlignment(n,[0,0,0],[4,0,30],[.3,.9,0]);
 assert.ok(textureBasisQuality(n,out.u,out.v)>=.5);
 assert.ok([out.uShift,out.vShift,...out.u,...out.v].every(Number.isFinite));
});
