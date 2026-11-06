/**
 * SvenStudio Gameplay Test — read-only editor simulation (not the Svengine runtime).
 * Never mutates MapObject, keyvalues, brushes, or exported Valve 220 data.
 * Only a conservative whitelist of known GoldSrc activation flows is simulated.
 */
import type {MapObject,Brush,PointEntity,Vec3} from './types';
import {transformedVertices} from './geometry';
import {doorMotionOffsetYaw} from './doorDirection.ts';

const isEntity=(o:MapObject):o is PointEntity=>o.kind==='entity';
const isBrush=(o:MapObject):o is Brush=>o.kind==='brush';
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
export type GameplayFeedback={kind:'success'|'warning';message:string};
export type DoorState={fraction:number;goal:number;duration:number;hold:number;offset:Vec3};
export type GameplayAction={entityId:string;classname:string};
export const GAMEPLAY_CLASSES={interactive:['func_button','func_rot_button','func_door'],triggers:['trigger_once','trigger_multiple']} as const;

function bounds(brush:Brush){
  const vertices=transformedVertices(brush);
  return {min:[0,1,2].map(i=>Math.min(...vertices.map(p=>p[i]))) as Vec3,max:[0,1,2].map(i=>Math.max(...vertices.map(p=>p[i]))) as Vec3};
}
export function gameplayDoorOffset(entity:PointEntity,brush:Brush):Vec3{
  // This is a predictable *visual estimate*, not GoldSrc's internal movedir.
  const points=bounds(brush),dimensions=points.min.map((n,i)=>points.max[i]-n);
  const yaw=doorMotionOffsetYaw(entity.props);
  const angle=Number.isFinite(yaw)?yaw:0;
  const dir:Vec3=angle===-1?[0,0,1]:angle===-2?[0,0,-1]:[Math.cos(angle*Math.PI/180),Math.sin(angle*Math.PI/180),0];
  const extent=Math.abs(dir[0])*dimensions[0]+Math.abs(dir[1])*dimensions[1]+Math.abs(dir[2])*dimensions[2];
  const lip=Number(entity.props.lip??8);
  const distance=Math.max(1,extent-(Number.isFinite(lip)?lip:8));
  return dir.map(v=>v*distance) as Vec3;
}
function center(brush:Brush):Vec3{const b=bounds(brush);return b.min.map((x,i)=>(x+b.max[i])/2) as Vec3}
export function gameplayTargets(target:string|undefined,entities:PointEntity[]){
  const name=(target||'').trim().toLowerCase();
  if(!name)return [];
  return entities.filter(e=>{const id=(e.props.targetname||'').trim().toLowerCase();return !!id&&(name.endsWith('*')?id.startsWith(name.slice(0,-1)):id===name)});
}
export class GameplaySession {
  readonly entities:PointEntity[];
  readonly brushes:Brush[];
  readonly doors=new Map<string,DoorState>();
  readonly events=new Set<string>();
  readonly triggerTimes=new Map<string,number>();
  readonly triggerVolumes:Array<{entity:PointEntity;boxes:ReturnType<typeof bounds>[]}>;
  readonly actions:GameplayAction[]=[];
  elapsed=0;
  feedback:GameplayFeedback|null=null;
  constructor(readonly objects:MapObject[]){
    this.entities=objects.filter(isEntity).filter(e=>!e.hidden);
    this.brushes=objects.filter(isBrush).filter(b=>!b.hidden);
    // Precompute trigger AABBs once, never rebuild all brush geometry each frame.
    const triggers=this.entities.filter(e=>GAMEPLAY_CLASSES.triggers.includes(e.classname as typeof GAMEPLAY_CLASSES.triggers[number]));
    this.triggerVolumes=triggers.map(entity=>({entity,boxes:this.brushes.filter(b=>b.entityId===entity.id).map(bounds)}));
    for(const entity of this.entities){
      if(!['func_door'].includes(entity.classname))continue;
      const part=this.brushes.find(b=>b.entityId===entity.id);
      if(!part)continue;
      const offset=gameplayDoorOffset(entity,part);
      const distance=Math.hypot(...offset);
      const speed=Number(entity.props.speed||100);
      const duration=clamp(distance/Math.max(1,Number.isFinite(speed)?speed:100),.1,20);
      const open=(Number(entity.props.spawnflags||0)&1)!==0;
      this.doors.set(entity.id,{fraction:open?1:0,goal:open?1:0,duration,hold:0,offset});
    }
  }
  /** Entity graph execution: only documented target-firing classes, bounded against cycles. */
  activate(id:string):GameplayFeedback{
    const entity=this.entities.find(e=>e.id===id);
    if(!entity)return this.note('warning','Entity is not available in this test.');
    if(![...GAMEPLAY_CLASSES.interactive,...GAMEPLAY_CLASSES.triggers,'trigger_relay'].includes(entity.classname))
      return this.note('warning',`${entity.classname}: test simulation not available; try in Sven Co-op.`);
    this.fire(entity,new Set(),0);
    return this.feedback||this.note('success',`${entity.classname}: activated (approximate).`);
  }
  private note(kind:GameplayFeedback['kind'],message:string){this.feedback={kind,message};return this.feedback}
  private fire(e:PointEntity,visited:Set<string>,depth:number){
    if(depth>=12||visited.has(e.id))return;
    visited.add(e.id);
    const classname=e.classname;
    if(classname==='func_door'||classname==='func_door_rotating'){
      const door=this.doors.get(e.id);
      if(!door)return;
      door.goal=door.goal>.5?0:1;door.hold=0;
      this.actions.push({entityId:e.id,classname});
      this.note('success',`Door: ${door.goal?'opening':'closing'} (preview).`);
      return;
    }
    if(classname==='trigger_once'&&this.events.has(e.id))return;
    if(classname==='trigger_once')this.events.add(e.id);
    if(!['func_button','func_rot_button','trigger_once','trigger_multiple','trigger_relay'].includes(classname)){
      this.note('warning',`${classname}: simulate in Sven Co-op.`);return;
    }
    this.actions.push({entityId:e.id,classname});
    const matches=gameplayTargets(e.props.target,this.entities);
    if(!matches.length){this.note('warning',`${classname}: no supported target found.`);return;}
    for(const match of matches)this.fire(match,visited,depth+1);
  }
  /** In the editor the trigger volume is a brush bound to the entity. */
  enterVolumes(player:Vec3){
    for(const {entity:e,boxes} of this.triggerVolumes){
      const last=this.triggerTimes.get(e.id)??-1000;
      if(e.classname==='trigger_once'&&this.events.has(e.id))continue;
      const cooldown=clamp(Number(e.props.wait)||.2,.2,60);
      if(this.elapsed-last<cooldown)continue;
      if(!boxes.some(box=>player.every((v,i)=>v>=box.min[i]-.5&&v<=box.max[i]+.5)))continue;
      this.triggerTimes.set(e.id,this.elapsed);this.fire(e,new Set(),0);
    }
  }
  step(delta:number){
    const dt=clamp(delta,0,.1);this.elapsed+=dt;
    for(const [id,state] of this.doors){
      if(state.fraction!==state.goal){
        const distance=dt/state.duration;
        state.fraction=state.goal>state.fraction?Math.min(state.goal,state.fraction+distance):Math.max(state.goal,state.fraction-distance);
      }else if(state.goal===1){
        const entity=this.entities.find(e=>e.id===id);
        const wait=Number(entity?.props.wait??3);
        if(Number.isFinite(wait)&&wait>=0 && !(Number(entity?.props.spawnflags||0)&32)){
          state.hold+=dt;if(state.hold>=wait){state.goal=0;state.hold=0}
        }
      }
    }
  }
  isDoorOpen(id?:string){return !!id && (this.doors.get(id)?.fraction||0)>.90}
  doorOffset(id?:string):Vec3{
    const door=id?this.doors.get(id):undefined;
    return door?door.offset.map(n=>n*door.fraction) as Vec3:[0,0,0];
  }
  /** Player E: first raycast hit determines interaction. No through-wall button activation. */
  getAction(brushId:string):GameplayAction|null{
    const part=this.brushes.find(b=>b.id===brushId);
    if(!part?.entityId)return null;
    const e=this.entities.find(entity=>entity.id===part.entityId);
    if(!e||!GAMEPLAY_CLASSES.interactive.includes(e.classname as typeof GAMEPLAY_CLASSES.interactive[number]))return null;
    return {entityId:e.id,classname:e.classname};
  }
  getBrushCenter(brushId:string){const part=this.brushes.find(b=>b.id===brushId);return part?center(part):null}
}
