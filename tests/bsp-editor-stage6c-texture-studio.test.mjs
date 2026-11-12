import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBsp} from '../src/engine/bsp.ts';
import {readNativeBsp,writeNativeBsp,setNativeValue} from '../src/engine/bspNativeEdit.ts';
import {bspApplySurfaceOperation,writeBspSurfaceEdits} from '../src/engine/bspSurfaceEdit.ts';
import {selectBspWadMipTextures,writeBspEmbeddedTextures,writeBspWadSurfaceCopy} from '../src/engine/bspTextureEmbedding.ts';
import {bspUvGestureOperation} from '../src/engine/bspUvWidget.ts';
import {pinUvAnchor,clampUvWidgetPosition} from '../src/engine/uvOverlay.ts';
const fixture=readFileSync(new URL('./fixtures/maptest1_lighting_v159.bsp',import.meta.url));
const source=()=>fixture.buffer.slice(fixture.byteOffset,fixture.byteOffset+fixture.byteLength);
const op=texture=>({texture,offsetU:0,offsetV:0,rotation:0,scaleU:1,scaleV:1});
function newWad(name='SV_NEWBRK',width=64,height=128){
 const sizes=[width*height,width*height/4,width*height/16,width*height/64];
 const offsets=[40];for(let i=1;i<4;i++)offsets.push(offsets[i-1]+sizes[i-1]);
 const paletteAt=offsets[3]+sizes[3],texture=Buffer.alloc(paletteAt+2+768);
 texture.write(name,0,'latin1');texture.writeUInt32LE(width,16);texture.writeUInt32LE(height,20);
 for(let i=0;i<4;i++)texture.writeUInt32LE(offsets[i],24+i*4);
 for(let i=0;i<4;i++)texture.fill(i*3+17,offsets[i],offsets[i]+sizes[i]);
 texture.writeUInt16LE(256,paletteAt);
 for(let i=0;i<256;i++){
   texture[paletteAt+2+i*3]=(i*7)%256;
   texture[paletteAt+3+i*3]=(i*3)%256;
   texture[paletteAt+4+i*3]=(i*5)%256;
 }
 const wad=Buffer.alloc(12+texture.length+32),dir=12+texture.length;
 wad.write('WAD3',0);wad.writeInt32LE(1,4);wad.writeInt32LE(dir,8);
 texture.copy(wad,12);wad.writeInt32LE(12,dir);wad.writeInt32LE(texture.length,dir+4);
 wad.writeInt32LE(texture.length,dir+8);wad[dir+12]=0x43;wad.write(name,dir+16);
 return {wad:new Uint8Array(wad),raw:texture,name,width,height};
}
const section=(buffer,id)=>{const v=new DataView(buffer),at=v.getInt32(4+8*id,true),size=v.getInt32(8+8*id,true);return new Uint8Array(buffer,at,size)};
test('6C: WAD3 palette, mip data and texinfo persist in a new BSP copy even with different texture dimensions',()=>{
 const raw=source(),original=parseBsp(raw),custom=newWad();
 assert.ok(!original.textures.some(tex=>tex.name===custom.name));
 const extended={...original,textures:[...original.textures,{name:custom.name,width:custom.width,height:custom.height,external:true}]};
 const staged=bspApplySurfaceOperation(extended,{},[0],op(original.textures.length));
 const result=writeBspWadSurfaceCopy(raw,staged,[custom],[custom.wad],writeBspSurfaceEdits);
 const out=parseBsp(result),native=readNativeBsp(result);
 assert.equal(native.entities.length,readNativeBsp(raw).entities.length);
 assert.equal(out.textures.length,original.textures.length+1);
 assert.equal(out.faces.find(face=>face.bspFaceIndex===0).texture,original.textures.length);
 assert.equal(out.textures.at(-1).name,custom.name);
 assert.ok(out.textures.at(-1).rgba&&!out.textures.at(-1).external);
 const texLump=section(result,2),texView=new DataView(texLump.buffer,texLump.byteOffset),off=texView.getInt32(4+original.textures.length*4,true);
 assert.deepEqual(texLump.subarray(off,off+custom.raw.length),new Uint8Array(custom.raw));
 assert.deepEqual(section(result,4),section(raw,4),'VIS is byte-for-byte identical');
 assert.deepEqual(section(result,8),section(raw,8),'original lighting lump preserved');
 assert.deepEqual(section(result,9),section(raw,9),'original clipnodes preserved');
 assert.equal(out.faces.find(face=>face.bspFaceIndex===0).lightmapOffset,original.faces.find(face=>face.bspFaceIndex===0).lightmapOffset);
 assert.deepEqual(new Uint8Array(raw),new Uint8Array(source()),'the source file remains untouched');
});
test('6C: imported WAD texture and native entity edits coexist without touching the source BSP',()=>{
 const raw=source(),original=parseBsp(raw),doc=readNativeBsp(raw),texture=newWad('SV_DETAIL09');
 const index=doc.entities.findIndex((entity,i)=>i>0&&entity.pairs.some(pair=>pair.key==='origin'));
 assert.ok(index>0);
 const key=doc.entities[index].pairs.findIndex(pair=>pair.key==='origin');
 const entityChanged=writeNativeBsp(setNativeValue(doc,index,key,'40 80 120'));
 const extended={...original,textures:[...original.textures,{name:texture.name,width:texture.width,height:texture.height,external:true}]};
 const surfaces=bspApplySurfaceOperation(extended,{},[0],{...op(original.textures.length),offsetU:16});
 const exported=writeBspWadSurfaceCopy(entityChanged,surfaces,[texture],[texture.wad],writeBspSurfaceEdits);
 const reopened=parseBsp(exported);
 assert.equal(reopened.entities[index].properties.origin,'40 80 120');
 assert.equal(reopened.faces.find(face=>face.bspFaceIndex===0).texture,original.textures.length);
 assert.equal(reopened.textures.at(-1).name,texture.name);
 assert.deepEqual(section(exported,4),section(raw,4));
 assert.deepEqual(section(exported,9),section(raw,9));
 assert.deepEqual(new Uint8Array(source()),new Uint8Array(raw));
});
test('6C: do not embed unused imported WADs, or reorder existing texture indices',()=>{
 const raw=source(),original=parseBsp(raw),first=newWad('SV_NEWBRK'),second=newWad('SV_NEWMTL');
 const extended={...original,textures:[...original.textures,...[first,second].map(t=>({name:t.name,width:t.width,height:t.height,external:true}))]};
 const changes=bspApplySurfaceOperation(extended,{},[0],op(original.textures.length+1));
 const out=parseBsp(writeBspWadSurfaceCopy(raw,changes,[first,second],[first.wad,second.wad],writeBspSurfaceEdits));
 assert.equal(out.textures.length,original.textures.length+1);
 assert.equal(out.textures.at(-1).name,second.name);
 assert.equal(out.faces[0].texture,original.textures.length);
 assert.deepEqual(out.textures.slice(0,original.textures.length).map(t=>t.name),original.textures.map(t=>t.name));
});
test('6C: malformed or ambiguous WAD entries are refused before writing',()=>{
 const raw=source(),tex=newWad();const valid={name:tex.name,width:tex.width,height:tex.height};
 assert.throws(()=>selectBspWadMipTextures([], [valid]),/missing/i);
 assert.throws(()=>selectBspWadMipTextures([tex.wad],[valid,valid]),/Duplicate/i);
 const changed=Uint8Array.from(tex.wad),paletteAt=12+tex.raw.length-768;changed[paletteAt]^=1;
 assert.throws(()=>selectBspWadMipTextures([tex.wad,changed],[valid]),/Ambiguous/i);
 assert.throws(()=>writeBspEmbeddedTextures(raw,[{...valid,name:'!WATER',raw:tex.raw}]),/unsupported/i);
});
test('6C: surface edit cannot enable a special material or change its rendering family',()=>{
 const original=parseBsp(source()),bad={...original,textures:[...original.textures,{name:'!WATER',width:64,height:64,external:true}]};
 assert.throws(()=>bspApplySurfaceOperation(bad,{},[0],op(original.textures.length)),/Texture replacement/i);
});
test('6C: UV gesture helper maintains backward-compatible snap option and camera-independent pin stays fixed',()=>{
 const move=bspUvGestureOperation('move',25,-20,false,false);
 assert.equal(move.offsetU,20);assert.equal(move.offsetV,16);
 const lit=bspUvGestureOperation('move',25,-20,false,true);
 assert.deepEqual([lit.offsetU,lit.offsetV],[16,16]);
 assert.equal(bspUvGestureOperation('rotate',30,0,false,false).rotation,16.5);
 assert.equal(bspUvGestureOperation('ne',180,-180,true,false).scaleU,bspUvGestureOperation('ne',180,-180,true,false).scaleV);
 const pin=pinUvAnchor({x:300,y:220},{left:100,top:20,width:600,height:400},600,400);
 assert.deepEqual(pin,{x:200,y:200});
 const fixed=clampUvWidgetPosition(pin,600,400);assert.deepEqual(fixed,pin);
});
test('6C: BSP studio uses screen overlay, six locales, independent positions, and guarded Alt pointer handling',()=>{
 const component=readFileSync(new URL('../src/components/BspTextureStudio.tsx',import.meta.url),'utf8');
 const viewer=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
 for(const locale of ['es','en','ru','ko','zh','pt'])assert.ok(component.includes(locale+':{library:'),locale);
 for(const fragment of ['svenstudio:bsp-uv-widget-position-v1','svenstudio:bsp-texture-panel-v1','svenstudio:bsp-wad-library-v1','texture-uv-drag-header','onPointerCancel','onLostPointerCapture','ResizeObserver','bsp-texture-uv-screen-overlay','BSP_PRESET_KEY','pointerup','pointercancel','blur'])assert.ok(component.includes(fragment),fragment);
 assert.match(viewer,/e\.nativeEvent\.altKey/);assert.match(viewer,/e\.target\.setPointerCapture|setPointerCapture\?\./);
 assert.match(viewer,/uvDragging/);assert.match(viewer,/writeBspWadSurfaceCopy/);assert.match(viewer,/finishAltRef/);
});
