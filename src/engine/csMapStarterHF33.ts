/** HF33: small, deliberately editable GoldSrc arena, not a BSP compiler or a level-design replacement.
 * Create only native CS 1.6 entities and standard convex world brushes.
 * The selected texture must be provided by an existing configured WAD.
 */
import {createBrush} from './geometry';
import {uid,type Brush,type MapObject,type PointEntity,type Vec3} from './types';
import {cs16Armoury,cs16Hostages,cs16Spawns,cs16Zone,type CS16MapKind} from './csMapStudio';

export type CS16StarterOptions={mode:CS16MapKind;center:Vec3;ctCount:number;tCount:number;texture:string};
export const CS16_ARENA_DIMS={length:2048,width:1280,height:352} as const;
/** Call only on an empty MAP project. This function has no side effects. */
export function createCS16StarterArena(opts:CS16StarterOptions):MapObject[]{
 const {mode,center,ctCount,tCount}=opts;
 if(!(['de','cs','fy','aim'] as string[]).includes(mode))throw Error('CS16_HF33_INVALID_MODE');
 if(!Array.isArray(center)||center.length!==3||center.some(v=>!Number.isFinite(v)||Math.abs(v)>2048))throw Error('CS16_HF33_INVALID_CENTER');
 if(!Number.isInteger(ctCount)||ctCount<1||ctCount>16||!Number.isInteger(tCount)||tCount<1||tCount>16)throw Error('CS16_HF33_INVALID_COUNT');
 const texture=opts.texture.trim().toUpperCase();
 if(!/^[A-Z0-9_+~{}!-]{1,15}$/.test(texture)||/^(AAATRIGGER|NULL|CLIP|ORIGIN|SKY|HINT|SKIP)$/.test(texture))throw Error('CS16_HF33_INVALID_TEXTURE');
 const [x,y,z]=center;const group=`CS 1.6 · ${mode.toUpperCase()} · HF33`;
 const box=(label:string,at:Vec3,size:Vec3):Brush=>{
  const b=createBrush('box',at,size,label);
  b.layer=group;b.group=group;
  b.faces=b.faces.map(face=>({...face,texture}));return b;
 };
 // Six outer faces use full convex solids with touching seams, forming an enclosed room.
 const objects:MapObject[]=[
  box('Arena floor',[x,y,z-32],[2176,1408,64]),
  box('Arena ceiling',[x,y,z+384],[2176,1408,64]),
  box('West wall',[x-1056,y,z+176],[64,1408,352]),
  box('East wall',[x+1056,y,z+176],[64,1408,352]),
  box('North wall',[x,y+672,z+176],[2048,64,352]),
  box('South wall',[x,y-672,z+176],[2048,64,352]),
 ];
 // Cross-cover leaves three long corridors visible, and spawns well clear of solid crates.
 for(const lane of [-1,1])for(const cx of [-340,0,340]){
  objects.push(box(`Cover ${cx}/${lane}`,[x+cx,y+lane*185,z+48],[96,96,96]));
 }
 const add=(items:MapObject[])=>{for(const item of items){item.layer=group;item.group=group;objects.push(item)}};
 add(cs16Spawns('ct',ctCount,[x+768,y,z+36],96,4,180));
 add(cs16Spawns('t',tCount,[x-768,y,z+36],96,4,0));
 const zone=(kind:Parameters<typeof cs16Zone>[0],at:Vec3,size:Vec3)=>add(cs16Zone(kind,at,size));
 zone('buy_ct',[x+768,y,z],[416,420,96]);zone('buy_t',[x-768,y,z],[416,420,96]);
 if(mode==='de'){
  zone('bomb_a',[x+320,y+385,z],[240,240,120]);
  zone('bomb_b',[x+320,y-385,z],[240,240,120]);
 }else if(mode==='cs'){
  zone('rescue',[x+730,y+330,z],[240,240,120]);
  add(cs16Hostages(4,[x-750,y+340,z+36],88,0));
 }else{
  // fy / aim: equipment on each side; no bomb or hostage objectives.
  for(const side of [-1,1])for(const lane of [-1,1]){
   const e=cs16Armoury([x+side*550,y+lane*340,z+36],mode==='aim'?'9':'6',1,side<0?0:180);
   e.layer=group;e.group=group;objects.push(e);
  }
 }
 for(const dx of [-540,0,540]){
  const light:PointEntity={id:uid(),kind:'entity',name:'Arena light',classname:'light',position:[x+dx,y,z+250],props:{'_light':'255 245 220 255'},layer:group,group};
  objects.push(light);
 }
 return objects;
}

export function canCreateCS16Starter(profile:string|undefined,bspMode:boolean,walkMode:boolean,objects:readonly MapObject[]):boolean{
 return profile==='cs16'&&!bspMode&&!walkMode&&objects.length===0;
}
