import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBsp} from '../src/engine/bsp.ts';
import {readNativeBsp,writeNativeBsp,setNativeValue} from '../src/engine/bspNativeEdit.ts';
import {bspApplySurfaceOperation,writeBspSurfaceEdits} from '../src/engine/bspSurfaceEdit.ts';
import {writeBspWadSurfaceCopy} from '../src/engine/bspTextureEmbedding.ts';
import {compactBspCopy} from '../src/engine/bspCompactExport.ts';
import {planBspImportedWadRemoval} from '../src/engine/bspImportedWadManagement.ts';

const data=readFileSync(new URL('./fixtures/maptest1_lighting_v159.bsp',import.meta.url));
const fresh=()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const bytes=(buffer,lump)=>{const {offset,length}=readNativeBsp(buffer).lumps[lump];return new Uint8Array(buffer,offset,length)};
const op=(texture=-1,rotation=25)=>({texture,offsetU:16,offsetV:0,rotation,scaleU:1.2,scaleV:.8});
function wad(name='SV_NEW6E',width=64,height=128){
 const sizes=[width*height,width*height/4,width*height/16,width*height/64],offsets=[40];
 for(let i=1;i<4;i++)offsets.push(offsets[i-1]+sizes[i-1]);
 const end=offsets[3]+sizes[3],raw=Buffer.alloc(end+2+768);
 raw.write(name,0,'latin1');raw.writeUInt32LE(width,16);raw.writeUInt32LE(height,20);
 offsets.forEach((offset,i)=>raw.writeUInt32LE(offset,24+i*4));
 for(let i=0;i<4;i++)raw.fill(17+3*i,offsets[i],offsets[i]+sizes[i]);
 raw.writeUInt16LE(256,end);for(let i=0;i<768;i++)raw[end+2+i]=i%256;
 const pack=Buffer.alloc(12+raw.length+32),dir=12+raw.length;
 pack.write('WAD3',0);pack.writeInt32LE(1,4);pack.writeInt32LE(dir,8);raw.copy(pack,12);
 pack.writeInt32LE(12,dir);pack.writeInt32LE(raw.length,dir+4);pack.writeInt32LE(raw.length,dir+8);pack[dir+12]=0x43;pack.write(name,dir+16);
 return {name,width,height,wad:new Uint8Array(pack),raw};
}
test('6E: compacted BSP removes superseded texinfo/lightmap block storage while preserving all live lumps byte-for-byte',()=>{
 const source=fresh(),map=parseBsp(source),face=map.faces.find(f=>f.lightRgb&&f.flags===0);
 const edits=bspApplySurfaceOperation(map,{},[face.bspFaceIndex],op());
 const append=writeBspSurfaceEdits(source,edits);
 const {bytes:compact,report}=compactBspCopy(append);
 assert.ok(report.recoveredBytes>0);
 assert.ok(compact.byteLength<append.byteLength);
 for(let i=0;i<15;i++)assert.deepEqual(bytes(compact,i),bytes(append,i),`lump ${i}`);
 const restored=parseBsp(compact).faces.find(f=>f.bspFaceIndex===face.bspFaceIndex);
 const expected=parseBsp(append).faces.find(f=>f.bspFaceIndex===face.bspFaceIndex);
 assert.deepEqual(restored.sTexinfo,expected.sTexinfo);
 assert.deepEqual(restored.tTexinfo,expected.tTexinfo);
 assert.deepEqual(restored.lightLayers,expected.lightLayers);
 assert.deepEqual(new Uint8Array(source),new Uint8Array(fresh()),'original never modified');
});
test('6E: WAD3, entity changes, rotated UVs and lightmap styles survive compact export together',()=>{
 const source=fresh(),original=parseBsp(source),model=original.faces.find(f=>f.lightRgb&&f.flags===0);
 const newTex=wad(),base=original.textures.length;
 const extended={...original,textures:[...original.textures,{name:newTex.name,width:newTex.width,height:newTex.height,external:true}]};
 const edits=bspApplySurfaceOperation(extended,{},[model.bspFaceIndex],op(base));
 let doc=readNativeBsp(source);
 const ent=doc.entities.findIndex((e,i)=>i>0&&e.pairs.some(p=>p.key==='origin'));
 assert.ok(ent>0);
 const key=doc.entities[ent].pairs.findIndex(p=>p.key==='origin');
 doc=setNativeValue(doc,ent,key,'123 456 789');
 const expanded=writeBspWadSurfaceCopy(writeNativeBsp(doc),edits,[newTex],[newTex.wad],writeBspSurfaceEdits);
 const {bytes:compact,report}=compactBspCopy(expanded);
 assert.ok(report.recoveredBytes>0);
 const parser=parseBsp(compact),beforeNative=readNativeBsp(source);
 assert.equal(parser.entities[ent].properties.origin,'123 456 789');
 assert.equal(parser.faces.find(f=>f.bspFaceIndex===model.bspFaceIndex).texture,base);
 assert.equal(parser.textures.at(-1).name,newTex.name);
 assert.equal(parser.textures.at(-1).external,false);
 assert.deepEqual(bytes(compact,4),bytes(source,4),'VIS preserved');
 assert.deepEqual(bytes(compact,9),bytes(source,9),'clipnodes preserved');
 assert.deepEqual(bytes(compact,14),bytes(source,14),'submodels preserved');
 assert.equal(readNativeBsp(compact).entities.length,beforeNative.entities.length);
 for(let i=0;i<15;i++)assert.deepEqual(bytes(compact,i),bytes(expanded,i),`active lump ${i}`);
});
test('6E: compacting an already compact BSP is idempotent',()=>{
 const one=compactBspCopy(fresh()).bytes,two=compactBspCopy(one);
 assert.deepEqual(new Uint8Array(two.bytes),new Uint8Array(one));
 assert.equal(two.report.recoveredBytes,0);
});
test('6E: imported WAD removal remaps other pending texture indices consistently through undo and redo',()=>{
 const list=[{name:'BRICK01',width:64,height:64,wad:'a.wad'}, {name:'STONE01',width:64,height:64,wad:'b.wad'}, {name:'METAL01',width:64,height:64,wad:'c.wad'}];
 const past={7:{s:[1,0,0,0],t:[0,1,0,0],texture:102}};
 const present={7:{...past[7],texture:101}};
 const next={7:{...past[7],texture:101}};
 const plan=planBspImportedWadRemoval(100,list,'a.wad',[past,present,next],101);
 assert.equal(plan.removedTextures,1);
 assert.equal(plan.retained.length,2);
 assert.deepEqual(plan.states.map(s=>s[7].texture),[101,100,100]);
 assert.equal(plan.selectedTexture,100);
});
test('6E: WAD removal safely remaps a later file even if a previously shadowed duplicate becomes visible',()=>{
 const previous=[{name:'SAME',width:64,height:64,wad:'first.wad'},{name:'UNIQUE',width:64,height:64,wad:'second.wad'}];
 const next=[{name:'UNIQUE',width:64,height:64,wad:'second.wad'},{name:'SAME',width:64,height:64,wad:'second.wad'}];
 const state={10:{s:[0,1,0,0],t:[1,0,0,0],texture:31}};
 const result=planBspImportedWadRemoval(30,previous,'first.wad',[state],31,next);
 assert.equal(result.states[0][10].texture,30);
 assert.equal(result.selectedTexture,30);
 assert.equal(result.retained[1].name,'SAME');
});
test('6E: cannot remove an imported WAD referenced by a pending or undoable face',()=>{
 const list=[{name:'BRICK01',width:64,height:64,wad:'a.wad'},{name:'STONE01',width:64,height:64,wad:'b.wad'}];
 const old={8:{s:[1,0,0,0],t:[0,1,0,0],texture:10}};
 assert.throws(()=>planBspImportedWadRemoval(10,list,'a.wad',[old,{}]),/pending or undoable/i);
 const ok=planBspImportedWadRemoval(10,list,'b.wad',[old,{}],11);
 assert.equal(ok.selectedTexture,-1,'unapplied chosen material is cleared');
 assert.equal(ok.states[0][8].texture,10);
 assert.equal(planBspImportedWadRemoval(10,[],'empty.wad',[{}]).removedTextures,0);
});
test('6E: BSP UI offers WAD removal in 6 locales and compact export after composing surface+entity edits',()=>{
 const studio=readFileSync(new URL('../src/components/BspTextureStudio.tsx',import.meta.url),'utf8');
 const viewer=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
 for(const locale of ['es','en','ru','ko','zh','pt'])assert.match(studio,new RegExp(`${locale}:\\{library:.*importedWads:`));
 assert.match(studio,/onRemoveImportedWad\(wad\)/);
 assert.match(viewer,/compactBspCopy\(staged\)/);
 assert.match(viewer,/planBspImportedWadRemoval/);
 assert.match(viewer,/setImportedWadAssets\(previous=>previous\.filter/);
});
