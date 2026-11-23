/** HF31: Pure click-placement rules; the live project is never changed by preview. */
import type {MapObject,Vec3} from './types';
import {cs16Armoury,cs16Hostages,cs16Spawns,cs16Zone,type CS16Team,type CS16ZoneKind} from './csMapStudio';

export type CS16PlacementTool='spawns'|'zone'|'armoury'|'hostages';
export type CS16PlacementAction='pick'|'paint';
export type CS16PlacementRequest={
 action:CS16PlacementAction;tool:CS16PlacementTool;repeat:boolean;
 team:CS16Team;quantity:number;columns:number;spacing:number;yaw:number;
 zoneKind:CS16ZoneKind;size:Vec3;armoury:string;weaponCount:number;hostageCount:number;
};
/** A click targets a horizontal floor, never a wall or the underside of a brush.
 * Point entities use their GoldSrc origin, while solid zones take the floor Z. */
export function cs16AnchorAtSurface(surface:Vec3,normal:Vec3,tool:CS16PlacementTool,step:number):Vec3|null{
 if(surface.some(v=>!Number.isFinite(v))||normal.some(v=>!Number.isFinite(v))||normal[2]<.65)return null;
 const snap=Number.isFinite(step)&&step>=1&&step<=512?step:1;
 const p=surface.map(v=>Math.round(v/snap)*snap) as Vec3;
 if(tool==='spawns'||tool==='hostages')p[2]+=36;
 if(tool==='armoury')p[2]+=20;
 return p;
}
export function cs16CreateAt(request:CS16PlacementRequest,anchor:Vec3):MapObject[]{
 switch(request.tool){
  case 'spawns':return cs16Spawns(request.team,request.quantity,anchor,request.spacing,request.columns,request.yaw);
  case 'zone':return cs16Zone(request.zoneKind,anchor,request.size);
  case 'armoury':return [cs16Armoury(anchor,request.armoury,request.weaponCount,request.yaw)];
  case 'hostages':return cs16Hostages(request.hostageCount,anchor,72,request.yaw);
 }
}
/** Dynamic preview offsets in GoldSrc X/Y/Z, relative to the clicked anchor. */
export function cs16PreviewOffsets(request:CS16PlacementRequest):Vec3[]{
 if(request.tool==='spawns'){
  const count=Math.max(0,Math.min(32,Math.floor(request.quantity)||0));
  const cols=Math.max(1,Math.min(8,Math.floor(request.columns)||1,count||1));
  const rows=Math.ceil(count/cols);
  return Array.from({length:count},(_,i)=>{
   const row=Math.floor(i/cols),col=i%cols,rowCount=Math.min(cols,count-row*cols);
   return [(col-(rowCount-1)/2)*request.spacing,(row-(rows-1)/2)*request.spacing,0];
  });
 }
 if(request.tool==='hostages')return Array.from({length:Math.max(0,Math.min(8,Math.floor(request.hostageCount)||0))},(_,i)=>[(i-(request.hostageCount-1)/2)*72,0,0]);
 return [[0,0,0]];
}
