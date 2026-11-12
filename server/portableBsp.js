/** Rewrites ONLY BSP worldspawn WAD references after isolated compilation.
 * SC-CSG needs an absolute local WAD input; the released BSP must not point at
 * that ephemeral directory. Repack all active lumps with 4-byte alignment.
 */
const BLOCKS=15,HEADER=4+BLOCKS*8;
export function makePortableBsp(bsp,wadName){
 if(!Buffer.isBuffer(bsp)||bsp.length<HEADER||![30,31].includes(bsp.readInt32LE(0)))throw Error('Unsupported/truncated GoldSrc BSP.');
 if(typeof wadName!=='string'||(wadName&&!/^[a-z0-9_.+~()-]{1,100}\.wad$/i.test(wadName)))throw Error('Invalid portable WAD name.');
 const chunks=[];for(let i=0;i<BLOCKS;i++){
  const at=bsp.readInt32LE(4+i*8),length=bsp.readInt32LE(8+i*8);
  if(at<0||length<0||at+length>bsp.length)throw Error(`Invalid BSP lump ${i}.`);
  chunks.push(bsp.subarray(at,at+length));
 }
 const ent=chunks[0].toString('latin1');
 const first=ent.match(/\{[^{}]*"classname"\s+"worldspawn"[^{}]*\}/i)?.[0];
 if(!first)throw Error('Worldspawn is missing from compiled BSP.');
 const next=/"wad"\s+"[^"]*"/i.test(first)?first.replace(/"wad"\s+"[^"]*"/i,`"wad" "${wadName?`${wadName};`:''}"`):first.replace(/"classname"\s+"worldspawn"/i,v=>`${v}\n"wad" "${wadName?`${wadName};`:''}"`);
 chunks[0]=Buffer.from(ent.replace(first,next).replace(/\x00*$/,'')+'\x00','latin1');
 let offset=HEADER;const headers=[];
 for(const data of chunks){offset=(offset+3)&~3;headers.push({offset,length:data.length});offset+=data.length;}
 const out=Buffer.alloc(offset);out.writeInt32LE(bsp.readInt32LE(0),0);
 for(let i=0;i<BLOCKS;i++){out.writeInt32LE(headers[i].offset,4+i*8);out.writeInt32LE(headers[i].length,8+i*8);chunks[i].copy(out,headers[i].offset)}
 return out;
}
