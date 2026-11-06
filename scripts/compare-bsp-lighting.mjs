// Lightmap diagnostics only; reads BSP v30 without modifying any input.
import fs from 'node:fs';
import path from 'node:path';

function parse(file){
 const b=fs.readFileSync(file);
 if(b.length<124||b.readInt32LE(0)!==30)throw Error(`${file}: requires a GoldSrc BSP v30`);
 const lumps=Array.from({length:15},(_,i)=>{
  const offset=b.readInt32LE(4+i*8),length=b.readInt32LE(8+i*8);
  if(offset<0||length<0||offset+length>b.length)throw Error(`${file}: corrupt lump ${i}`);
  return b.subarray(offset,offset+length);
 });
 const light=lumps[8];const hist=new Array(256).fill(0);let sum=0;
 for(const n of light){hist[n]++;sum+=n}
 let mid=0,median=0;
 for(let n=0;n<256;n++){mid+=hist[n];if(mid>=(light.length/2)){median=n;break}}
 let noStyle=0;
 const faces=lumps[7];
 if(faces.length%20!==0)throw Error(`${file}: unusual face lump length`);
 for(let i=0;i<faces.length;i+=20){if(faces[i+12]===255&&faces[i+13]===255&&faces[i+14]===255&&faces[i+15]===255)noStyle++}
 return {filename:path.basename(file),size:b.length,faces:faces.length/20,lightingBytes:light.length,mean:light.length?Number((sum/light.length).toFixed(2)):null,median:light.length?median:null,nearBlackPct:light.length?Number((100*hist.slice(0,8).reduce((a,c)=>a+c,0)/light.length).toFixed(1)):null,facesWithoutLightStyle:noStyle};
}
const files=process.argv.slice(2);
if(files.length<2){console.error('Uso: node scripts/compare-bsp-lighting.mjs osprey.bsp maptest1.bsp maptest1_light15.bsp');process.exit(2)}
try{
 const results=files.map(parse);
 console.table(results);
 console.log('Nota: promedios entre BSP de distinta geometría no equivalen al brillo visual. Inspeccioná las mismas ubicaciones dentro de Sven Co-op.');
}catch(e){console.error(String(e.message||e));process.exit(1)}
