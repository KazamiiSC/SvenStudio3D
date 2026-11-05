/** Editor-only, deterministic first-person preview physics.
 * All coordinates are Three.js world coordinates (Y up, X/Z horizontal).
 * The map/brushes are never mutated or exported by this module.
 * Axis-aligned bounds intentionally approximate rotated/curved brushes;
 * these are not GoldSrc hulls or server physics.
 */
export type WalkVec3=[number,number,number];
export type WalkCollider={min:WalkVec3;max:WalkVec3};
export type WalkPose={position:WalkVec3;velocityY:number;grounded:boolean;crouched:boolean};
export type WalkInput={forward:number;strafe:number;yaw:number;run:boolean;crouch:boolean;jump:boolean;speed?:number;runMultiplier?:number;crouchMultiplier?:number};
export const WALK={radius:16,standHeight:72,crouchHeight:36,standEye:64,crouchEye:29,
  walkSpeed:210,runSpeed:340,crouchSpeed:105,gravity:800,jumpSpeed:290,stepHeight:18} as const;
const EPS=.025;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
export function walkCollider(vertices:WalkVec3[]):WalkCollider|null{
  if(vertices.length<4||!vertices.every(v=>v.length===3&&v.every(Number.isFinite)))return null;
  const min:WalkVec3=[Infinity,Infinity,Infinity],max:WalkVec3=[-Infinity,-Infinity,-Infinity];
  for(const point of vertices)for(let i=0;i<3;i++){
    min[i]=Math.min(min[i],point[i]);max[i]=Math.max(max[i],point[i]);
  }
  return min.every((v,i)=>max[i]-v>1e-4)?{min,max}:null;
}
function diskTouches(p:WalkVec3,b:WalkCollider){
  const dx=p[0]-clamp(p[0],b.min[0],b.max[0]);
  const dz=p[2]-clamp(p[2],b.min[2],b.max[2]);
  return dx*dx+dz*dz<(WALK.radius-EPS)**2;
}
export function walkIntersects(p:WalkVec3,height:number,b:WalkCollider){
  return p[1]+height>b.min[1]+EPS&&p[1]<b.max[1]-EPS&&diskTouches(p,b);
}
export function canStandWalk(p:WalkVec3,height:number,bounds:WalkCollider[]){
  return !bounds.some(b=>walkIntersects(p,height,b));
}
export function walkGroundAt(p:WalkVec3,bounds:WalkCollider[],maxDrop=.12):number|null{
  let result:number|null=null;
  for(const b of bounds){
    const top=b.max[1];
    if(top>p[1]+EPS||top<p[1]-maxDrop||!diskTouches(p,b))continue;
    result=Math.max(result??-Infinity,top);
  }
  return result;
}
export function chooseWalkStart(position:WalkVec3,bounds:WalkCollider[]):WalkPose{
  const positionCopy:[number,number,number]=[...position];
  // GoldSrc player starts often sit 16–48 units above floor. Drop onto the
  // nearest solid top beneath the spawn, never a roof far above the player.
  let floor=-Infinity;
  for(const b of bounds){
    if(b.max[1]>position[1]+16||b.max[1]<position[1]-128||!diskTouches(position,b))continue;
    const candidate:WalkVec3=[position[0],b.max[1]+EPS,position[2]];
    if(canStandWalk(candidate,WALK.standHeight,bounds))floor=Math.max(floor,b.max[1]);
  }
  if(Number.isFinite(floor))positionCopy[1]=floor+EPS;
  return {position:positionCopy,velocityY:0,grounded:Number.isFinite(floor),crouched:false};
}
function stepSingle(state:WalkPose,input:WalkInput,bounds:WalkCollider[],dt:number):WalkPose{
  const p:WalkVec3=[...state.position];
  let grounded=state.grounded;
  let crouched=input.crouch||state.crouched&&!canStandWalk(p,WALK.standHeight,bounds);
  const height=crouched?WALK.crouchHeight:WALK.standHeight;
  let vy=state.velocityY;
  if(input.jump&&grounded){grounded=false;vy=WALK.jumpSpeed;}
  const f=clamp(input.forward,-1,1),s=clamp(input.strafe,-1,1);
  const norm=Math.hypot(f,s)||1;
  const base=input.speed??WALK.walkSpeed;
  const speed=(crouched?base*(input.crouchMultiplier??WALK.crouchSpeed/WALK.walkSpeed):input.run?base*(input.runMultiplier??WALK.runSpeed/WALK.walkSpeed):base)*dt;
  const dx=(Math.sin(input.yaw)*f+Math.cos(input.yaw)*s)*speed/norm;
  const dz=(-Math.cos(input.yaw)*f+Math.sin(input.yaw)*s)*speed/norm;
  // Slide along solid obstacles: resolve independent world X and Z movements.
  for(const [axis,delta] of [[0,dx],[2,dz]] as const){
    if(Math.abs(delta)<1e-7)continue;
    const original=p[axis];p[axis]+=delta;
    let colliders=bounds.filter(b=>walkIntersects(p,height,b));
    if(colliders.length&&grounded){
      // GoldSrc-like step-up for short stairs/thresholds, only with headroom.
      const top=Math.max(...colliders.map(b=>b.max[1]));
      if(top>p[1]+EPS&&top-p[1]<=WALK.stepHeight&&canStandWalk([p[0],top+EPS,p[2]],height,bounds)){
        p[1]=top+EPS;colliders=[];
      }
    }
    for(const b of colliders){
      if(delta>0&&original<=b.min[axis]-WALK.radius+EPS)
        p[axis]=Math.min(p[axis],b.min[axis]-WALK.radius);
      else if(delta<0&&original>=b.max[axis]+WALK.radius-EPS)
        p[axis]=Math.max(p[axis],b.max[axis]+WALK.radius);
      else p[axis]=original;
    }
  }
  const onFloor=walkGroundAt(p,bounds);
  if(grounded&&onFloor===null)grounded=false;
  if(grounded){p[1]=onFloor!+EPS;vy=0;}
  else{
    const before=p[1];vy=Math.max(-1400,vy-WALK.gravity*dt);p[1]+=vy*dt;
    if(vy<=0){
      let landing=-Infinity;
      for(const b of bounds){
        if(!diskTouches(p,b)||before<b.max[1]-EPS||p[1]>b.max[1]+EPS)continue;
        landing=Math.max(landing,b.max[1]);
      }
      if(Number.isFinite(landing)){
        p[1]=landing+EPS;vy=0;grounded=true;
      }
    }else{
      let ceiling=Infinity;
      for(const b of bounds){
        if(!diskTouches(p,b)||before+height>b.min[1]+EPS||p[1]+height<b.min[1]-EPS)continue;
        ceiling=Math.min(ceiling,b.min[1]);
      }
      if(Number.isFinite(ceiling)){p[1]=ceiling-height-EPS;vy=0;}
    }
  }
  // Do not exit crouch underneath a low ceiling.
  if(!input.crouch&&crouched&&canStandWalk(p,WALK.standHeight,bounds))crouched=false;
  return {position:p,velocityY:vy,grounded,crouched};
}
export function walkStep(state:WalkPose,input:WalkInput,bounds:WalkCollider[],elapsed:number):WalkPose{
  if(!Number.isFinite(elapsed)||elapsed<=0)return state;
  // Cap wall-clock jumps on tab changes and subdivide to avoid tunneling.
  const dt=Math.min(.08,elapsed),steps=Math.ceil(dt/(1/90));
  let next=state;
  for(let i=0;i<steps;i++)next=stepSingle(next,{...input,jump:i===0&&input.jump},bounds,dt/steps);
  return next;
}
