import type {BspEntity,BspFace} from './bsp';

/** GoldSrc standard lightstyle patterns. Style 0 is always steady. Named styles
 * (32+) use the compiled entity's pattern or an initially-off spawnflag.
 * This is a SNAPSHOT of the compiled layers, not dynamic engine rendering. */
const PATTERNS:Record<number,string>={
  0:'m',1:'mmnmmommommnonmmonqnmmo',
  2:'abcdefghijklmnopqrstuvwxyzyxwvutsrqponmlkjihgfedcba',
  3:'mmmmmaaaaammmmmaaaaaabcdefgabcdefg',4:'mamamamamama',
  5:'jklmnopqrstuvwxyzyxwvutsrqponmlkj',6:'nmonqnmomnmomomno',
  7:'mmmaaaabcdefgmmmmaaaammmaamm',8:'mmmaaammmaaammmabcdefaaaammmmabcdefmmmaaaa',
  9:'aaaaaaaazzzzzzzz',10:'mmamammmmammamamaaamammma',
  11:'abcdefghijklmnopqrrqponmlkjihgfedcba'
};
export function bspLightstyleWeight(style:number,frame:number,entities:readonly BspEntity[]=[]):number{
  if(style===0)return 1;
  if(!Number.isInteger(style)||style<0||style>254)return 0;
  const entity=style>=32?entities.find(item=>Number(item.properties.style)===style&&item.classname.startsWith('light')):undefined;
  const pattern=entity?.properties.pattern?.toLowerCase()||PATTERNS[style];
  if(!pattern){return entity&&Number(entity.properties.spawnflags||0)&1?0:1;}
  const char=pattern[Math.abs(Math.floor(frame))%pattern.length];
  return char>='a'&&char<='z'?(char.charCodeAt(0)-97)/12:1;
}
/** Recombine the actual per-style RGB lightmap samples at a selected snapshot
 * tick. Raw color values still pass through the browser display pipeline. */
export function composeBspFaceLighting(face:BspFace,entities:readonly BspEntity[]=[],frame=0):Uint8Array|undefined{
  const layers=face.lightLayers;
  if(!layers?.length)return face.lightRgb;
  if(layers.length===1&&(!face.lightStyles?.length||face.lightStyles[0]===0))return layers[0];
  const result=new Uint8Array(layers[0].length);
  for(let i=0;i<layers.length;i++){
    const layer=layers[i];if(layer.length!==result.length)continue;
    const weight=bspLightstyleWeight(face.lightStyles?.[i]??0,frame,entities);
    if(weight===0)continue;
    for(let k=0;k<result.length;k++)result[k]=Math.min(255,result[k]+Math.round(layer[k]*weight));
  }
  return result;
}
export function bspLightstyleStats(faces:readonly BspFace[]){
  let multiStyleFaces=0,animatedFaces=0;
  const styles=new Set<number>();
  for(const face of faces){
    if((face.lightStyles?.length||0)>1)multiStyleFaces++;
    if(face.lightStyles?.some(s=>s>0)){animatedFaces++;face.lightStyles.filter(s=>s>0).forEach(s=>styles.add(s))}
  }
  return {multiStyleFaces,animatedFaces,styles:[...styles].sort((a,b)=>a-b)};
}
