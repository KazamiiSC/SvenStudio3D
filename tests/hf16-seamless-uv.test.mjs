import test from 'node:test';
import assert from 'node:assert/strict';
import {planSeamlessUV,sharedFaceEdge} from '../src/engine/seamlessUV.ts';
import {brushWorldVertices,faceTextureAxes} from '../src/engine/textureStudio.ts';
const cube=(id,position=[0,0,0],texture='BRICK')=>({id,kind:'brush',name:id,primitive:'box',position,rotation:[0,0,0],scale:[1,1,1],vertices:[[-64,-64,-64],[64,-64,-64],[64,64,-64],[-64,64,-64],[-64,-64,64],[64,-64,64],[64,64,64],[-64,64,64]],faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(indices=>({indices,texture,uScale:1,vScale:1,uShift:0,vShift:0})),locked:false,hidden:false});
const ref=(id,face=1)=>({id,face});
const mapUv=(brush,index,patch,p)=>{const f={...brush.faces[index],...patch};const axes=faceTextureAxes(brushWorldVertices(brush),f);return [(axes.u.reduce((a,v,i)=>a+v*p[i],0)/(f.uScale||1)+(f.uShift||0)),(axes.v.reduce((a,v,i)=>a+v*p[i],0)/(f.vScale||1)+(f.vShift||0))];};
const near=(a,b,tol=.0001)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);
const seamCheck=(src,srcIndex,dst,dstIndex,change)=>{for(const p of change.edge){const before=mapUv(src,srcIndex,undefined,p),after=mapUv(dst,dstIndex,change.patch,p);near(before[0],after[0]);near(before[1],after[1]);}};
test('coplanar panels: exact seam continuity and no geometry mutation',()=>{
 const a=cube('a'),b=cube('b',[128,0,0]);a.faces[1].uShift=41;a.faces[1].vShift=-13;
 const input=JSON.stringify([a,b]);const p=planSeamlessUV([a,b],[ref('a'),ref('b')]);
 assert.equal(p.changes.length,1);assert.equal(p.unreachable.length,0);
 seamCheck(a,1,b,1,p.changes[0]);assert.equal(JSON.stringify([a,b]),input);
});
test('right-angle corner: entire common edge, not just one vertex, stays continuous',()=>{
 const a=cube('a');a.faces[1].uShift=17;a.faces[1].vShift=25;
 const p=planSeamlessUV([a],[ref('a',1),ref('a',3)]);
 assert.equal(p.changes.length,1);seamCheck(a,1,a,3,p.changes[0]);
 assert.ok(p.changes[0].maxSeamError<.001);
});
test('chains across three adjacent top faces; disconnected face ignored',()=>{
 const a=cube('a'),b=cube('b',[128,0,0]),c=cube('c',[256,0,0]),d=cube('d',[2000,0,0]);
 const p=planSeamlessUV([a,b,c,d],[ref('a'),ref('b'),ref('c'),ref('d')]);
 assert.equal(p.changes.length,2);assert.deepEqual(p.unreachable,[ref('d')]);
 const bb=p.changes.find(x=>x.ref.id==='b'),cc=p.changes.find(x=>x.ref.id==='c');
 assert.equal(cc.from.id,'b');
 const bNew={...b,faces:b.faces.map((f,i)=>i===1?{...f,...bb.patch}:f)};
 seamCheck(bNew,1,c,1,cc);
});
test('diagonal corner contact is not treated as common edge',()=>{
 const a=cube('a'),b=cube('b',[128,128,0]);
 assert.equal(planSeamlessUV([a,b],[ref('a'),ref('b')]).changes.length,0);
});
test('small gap prevents automatic joining',()=>{
 const a=cube('a'),b=cube('b',[128.2,0,0]);
 assert.equal(planSeamlessUV([a,b],[ref('a'),ref('b')]).changes.length,0);
});
test('partial overlapping collinear edges allow staggered panels',()=>{
 const a=cube('a'),b=cube('b',[128,48,0]);const p=planSeamlessUV([a,b],[ref('a'),ref('b')]);
 assert.equal(p.changes.length,1);assert.ok(p.changes[0].edge[0][1]===-16||p.changes[0].edge[1][1]===-16);
});
test('different material is skipped by default; optional transfer retains continuity',()=>{
 const a=cube('a'),b=cube('b',[128,0,0],'STONE');
 assert.equal(planSeamlessUV([a,b],[ref('a'),ref('b')]).changes.length,0);
 const p=planSeamlessUV([a,b],[ref('a'),ref('b')],{copyTexture:true});assert.equal(p.changes.length,1);assert.equal(p.changes[0].patch.texture,'BRICK');
});
test('hidden and locked brushes excluded, no implicit edits',()=>{
 const a=cube('a'),b=cube('b',[128,0,0]);b.locked=true;
 assert.equal(planSeamlessUV([a,b],[ref('a'),ref('b')]).changes.length,0);
 b.locked=false;b.hidden=true;
 assert.equal(planSeamlessUV([a,b],[ref('a'),ref('b')]).changes.length,0);
});
test('selection is bounded to prevent long blocking UI work',()=>{
 const a=cube('a');const selected=Array.from({length:301},(_,i)=>ref(`fake${i}`));
 assert.ok(planSeamlessUV([a],selected).reason);
});
test('rotated brushes share a real transformed edge',()=>{
 const a=cube('a'),b=cube('b',[128,0,0]);
 // Rotation by 90 degrees changes neither the footprint nor topology of the square top.
 b.rotation=[0,0,90];const p=planSeamlessUV([a,b],[ref('a'),ref('b')]);
 assert.equal(p.changes.length,1);seamCheck(a,1,b,1,p.changes[0]);
});
test('numerical invalid vertex coordinates are rejected without changing state',()=>{
 const a=cube('a'),b=cube('b',[128,0,0]);b.vertices[0][0]=NaN;
 assert.equal(planSeamlessUV([a,b],[ref('a'),ref('b')]).changes.length,0);
});
test('no edge overlap if two lines merely run in parallel',()=>{
 assert.equal(sharedFaceEdge([[[0,0,0],[10,0,0]]],[[[0,.2,0],[10,.2,0]]]),null);
});
test('the module is imported from MAP Texture Studio and one undoable store action',async()=>{
 const fs=await import('node:fs');
 const store=fs.readFileSync(new URL('../src/store.ts',import.meta.url),'utf8');
 const ui=fs.readFileSync(new URL('../src/components/TextureStudio.tsx',import.meta.url),'utf8');
 assert.match(ui,/SeamlessUvPanel/);assert.match(store,/applySeamlessTextureAlignment:options=>set\(s=>\{/);
 assert.match(store,/return applyTexturePatches\(s,updates\)/);
});
test('mirrored and nonuniform texture scales keep phase along a corner edge',()=>{
 const a=cube('a');
 Object.assign(a.faces[1],{uAxis:[.75,.15,0],vAxis:[-.2,.8,0],uScale:-.25,vScale:.75,uShift:20,vShift:-8});
 const p=planSeamlessUV([a],[ref('a',1),ref('a',3)]);
 assert.equal(p.changes.length,1);
 assert.equal(p.changes[0].patch.uScale,-.25);
 assert.equal(p.changes[0].patch.vScale,.75);
 seamCheck(a,1,a,3,p.changes[0]);
});
test('vertex index rotation (same plane winding) preserves seam continuity',()=>{
 const a=cube('a'),b=cube('b',[128,0,0]);
 b.faces[1].indices.push(b.faces[1].indices.shift());
 const p=planSeamlessUV([a,b],[ref('a',1),ref('b',1)]);
 assert.equal(p.changes.length,1);
 seamCheck(a,1,b,1,p.changes[0]);
});
test('opposite-facing surfaces are skipped rather than guessed',()=>{
 const a=cube('a'),b=cube('b',[128,0,0]);
 b.faces[1].indices.reverse();
 const p=planSeamlessUV([a,b],[ref('a',1),ref('b',1)]);
 assert.equal(p.changes.length,0);
});
