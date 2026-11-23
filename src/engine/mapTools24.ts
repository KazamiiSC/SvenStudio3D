/** v2.4 map tools: spiral stairs, rocks/rubble, scatter, free clip plane and the player-size check.
 * Every generator returns closed, planar, convex brushes validated with validateBrush, so the result
 * compiles like any other brush. Nothing here touches the project directly: the store applies the
 * result as one undoable step.
 */
import * as THREE from 'three';
import {orientFaces,createBrush,transformedVertices,rotateBrushTextureLock} from './geometry';
import {clipConvex} from './advancedModeling';
import {validateBrush} from './exportMap';
import {solidBrush,COOP_HULL} from './coopPlaytest';
import {uid} from './types';
import type {Brush,Face,MapObject,PointEntity,Project,Vec3} from './types';

const r2=(n:number)=>Math.round(n*100)/100;
const textureOk=(t:string)=>/^[a-zA-Z0-9_!{}+\-~]{1,32}$/.test(t);
/** Small deterministic RNG so the same seed always gives the same layout. */
export function seededRandom(seed:number){
  let a=(Math.floor(seed)||1)>>>0;
  return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function polyBrush(vertices:Vec3[],faces:number[][],texture:string,name:string):Brush{
  const brush:Brush={id:uid(),kind:'brush',name,primitive:'poly',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices,
    faces:orientFaces(vertices,faces.map(indices=>({indices,texture} as Face))),layer:'Geometry'};
  const problems=validateBrush(brush);if(problems.length)throw Error(`${name}: ${problems[0]}`);
  return brush;
}

/* ---------------- Spiral stairs ---------------- */
export type SpiralStairsOptions={origin:Vec3;innerRadius:number;outerRadius:number;stepHeight:number;steps:number;degreesPerStep:number;startAngle:number;clockwise:boolean;solid:boolean;thickness:number;column:boolean;texture:string};
export const defaultSpiralStairs:SpiralStairsOptions={origin:[0,0,0],innerRadius:32,outerRadius:128,stepHeight:16,steps:16,degreesPerStep:22.5,startAngle:0,clockwise:false,solid:false,thickness:16,column:true,texture:'SV_BRICK01'};
export function validateSpiralStairs(o:SpiralStairsOptions):string[]{
  const e:string[]=[];
  if(!o.origin.every(n=>Number.isFinite(n)&&Math.abs(n)<120000))e.push('Invalid world origin.');
  if(!(o.innerRadius>=0&&o.innerRadius<=4096))e.push('Inner radius must be 0–4096 units.');
  if(!(o.outerRadius>=o.innerRadius+16&&o.outerRadius<=8192))e.push('Outer radius must be at least 16 units larger than the inner radius.');
  if(!(o.stepHeight>=2&&o.stepHeight<=128))e.push('Step height must be 2–128 units.');
  if(!(Number.isInteger(o.steps)&&o.steps>=2&&o.steps<=256))e.push('Use 2–256 steps.');
  if(!(o.degreesPerStep>=3&&o.degreesPerStep<=90))e.push('Each step must turn 3–90 degrees.');
  if(!Number.isFinite(o.startAngle))e.push('Invalid starting angle.');
  if(!o.solid&&!(o.thickness>=2&&o.thickness<=512))e.push('Thickness must be between 2 and 512 units.');
  if(!textureOk(o.texture))e.push('Invalid GoldSrc texture name.');
  return e;
}
export function buildSpiralStairs(o:SpiralStairsOptions):Brush[]{
  const issues=validateSpiralStairs(o);if(issues.length)throw Error(issues[0]);
  const dir=o.clockwise?-1:1,[ox,oy,oz]=o.origin,out:Brush[]=[];
  const at=(radius:number,deg:number,z:number):Vec3=>{const a=deg*Math.PI/180;return [r2(ox+Math.cos(a)*radius),r2(oy+Math.sin(a)*radius),r2(z)];};
  for(let i=0;i<o.steps;i++){
    const a0=o.startAngle+dir*i*o.degreesPerStep,a1=a0+dir*o.degreesPerStep;
    const top=oz+(i+1)*o.stepHeight,bottom=o.solid?oz:Math.max(oz,top-o.thickness);
    const name=`Spiral step ${i+1}`;
    if(o.innerRadius<1){
      const v=[at(0,a0,top),at(o.outerRadius,a0,top),at(o.outerRadius,a1,top),at(0,a0,bottom),at(o.outerRadius,a0,bottom),at(o.outerRadius,a1,bottom)];
      out.push(polyBrush(v,[[0,1,2],[3,4,5],[0,3,4,1],[1,4,5,2],[2,5,3,0]],o.texture,name));
    }else{
      const v=[at(o.innerRadius,a0,top),at(o.outerRadius,a0,top),at(o.outerRadius,a1,top),at(o.innerRadius,a1,top),
        at(o.innerRadius,a0,bottom),at(o.outerRadius,a0,bottom),at(o.outerRadius,a1,bottom),at(o.innerRadius,a1,bottom)];
      out.push(polyBrush(v,[[0,1,2,3],[4,5,6,7],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],o.texture,name));
    }
  }
  if(o.column&&o.innerRadius>=8){
    const height=o.steps*o.stepHeight;
    const column=createBrush('cylinder',[ox,oy,oz+height/2],[o.innerRadius*2,o.innerRadius*2,height],'Spiral column');
    column.faces=column.faces.map(f=>({...f,texture:o.texture}));column.layer='Geometry';
    out.push(column);
  }
  return out;
}

/* ---------------- Scatter ---------------- */
export type ScatterOptions={count:number;seed:number;minSpacing:number;randomYaw:boolean;radius:number};
export const defaultScatter:ScatterOptions={count:12,seed:1,minSpacing:48,randomYaw:true,radius:256};
const boundsOf=(points:Vec3[])=>({min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))) as Vec3,max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))) as Vec3});
/** Random spots inside a circle, keeping the minimum spacing. Deterministic for a seed. */
export function scatterSpots(o:ScatterOptions):[number,number][]{
  if(!(Number.isInteger(o.count)&&o.count>=1&&o.count<=256))throw Error('Use 1–256 copies.');
  if(!(o.minSpacing>=0&&o.minSpacing<=4096))throw Error('Spacing must be 0–4096 units.');
  if(!(o.radius>=16&&o.radius<=8192))throw Error('Area radius must be 16–8192 units.');
  const random=seededRandom(o.seed),spots:[number,number][]=[];
  for(let n=0;n<o.count;n++){
    for(let tries=0;tries<40;tries++){
      const a=random()*Math.PI*2,d=Math.sqrt(random())*o.radius,x=Math.cos(a)*d,y=Math.sin(a)*d;
      if(spots.every(([px,py])=>Math.hypot(px-x,py-y)>=o.minSpacing)){spots.push([x,y]);break;}
    }
  }
  return spots;
}
/** Top of the solid floor under (x,y) closest to nearZ (within ±256u), so copies follow terrain. */
function floorAt(solids:Solid[],x:number,y:number,nearZ:number):number{
  let best=nearZ===Infinity?-Infinity:nearZ,dist=257;
  for(const s of solids){
    if(x<=s.min[0]||x>=s.max[0]||y<=s.min[1]||y>=s.max[1])continue;
    let lo=-Infinity,hi=Infinity,empty=false;
    for(const [a,b,c,d] of s.planes){const rhs=d-a*x-b*y;if(Math.abs(c)<1e-6){if(rhs< -1e-4){empty=true;break;}continue;}if(c>0)hi=Math.min(hi,rhs/c);else lo=Math.max(lo,rhs/c);}
    if(empty||!(hi>lo)||!Number.isFinite(hi))continue;
    if(nearZ===Infinity){if(!Number.isFinite(best)||hi>best)best=hi;continue;}
    if(Math.abs(hi-nearZ)<dist){dist=Math.abs(hi-nearZ);best=hi;}
  }
  return best;
}
/** Copies of the templates (point entities and world brushes) spread around `center`, each one
 * standing on the floor below it. One template is picked at random per spot. */
export function planScatterAround(project:Project,templates:MapObject[],center:Vec3,o:ScatterOptions):MapObject[]{
  if(!templates.length)throw Error('Select the objects to scatter in the map first (entities or brushes).');
  if(templates.some(t=>t.kind==='brush'&&t.entityId))throw Error('Brush entities cannot be scattered; use point entities or world brushes.');
  const ids=new Set(templates.map(t=>t.id));
  const solids=clearanceSolids({...project,objects:project.objects.filter(obj=>!ids.has(obj.id))});
  const spots=scatterSpots(o).map(([dx,dy])=>{const x=Math.round(center[0]+dx),y=Math.round(center[1]+dy);return [x,y,r2(floorAt(solids,x,y,center[2]))] as Vec3;});
  return copiesAt(templates,spots,o);
}
/** v2.4: scatter over the TOP of chosen area brushes (terrain, floors…) instead of a circle. */
export function planScatterOnArea(project:Project,templates:MapObject[],areaIds:string[],o:ScatterOptions):MapObject[]{
  if(!templates.length)throw Error('Select the objects to scatter in the map first (entities or brushes).');
  if(templates.some(t=>t.kind==='brush'&&t.entityId))throw Error('Brush entities cannot be scattered; use point entities or world brushes.');
  if(!(Number.isInteger(o.count)&&o.count>=1&&o.count<=256))throw Error('Use 1–256 copies.');
  const areaSet=new Set(areaIds),area=clearanceSolids({...project,objects:project.objects.filter(obj=>areaSet.has(obj.id))});
  if(!area.length)throw Error('Choose the area brushes first (for example the terrain).');
  const x0=Math.min(...area.map(s=>s.min[0])),x1=Math.max(...area.map(s=>s.max[0])),y0=Math.min(...area.map(s=>s.min[1])),y1=Math.max(...area.map(s=>s.max[1]));
  const random=seededRandom(o.seed),spots:Vec3[]=[];
  for(let tries=0;tries<o.count*60&&spots.length<o.count;tries++){
    const x=Math.round(x0+random()*(x1-x0)),y=Math.round(y0+random()*(y1-y0));
    const top=floorAt(area,x,y,Infinity);if(!Number.isFinite(top))continue;
    if(spots.every(p=>Math.hypot(p[0]-x,p[1]-y)>=o.minSpacing))spots.push([x,y,r2(top)]);
  }
  if(!spots.length)throw Error('No free spot found: lower the spacing or use a bigger area.');
  return copiesAt(templates,spots,o);
}
function copiesAt(templates:MapObject[],spots:Vec3[],o:ScatterOptions):MapObject[]{
  const random=seededRandom(o.seed*7919+3),out:MapObject[]=[];
  for(const [x,y,floor] of spots){
    const source=templates[Math.floor(random()*templates.length)];
    const yaw=o.randomYaw?Math.round(random()*360/15)*15%360:0;
    if(source.kind==='entity'){
      const lift=/^info_player/.test(source.classname)?36:1;
      const copy:PointEntity={...source,id:uid(),position:[x,y,floor+lift],props:{...source.props},group:undefined};
      delete copy.props.targetname;
      if(o.randomYaw){copy.props.angles=`0 ${yaw} 0`;delete copy.props.angle;}
      out.push(copy);
    }else{
      const b=boundsOf(transformedVertices(source));
      const rotated:Brush={...source,id:uid(),group:undefined,hidden:false,locked:false,rotation:[source.rotation[0],source.rotation[1],r2(source.rotation[2]+yaw)]};
      const rb=boundsOf(transformedVertices(rotated));
      rotated.position=[r2(rotated.position[0]+x-(rb.min[0]+rb.max[0])/2),r2(rotated.position[1]+y-(rb.min[1]+rb.max[1])/2),r2(rotated.position[2]+floor-b.min[2])];
      rotated.faces=rotateBrushTextureLock(source,rotated);
      out.push(rotated);
    }
  }
  if(!out.length)throw Error('No free spot found: lower the spacing or use a bigger area.');
  return out;
}
/* ---------------- Free clip plane ---------------- */
/** Cut brushes by any plane given by a point and a normal. side: both pieces, or only the piece the
 * normal points to ('front') / away from ('back'). Brushes the plane misses stay as they are. */
export function clipBrushesByPlane(brushes:Brush[],point:Vec3,normal:Vec3,side:'both'|'front'|'back'):Map<string,Brush[]>{
  const n=new THREE.Vector3(...normal);if(n.lengthSq()<1e-6)throw Error('Invalid clipping plane.');n.normalize();
  const plane={normal:n,constant:n.dot(new THREE.Vector3(...point))};
  const result=new Map<string,Brush[]>();let crossed=0;
  for(const brush of brushes){
    const back=clipConvex(brush,plane,true),front=clipConvex(brush,plane,false);
    const cut=!!back&&!!front;
    if(cut)crossed++;
    if(!cut){result.set(brush.id,[brush]);continue;}
    const parts=side==='both'?[back!,front!]:side==='front'?[front!]:[back!];
    result.set(brush.id,parts.map((p,i)=>({...p,name:side==='both'?`${brush.name} ${i?'(+)':'(-)'}`:brush.name,group:brush.group})));
  }
  if(!crossed)throw Error('The cutting line does not cross the selected brushes.');
  return result;
}

/* ---------------- Player-size check ---------------- */
export type ClearanceKind='narrow'|'crouch'|'jump'|'crouchJump'|'tooHigh';
export type ClearanceCell={x:number;y:number;z:number;kind:ClearanceKind};
export type ClearanceIssue={kind:ClearanceKind;center:Vec3;min:Vec3;max:Vec3;cells:number};
export type ClearanceReport={step:number;floors:number;cells:ClearanceCell[];issues:ClearanceIssue[];truncated:boolean};
export const PLAYER_LIMITS={width:COOP_HULL.width,stand:COOP_HULL.standingHeight,crouch:COOP_HULL.crouchHeight,step:COOP_HULL.stepHeight,jump:45,crouchJump:63,ledge:96} as const;
type Solid={planes:[number,number,number,number][];min:Vec3;max:Vec3};
/** Brushes the player collides with. Doors, water and other passable entities are left out. */
function clearanceSolids(project:Project,doorsSolid=false):Solid[]{
  const entities=new Map(project.objects.filter((o):o is PointEntity=>o.kind==='entity').map(o=>[o.id,o]));
  const out:Solid[]=[];
  for(const o of project.objects){
    if(o.kind!=='brush'||!solidBrush(o,entities))continue;
    const cls=o.entityId?entities.get(o.entityId)?.classname.toLowerCase()??'':'';
    if(doorsSolid?/^(func_water|func_pushable|func_train|func_tracktrain|func_plat)/.test(cls):/^(func_door|func_water|func_breakable|func_pushable|func_train|func_tracktrain|func_plat|momentary_door)/.test(cls))continue;
    const v=transformedVertices(o);if(v.length<4)continue;
    const c=v.reduce((s,p)=>[s[0]+p[0]/v.length,s[1]+p[1]/v.length,s[2]+p[2]/v.length] as Vec3,[0,0,0] as Vec3);
    const planes:[number,number,number,number][]=[];
    for(const f of o.faces){
      const [a,b,d]=f.indices.slice(0,3).map(i=>v[i]);if(!a||!b||!d)continue;
      const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
      let n:[number,number,number]=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
      const len=Math.hypot(...n);if(len<1e-9)continue;n=[n[0]/len,n[1]/len,n[2]/len];
      if(n[0]*(c[0]-a[0])+n[1]*(c[1]-a[1])+n[2]*(c[2]-a[2])>0)n=[-n[0],-n[1],-n[2]];
      planes.push([n[0],n[1],n[2],n[0]*a[0]+n[1]*a[1]+n[2]*a[2]]);
    }
    const {min,max}=boundsOf(v);out.push({planes,min,max});
  }
  return out;
}
/** Advisory scan of the whole map on a grid: every floor gets the free height above it, then
 * passages narrower than the player (32u), crouch-only spaces (36–72u high) and ledges that need a
 * jump (18–45u), a crouch-jump (45–63u) or that cannot be climbed (63–96u) are marked.
 * Approximate (grid of 8 or 16u); the compiled hulls in game remain the final word. */
export function analyzePlayerClearance(project:Project,maxColumns=260000):ClearanceReport{
  const solids=clearanceSolids(project);
  if(!solids.length)return {step:16,floors:0,cells:[],issues:[],truncated:false};
  const min=[Math.min(...solids.map(s=>s.min[0])),Math.min(...solids.map(s=>s.min[1]))],max=[Math.max(...solids.map(s=>s.max[0])),Math.max(...solids.map(s=>s.max[1]))];
  let step=8;while(((max[0]-min[0])/step)*((max[1]-min[1])/step)>maxColumns&&step<64)step*=2;
  const nx=Math.max(1,Math.ceil((max[0]-min[0])/step)),ny=Math.max(1,Math.ceil((max[1]-min[1])/step));
  const truncated=nx*ny>maxColumns*1.05;
  // Bucket solids by 256u tiles so each column only tests nearby brushes.
  const tile=256,buckets=new Map<string,number[]>();
  solids.forEach((s,i)=>{for(let tx=Math.floor(s.min[0]/tile);tx<=Math.floor(s.max[0]/tile);tx++)for(let ty=Math.floor(s.min[1]/tile);ty<=Math.floor(s.max[1]/tile);ty++){const k=`${tx},${ty}`;(buckets.get(k)??buckets.set(k,[]).get(k)!).push(i);}});
  type Floor={z:number;clear:number};
  const columns:Floor[][]=new Array(nx*ny);
  let floorCount=0;
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
    const x=min[0]+(i+.5)*step,y=min[1]+(j+.5)*step;
    const list=buckets.get(`${Math.floor(x/tile)},${Math.floor(y/tile)}`)??[];
    const spans:[number,number][]=[];
    for(const index of list){
      const s=solids[index];if(x<=s.min[0]||x>=s.max[0]||y<=s.min[1]||y>=s.max[1])continue;
      let lo=-Infinity,hi=Infinity,empty=false;
      for(const [a,b,c,d] of s.planes){
        const rhs=d-a*x-b*y;
        if(Math.abs(c)<1e-6){if(rhs< -1e-4){empty=true;break;}continue;}
        if(c>0)hi=Math.min(hi,rhs/c);else lo=Math.max(lo,rhs/c);
      }
      if(!empty&&hi-lo>.01&&Number.isFinite(lo)&&Number.isFinite(hi))spans.push([lo,hi]);
    }
    spans.sort((p,q)=>p[0]-q[0]);
    const merged:[number,number][]=[];
    for(const sp of spans){const last=merged[merged.length-1];if(last&&sp[0]<=last[1]+.5)last[1]=Math.max(last[1],sp[1]);else merged.push([...sp] as [number,number]);}
    // The space above the highest solid is outside the sealed level: no floor there.
    const floors:Floor[]=[];
    for(let k=0;k+1<merged.length;k++)floors.push({z:merged[k][1],clear:merged[k+1][0]-merged[k][1]});
    columns[i*ny+j]=floors;floorCount+=floors.length;
  }
  const at=(i:number,j:number)=>i<0||j<0||i>=nx||j>=ny?null:columns[i*ny+j];
  const passable=(f:Floor)=>f.clear>=PLAYER_LIMITS.crouch;
  const match=(list:Floor[]|null,z:number)=>list?.find(f=>passable(f)&&Math.abs(f.z-z)<=PLAYER_LIMITS.step)??null;
  const run=(i:number,j:number,di:number,dj:number,z:number)=>{let n=0,ci=i+di,cj=j+dj,cz=z;while(n<8){const f=match(at(ci,cj),cz);if(!f)break;n++;cz=f.z;ci+=di;cj+=dj;}return n;};
  const cells:ClearanceCell[]=[];
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)for(const f of columns[i*ny+j]){
    if(!passable(f))continue;
    const x=min[0]+(i+.5)*step,y=min[1]+(j+.5)*step;
    if(f.clear<PLAYER_LIMITS.stand)cells.push({x,y,z:f.z,kind:'crouch'});
    const wx=(1+run(i,j,1,0,f.z)+run(i,j,-1,0,f.z))*step,wy=(1+run(i,j,0,1,f.z)+run(i,j,0,-1,f.z))*step;
    if(Math.min(wx,wy)<PLAYER_LIMITS.width)cells.push({x,y,z:f.z,kind:'narrow'});
    // Ledges: a neighbouring floor higher than a normal step, with room for the player on top.
    let worst:ClearanceKind|null=null;
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const list=at(i+di,j+dj);if(!list)continue;
      if(match(list,f.z))continue; // a walkable path continues that way
      for(const g of list){
        const dz=g.z-f.z;if(!passable(g)||dz<=PLAYER_LIMITS.step||dz>PLAYER_LIMITS.ledge)continue;
        const kind:ClearanceKind=dz<=PLAYER_LIMITS.jump?'jump':dz<=PLAYER_LIMITS.crouchJump?'crouchJump':'tooHigh';
        const rank={jump:1,crouchJump:2,tooHigh:3} as Record<string,number>;
        if(!worst||rank[kind]>rank[worst])worst=kind;
      }
    }
    if(worst)cells.push({x,y,z:f.z,kind:worst});
  }
  return {step,floors:floorCount,cells:cells.slice(0,60000),issues:clusterCells(cells,step),truncated:truncated||cells.length>60000};
}
function clusterCells(cells:ClearanceCell[],step:number):ClearanceIssue[]{
  const issues:ClearanceIssue[]=[];
  const byKind=new Map<ClearanceKind,ClearanceCell[]>();
  for(const c of cells)(byKind.get(c.kind)??byKind.set(c.kind,[]).get(c.kind)!).push(c);
  for(const [kind,list] of byKind){
    const key=(c:ClearanceCell)=>`${Math.round(c.x/step)},${Math.round(c.y/step)}`;
    const grid=new Map<string,ClearanceCell[]>();for(const c of list)(grid.get(key(c))??grid.set(key(c),[]).get(key(c))!).push(c);
    const seen=new Set<ClearanceCell>();
    for(const start of list){
      if(seen.has(start))continue;
      const queue=[start];seen.add(start);const group:ClearanceCell[]=[];
      while(queue.length){
        const c=queue.pop()!;group.push(c);
        const gx=Math.round(c.x/step),gy=Math.round(c.y/step);
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const n of grid.get(`${gx+dx},${gy+dy}`)??[])if(!seen.has(n)&&Math.abs(n.z-c.z)<=24){seen.add(n);queue.push(n);}
      }
      const mn:Vec3=[Math.min(...group.map(c=>c.x))-step/2,Math.min(...group.map(c=>c.y))-step/2,Math.min(...group.map(c=>c.z))];
      const mx:Vec3=[Math.max(...group.map(c=>c.x))+step/2,Math.max(...group.map(c=>c.y))+step/2,Math.max(...group.map(c=>c.z))+PLAYER_LIMITS.stand];
      issues.push({kind,cells:group.length,min:mn,max:mx,center:[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,mn[2]]});
    }
  }
  const rank={narrow:0,tooHigh:1,crouch:2,crouchJump:3,jump:4} as Record<ClearanceKind,number>;
  return issues.sort((a,b)=>rank[a.kind]-rank[b.kind]||b.cells-a.cells).slice(0,400);
}

/* v2.6 player reachability ------------------------------------------------------------- */
export type ReachTarget={id:string;classname:string;name:string;state:'reachable'|'behind-door'|'unreachable';position:Vec3};
export type ReachReport={step:number;spawns:number;reachableCells:number;targets:ReachTarget[];keyProblems:string[]};
type ReachFloor={z:number;clear:number};
function reachColumns(project:Project,doorsSolid:boolean,maxColumns:number){
  const solids=clearanceSolids(project,doorsSolid);
  if(!solids.length)return null;
  const min=[Math.min(...solids.map(s=>s.min[0])),Math.min(...solids.map(s=>s.min[1]))],max=[Math.max(...solids.map(s=>s.max[0])),Math.max(...solids.map(s=>s.max[1]))];
  let step=16;while(((max[0]-min[0])/step)*((max[1]-min[1])/step)>maxColumns&&step<128)step*=2;
  const nx=Math.max(1,Math.ceil((max[0]-min[0])/step)),ny=Math.max(1,Math.ceil((max[1]-min[1])/step));
  const tile=256,buckets=new Map<string,number[]>();
  solids.forEach((s,i)=>{for(let tx=Math.floor(s.min[0]/tile);tx<=Math.floor(s.max[0]/tile);tx++)for(let ty=Math.floor(s.min[1]/tile);ty<=Math.floor(s.max[1]/tile);ty++){const k=`${tx},${ty}`;(buckets.get(k)??buckets.set(k,[]).get(k)!).push(i);}});
  const columns:ReachFloor[][]=new Array(nx*ny);
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
    const x=min[0]+(i+.5)*step,y=min[1]+(j+.5)*step;const spans:[number,number][]=[];
    for(const index of buckets.get(`${Math.floor(x/tile)},${Math.floor(y/tile)}`)??[]){
      const s=solids[index];if(x<=s.min[0]||x>=s.max[0]||y<=s.min[1]||y>=s.max[1])continue;
      let lo=-Infinity,hi=Infinity,empty=false;
      for(const [a,b,c,d] of s.planes){const rhs=d-a*x-b*y;if(Math.abs(c)<1e-6){if(rhs< -1e-4){empty=true;break;}continue;}if(c>0)hi=Math.min(hi,rhs/c);else lo=Math.max(lo,rhs/c);}
      if(!empty&&hi-lo>.01&&Number.isFinite(lo)&&Number.isFinite(hi))spans.push([lo,hi]);
    }
    spans.sort((p,q)=>p[0]-q[0]);const merged:[number,number][]=[];
    for(const sp of spans){const last=merged[merged.length-1];if(last&&sp[0]<=last[1]+.5)last[1]=Math.max(last[1],sp[1]);else merged.push([...sp] as [number,number]);}
    const floors:ReachFloor[]=[];for(let k=0;k+1<merged.length;k++)floors.push({z:merged[k][1],clear:merged[k+1][0]-merged[k][1]});
    columns[i*ny+j]=floors;
  }
  return {min,step,nx,ny,columns};
}
function reachFlood(grid:NonNullable<ReturnType<typeof reachColumns>>,starts:Vec3[]):Set<string>{
  const {min,step,nx,ny,columns}=grid;const seen=new Set<string>();const queue:[number,number,number][]=[];
  const cell=(p:Vec3)=>[Math.floor((p[0]-min[0])/step),Math.floor((p[1]-min[1])/step)] as const;
  for(const s of starts){const [i,j]=cell(s);if(i<0||j<0||i>=nx||j>=ny)continue;
    const fl=columns[i*ny+j];let best=-1,bz=-Infinity;fl.forEach((f,k)=>{if(f.z<=s[2]+8&&f.z>bz&&f.clear>=PLAYER_LIMITS.crouch){best=k;bz=f.z;}});
    if(best>=0){const key=`${i},${j},${best}`;if(!seen.has(key)){seen.add(key);queue.push([i,j,best]);}}}
  while(queue.length){const [i,j,k]=queue.shift()!;const f=columns[i*ny+j][k];
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=ny)continue;
      columns[a*ny+b].forEach((g,m)=>{const key=`${a},${b},${m}`;if(seen.has(key)||g.clear<PLAYER_LIMITS.crouch)return;
        const up=g.z-f.z;if(up>PLAYER_LIMITS.crouchJump)return; // too high to climb
        if(up>PLAYER_LIMITS.step&&f.clear<PLAYER_LIMITS.stand+up)return; // no room to jump
        seen.add(key);queue.push([a,b,m]);});}}
  return seen;
}
/** Which items, keys, weapons and buttons the players can reach from the spawns:
 * with doors open (any route) and with doors closed (no door crossed). Advisory grid estimate. */
export function analyzeReachability(project:Project,maxColumns=120000):ReachReport|null{
  const ents=project.objects.filter((o):o is PointEntity=>o.kind==='entity');
  const spawns=ents.filter(e=>/^info_player_(start|deathmatch|coop)$/.test(e.classname)).map(e=>e.position);
  const open=reachColumns(project,false,maxColumns),closed=reachColumns(project,true,maxColumns);
  if(!open||!closed||!spawns.length)return null;
  const reachOpen=reachFlood(open,spawns),reachClosed=reachFlood(closed,spawns);
  const centers=new Map<string,Vec3>();
  for(const o of project.objects)if(o.kind==='brush'&&o.entityId){const v=transformedVertices(o);const c=v.reduce((s,p)=>[s[0]+p[0]/v.length,s[1]+p[1]/v.length,s[2]+p[2]/v.length] as Vec3,[0,0,0] as Vec3);if(!centers.has(o.entityId))centers.set(o.entityId,c);}
  const reachableAt=(grid:NonNullable<ReturnType<typeof reachColumns>>,set:Set<string>,p:Vec3)=>{
    const ci=Math.floor((p[0]-grid.min[0])/grid.step),cj=Math.floor((p[1]-grid.min[1])/grid.step);
    for(let di=-2;di<=2;di++)for(let dj=-2;dj<=2;dj++){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=grid.nx||j>=grid.ny)continue;
      const fl=grid.columns[i*grid.ny+j];for(let k=0;k<fl.length;k++)if(set.has(`${i},${j},${k}`)&&p[2]>=fl[k].z-24&&p[2]<=fl[k].z+PLAYER_LIMITS.stand+40)return true;}
    return false;};
  const targets:ReachTarget[]=[];
  for(const e of ents){
    if(!/^(item_|weapon_|ammo_|func_button|func_rot_button|point_checkpoint|trigger_changelevel)/.test(e.classname))continue;
    const p=centers.get(e.id)??e.position;
    const state=reachableAt(closed,reachClosed,p)?'reachable':reachableAt(open,reachOpen,p)?'behind-door':'unreachable';
    targets.push({id:e.id,classname:e.classname,name:e.props.targetname||e.props.item_name||e.classname,state,position:[...p] as Vec3});
  }
  // A key that is only reachable through the door that needs it can never be picked up.
  const keyProblems:string[]=[];
  for(const key of ents.filter(e=>e.classname==='item_inventory')){
    const item=key.props.item_name;if(!item)continue;
    const doors=ents.filter(e=>e.props.item_name_required?.split(';').map(s=>s.trim()).includes(item));
    const t=targets.find(x=>x.id===key.id);
    if(doors.length&&t&&t.state!=='reachable')keyProblems.push(`${item}: the key is not reachable without opening doors (${doors.map(d=>d.props.targetname||d.classname).join(', ')}).`);
  }
  return {step:open.step,spawns:spawns.length,reachableCells:reachOpen.size,targets,keyProblems};
}