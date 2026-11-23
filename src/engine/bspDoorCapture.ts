/** v2.6 "Complete door" capture: every leaf of the door (double doors, glass panes sharing the
 * targetname), the buttons right next to it and the world frame around it, as one prefab.
 * Leaves and buttons become real solids (Hull 0) that keep their entity; the frame comes from the
 * world solids inside a box around the door (walls and floor crossing the box are left out). */
import type {BspFace,BspMap} from './bsp';
import {bspOriginalFaceIndex} from './bspFaceSelection';
import {recoverSolidSubmodelHull0,recoverSolidWorldHull0InBox} from './bspHull0Recovery';
import {createBrush} from './geometry';
import {uid,type Brush,type MapObject,type PointEntity,type Vec3} from './types';

type Ent={classname:string;origin?:Vec3;properties:Record<string,string>};
export type BspDoorPart={model:number;classname:string;props:Record<string,string>;origin:Vec3;role:'leaf'|'button'};
/** frame 'cut': a piece of the surrounding wall clipped by the box; 'separate': only frame solids that do not touch the box. */
export type BspDoorPlan={parts:BspDoorPart[];box:{lo:Vec3;hi:Vec3};frame:'cut'|'separate'|'none'};
export const DOOR_CLASS=/^(func_door|func_door_rotating|momentary_door|func_wall_toggle|func_water)$/;
const BUTTON_CLASS=/^(func_button|func_rot_button|momentary_rot_button)$/;
const vec=(t?:string):Vec3=>{const v=(t||'').trim().split(/\s+/).map(Number);return v.length===3&&v.every(Number.isFinite)?v as Vec3:[0,0,0];};
const modelOf=(e:Ent)=>{const m=/^\*(\d+)$/.exec(e.properties.model||'');return m?Number(m[1]):0;};

function modelBounds(faces:readonly BspFace[],model:number,origin:Vec3){
  const lo:Vec3=[Infinity,Infinity,Infinity],hi:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const f of faces)if(f.model===model)for(const p of f.points)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]+origin[i]);hi[i]=Math.max(hi[i],p[i]+origin[i]);}
  return Number.isFinite(lo[0])?{lo,hi}:null;
}
const touches=(a:{lo:Vec3;hi:Vec3},b:{lo:Vec3;hi:Vec3},pad:number)=>a.lo.every((v,i)=>v<=b.hi[i]+pad&&a.hi[i]>=b.lo[i]-pad);

/** Plans the capture from the clicked faces. Returns null when the selection is not a door entity. */
export function bspDoorPlan(faces:readonly BspFace[],selected:readonly number[],entities:readonly Ent[],frameMargin=32,frame:BspDoorPlan['frame']='cut'):BspDoorPlan|null{
  const byId=new Map(faces.map((f,i)=>[bspOriginalFaceIndex(f,i),f]));
  const models=new Set(selected.map(id=>byId.get(id)?.model).filter((m):m is number=>m!==undefined));
  if(models.size!==1)return null;const model=[...models][0];if(model<=0)return null;
  const main=entities.find(e=>modelOf(e)===model);if(!main||!DOOR_CLASS.test(main.classname))return null;
  const bound=(e:Ent)=>modelBounds(faces,modelOf(e),vec(e.properties.origin));
  const mainBox=bound(main);if(!mainBox)return null;
  const name=main.properties.targetname?.trim();
  const leaves=entities.filter(e=>modelOf(e)>0&&DOOR_CLASS.test(e.classname)&&(e===main||(!!name&&e.properties.targetname===name&&(()=>{const b=bound(e);return !!b&&touches(b,mainBox,256);})())||(()=>{const b=bound(e);return !!b&&touches(b,mainBox,4);})()));
  const lo:Vec3=[Infinity,Infinity,Infinity],hi:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const e of leaves){const b=bound(e);if(!b)continue;for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],b.lo[i]);hi[i]=Math.max(hi[i],b.hi[i]);}}
  if(hi.some((v,i)=>v-lo[i]>4000))return null;
  // Bottom of the box = bottom of the door, so the floor is not taken; sides and top take the frame / wall around it.
  const box={lo:[lo[0]-frameMargin,lo[1]-frameMargin,frame==='cut'?lo[2]:lo[2]-8] as Vec3,hi:[hi[0]+frameMargin,hi[1]+frameMargin,hi[2]+frameMargin] as Vec3};
  const near={lo:lo.map(v=>v-128) as Vec3,hi:hi.map(v=>v+128) as Vec3};
  const names=new Set(leaves.map(e=>e.properties.targetname).filter(Boolean));
  const buttons=entities.filter(e=>modelOf(e)>0&&BUTTON_CLASS.test(e.classname)&&names.has(e.properties.target||'')&&(()=>{const b=bound(e);return !!b&&touches(b,near,0);})());
  const parts:BspDoorPart[]=[...leaves.map(e=>({model:modelOf(e),classname:e.classname,props:{...e.properties},origin:vec(e.properties.origin),role:'leaf' as const})),
    ...buttons.map(e=>({model:modelOf(e),classname:e.classname,props:{...e.properties},origin:vec(e.properties.origin),role:'button' as const}))];
  return {parts,box,frame};
}

/** Builds the geometry + entities of a planned door (world coordinates). */
export function bspBuildDoor(map:BspMap,source:ArrayBuffer,plan:BspDoorPlan,label:string):{objects:MapObject[];brushes:Brush[];leaves:number;buttons:number;frameSolids:number;warnings:string[]}{
  const objects:MapObject[]=[],brushes:Brush[]=[],warnings:string[]=[];let leaves=0,buttons=0;
  for(const part of plan.parts){
    const ids=map.faces.map((f,i)=>f.model===part.model?bspOriginalFaceIndex(f,i):-1).filter(i=>i>=0);
    let cells:Brush[];
    try{cells=recoverSolidSubmodelHull0(map,source,ids,`${label} ${part.classname}`,true).brushes;}
    catch(e){warnings.push(`${part.classname} *${part.model}: ${e instanceof Error?e.message:String(e)}`);continue;}
    const id=uid();const o=part.origin;const moved=o.some(v=>Math.abs(v)>1e-6);
    for(const b of cells){b.entityId=id;if(moved)b.position=[b.position[0]+o[0],b.position[1]+o[1],b.position[2]+o[2]];brushes.push(b);objects.push(b);}
    if(moved&&part.classname!=='func_door'){const ob=createBrush('box',[...o],[8,8,8],`${label} origin`);ob.faces.forEach(f=>f.texture='ORIGIN');ob.entityId=id;objects.push(ob);}
    const props=Object.fromEntries(Object.entries(part.props).filter(([k])=>!['classname','model','origin'].includes(k)));
    const c=[0,1,2].map(i=>{const v=cells.flatMap(b=>b.vertices.map(p=>p[i]+b.position[i]));return (Math.min(...v)+Math.max(...v))/2;}) as Vec3;
    objects.push({id,kind:'entity',name:part.classname,classname:part.classname,position:c,props,layer:'Recovered BSP'} as PointEntity);
    if(part.role==='leaf')leaves++;else buttons++;
  }
  if(!leaves)throw Error(`The door leaves could not be rebuilt. ${warnings[0]??''}`);
  let frameSolids=0;
  if(plan.frame!=='none')try{const frame=recoverSolidWorldHull0InBox(map,source,[],`${label} frame`,0,plan.box,plan.frame==='cut');for(const b of frame.brushes){brushes.push(b);objects.push(b);}frameSolids=frame.brushes.length;}
  catch(e){warnings.push(`Frame: ${e instanceof Error?e.message:String(e)}`);}
  if(!frameSolids&&plan.frame!=='none')warnings.push('No separate frame was found around the door (it may be part of a continuous wall). Only the door was saved.');
  return {objects,brushes,leaves,buttons,frameSolids,warnings};
}

/* v2.6 batch extraction --------------------------------------------------------------------- */
export type BspBatchCandidate={key:string;kind:'door'|'object';title:string;classname:string;faceIds:number[];leaves:number;category:string};
const OBJECT_CLASS=/^(func_wall|func_illusionary|func_breakable|func_button|func_rot_button|func_rotating|func_pushable|func_wall_toggle|func_pendulum|func_conveyor|func_healthcharger|func_recharge)$/;
/** Every door group and every reusable brush-entity object in the BSP, ready to be saved as prefabs. */
export function bspBatchCandidates(faces:readonly BspFace[],entities:readonly Ent[]):BspBatchCandidate[]{
  const firstFace=new Map<number,number>();const counts=new Map<number,number>();
  faces.forEach((f,i)=>{if(f.model<=0)return;counts.set(f.model,(counts.get(f.model)??0)+1);if(!firstFace.has(f.model))firstFace.set(f.model,bspOriginalFaceIndex(f,i));});
  const out:BspBatchCandidate[]=[];const used=new Set<number>();
  for(const e of entities){const m=modelOf(e);if(m<=0||!DOOR_CLASS.test(e.classname)||used.has(m)||!firstFace.has(m))continue;
    const plan=bspDoorPlan(faces,[firstFace.get(m)!],entities);if(!plan)continue;
    const leafModels=plan.parts.filter(p=>p.role==='leaf').map(p=>p.model);leafModels.forEach(x=>used.add(x));plan.parts.forEach(p=>used.add(p.model));
    out.push({key:`door:${leafModels.sort((a,b)=>a-b).join('-')}`,kind:'door',title:`${e.properties.targetname||'door'}_${m}`,classname:e.classname,faceIds:[firstFace.get(m)!],leaves:leafModels.length,category:'doors'});}
  for(const e of entities){const m=modelOf(e);if(m<=0||used.has(m)||!OBJECT_CLASS.test(e.classname))continue;const n=counts.get(m)??0;if(n<4||n>1024)continue;used.add(m);
    const ids=faces.map((f,i)=>f.model===m?bspOriginalFaceIndex(f,i):-1).filter(i=>i>=0);
    const category=/charger|recharge/.test(e.classname)?'computers':/breakable/.test(e.classname)?'decoration':/button/.test(e.classname)?'industrial':'other';
    out.push({key:`model:${m}`,kind:'object',title:`${(e.properties.targetname||e.classname.replace('func_',''))}_${m}`,classname:e.classname,faceIds:ids,leaves:0,category});}
  return out;
}