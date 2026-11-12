/** Blueprint to Map v1.8.13 — an image is ONLY an editor reference.
 * All generated geometry is real closed, planar, convex Valve 220 brushes.
 * No gameplay entities and no changes to Architecture Mode are required.
 */
import {uid,type Brush,type Project,type Vec3} from './types';
import {orientFaces} from './geometry';
import {validateBrush} from './exportMap';
import {architecturePartSignature} from './architecture';
import {triangulateArchitectureFloor} from './architectureMode';

export type PlanPoint=[number,number];
export type BlueprintOpening={id:string;edge:number;t:number;kind:'door'|'window';width:number;height:number;sill:number};
export type BlueprintStroke={id:string;kind:'wall'|'room';points:PlanPoint[];openings:BlueprintOpening[];floor:boolean;ceiling:boolean;name:string;/** Optional pitched roof on uppermost rectangular room. */roof?:{kind:'gable'|'shed';rise:number};/** Absent on HF4 sources: belongs to ground floor. */levelId?:string};
export type BlueprintLevel={id:string;name:string;offsetZ:number};
export type BlueprintStair={id:string;name:string;fromLevelId:string;toLevelId:string;start:PlanPoint;direction:0|90|180|270;width:number;length:number;steps:number};
export const BLUEPRINT_GROUND_ID='ground';
export const blueprintLevels=(plan:BlueprintPlan):BlueprintLevel[]=>plan.levels?.length?plan.levels:[{id:BLUEPRINT_GROUND_ID,name:'Ground floor',offsetZ:0}];
export const blueprintStrokeLevel=(stroke:BlueprintStroke)=>stroke.levelId||BLUEPRINT_GROUND_ID;

export type BlueprintPlan={
  id:string;name:string;imageDataUrl?:string;imageWidth:number;imageHeight:number;
  unitsPerPixel:number;origin:PlanPoint;calibration?:{a:PlanPoint;b:PlanPoint;units:number};
  baseZ:number;wallHeight:number;wallThickness:number;slabThickness:number;texture:string;
  strokes:BlueprintStroke[];memberIds:string[];signatures:string[];
  /** Enabled by default for older documents. Set false only for legacy geometry comparison. */
  smartWalls?:boolean;
  /** Optional multi-level extension. Legacy HF4 files require no migration. */
  levels?:BlueprintLevel[];
  stairs?:BlueprintStair[];
};
const copy=<T>(x:T):T=>structuredClone(x);
const EPS=1e-6;
export const BLUEPRINT_MAX_BRUSHES=512;
export const initialBlueprint=():BlueprintPlan=>({id:uid(),name:'New blueprint',imageWidth:1024,imageHeight:768,unitsPerPixel:1,origin:[0,0],baseZ:0,wallHeight:224,wallThickness:16,slabThickness:16,texture:'SV_BRICK01',strokes:[],memberIds:[],signatures:[],smartWalls:true});
export const blueprintPixelToWorld=(plan:Pick<BlueprintPlan,'imageWidth'|'imageHeight'|'unitsPerPixel'|'origin'>,p:PlanPoint):PlanPoint=>[
  plan.origin[0]+(p[0]-plan.imageWidth/2)*plan.unitsPerPixel,
  plan.origin[1]+(plan.imageHeight/2-p[1])*plan.unitsPerPixel
];
export const blueprintWorldToPixel=(plan:Pick<BlueprintPlan,'imageWidth'|'imageHeight'|'unitsPerPixel'|'origin'>,p:PlanPoint):PlanPoint=>[
  (p[0]-plan.origin[0])/plan.unitsPerPixel+plan.imageWidth/2,
  plan.imageHeight/2-(p[1]-plan.origin[1])/plan.unitsPerPixel
];
export const calibrateBlueprint=(plan:BlueprintPlan,a:PlanPoint,b:PlanPoint,units:number):BlueprintPlan=>{
  const d=Math.hypot(a[0]-b[0],a[1]-b[1]);
  if(!Number.isFinite(d)||d<4||!Number.isFinite(units)||units<8||units>32768)throw Error('Select two distinct points and enter a reference length from 8 to 32768 units.');
  const scale=units/d;
  if(scale<0.01||scale>512)throw Error('Calibration would create an unreasonable scale.');
  return {...plan,unitsPerPixel:scale,calibration:{a:copy(a),b:copy(b),units}};
};
const cross=(a:PlanPoint,b:PlanPoint,c:PlanPoint)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const distance=(a:PlanPoint,b:PlanPoint)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const area=(points:PlanPoint[])=>points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1]},0)/2;
const onSegment=(a:PlanPoint,b:PlanPoint,p:PlanPoint)=>Math.abs(cross(a,b,p))<EPS&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;
const intersects=(a:PlanPoint,b:PlanPoint,c:PlanPoint,d:PlanPoint)=>{
  const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b);
  return c1*c2<-EPS&&c3*c4<-EPS||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
};
function simplePolygon(points:PlanPoint[],closed:boolean):void{
  const edges=closed?points.length:points.length-1;
  for(let i=0;i<edges;i++)for(let j=i+1;j<edges;j++){
    if(j===i+1||closed&&i===0&&j===edges-1)continue;
    if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))throw Error('The outline crosses or touches itself.');
  }
}
function cleanPoints(points:PlanPoint[],closed:boolean):PlanPoint[]{
  const result=points.map(p=>[...p] as PlanPoint);
  if(closed&&result.length>2&&distance(result[0],result[result.length-1])<EPS)result.pop();
  return result;
}
/** Drafts may contain unfinished geometry, but never malformed metadata or unsafe file data. */
export function validateBlueprintPlan(plan:BlueprintPlan,allowIncomplete=false):void{
  if(!plan||typeof plan.id!=='string'||plan.id.length<1||plan.id.length>128||typeof plan.name!=='string'||plan.name.length>100||
    !Number.isInteger(plan.imageWidth)||plan.imageWidth<64||plan.imageWidth>8192||!Number.isInteger(plan.imageHeight)||plan.imageHeight<64||plan.imageHeight>8192||
    !Number.isFinite(plan.unitsPerPixel)||plan.unitsPerPixel<0.01||plan.unitsPerPixel>512||!Array.isArray(plan.origin)||plan.origin.length!==2||plan.origin.some(v=>!Number.isFinite(v)||Math.abs(v)>32768)||
    !Number.isFinite(plan.baseZ)||Math.abs(plan.baseZ)>16384||!Number.isFinite(plan.wallHeight)||plan.wallHeight<64||plan.wallHeight>2048||
    !Number.isFinite(plan.wallThickness)||plan.wallThickness<4||plan.wallThickness>128||!Number.isFinite(plan.slabThickness)||plan.slabThickness<4||plan.slabThickness>64||
    !/^[^\s"()[\]]{1,32}$/.test(plan.texture)||!Array.isArray(plan.strokes)||plan.strokes.length>120)throw Error('Invalid blueprint dimensions, materials or metadata.');
  if(plan.smartWalls!==undefined&&typeof plan.smartWalls!=='boolean')throw Error('Invalid shared-wall setting.');
  if(plan.levels!==undefined){
    if(!Array.isArray(plan.levels)||plan.levels.length<1||plan.levels.length>6)throw Error('Blueprint allows at most 6 floors.');
    const levelIds=new Set<string>();let previous=-1;
    for(const level of plan.levels){
      if(!level||typeof level.id!=='string'||!level.id||level.id.length>80||levelIds.has(level.id)||
        typeof level.name!=='string'||!level.name||level.name.length>80||!Number.isFinite(level.offsetZ)||level.offsetZ<0||level.offsetZ>8192||
        (previous>=0&&level.offsetZ-previous<plan.wallHeight+plan.slabThickness))throw Error('Invalid floor names, ids or heights.');
      previous=level.offsetZ;levelIds.add(level.id);
    }
    if(plan.levels[0].id!==BLUEPRINT_GROUND_ID||plan.levels[0].offsetZ!==0)throw Error('Ground floor must start at Z=0.');
  }
  const levels=blueprintLevels(plan),levelIds=new Set(levels.map(l=>l.id));
  if(plan.stairs!==undefined){
    if(!Array.isArray(plan.stairs)||plan.stairs.length>32)throw Error('Too many staircases.');
    const stairsIds=new Set<string>();
    for(const stair of plan.stairs){
      const a=levels.findIndex(l=>l.id===stair?.fromLevelId),b=levels.findIndex(l=>l.id===stair?.toLevelId);
      if(!stair||typeof stair.id!=='string'||!stair.id||stairsIds.has(stair.id)||typeof stair.name!=='string'||stair.name.length>80||
        a<0||b!==a+1||!Array.isArray(stair.start)||stair.start.length!==2||stair.start.some(n=>!Number.isFinite(n)||Math.abs(n)>131072)||
        ![0,90,180,270].includes(stair.direction)||!Number.isFinite(stair.width)||stair.width<40||stair.width>256||
        !Number.isFinite(stair.length)||stair.length<128||stair.length>1024||!Number.isInteger(stair.steps)||stair.steps<8||stair.steps>48)
        throw Error('Invalid stair position, size or connecting floor.');
      const rise=levels[b].offsetZ-levels[a].offsetZ;
      if(!allowIncomplete&&(rise/stair.steps>19||stair.length/stair.steps<12))throw Error('Stair steps are too steep or too shallow. Increase the number of steps or the run length.');
      stairsIds.add(stair.id);
      const from=blueprintPixelToWorld(plan,stair.start);if(from.some(v=>Math.abs(v)>32768))throw Error('Stair is outside the mapping area.');
    }
  }
  if(plan.imageDataUrl!==undefined&&(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(plan.imageDataUrl)||plan.imageDataUrl.length>2_100_000))
    throw Error('The reference image is invalid or exceeds the 1.5 MB embedded image limit.');
  if(plan.calibration){
    const {a,b,units}=plan.calibration;
    if(!Array.isArray(a)||!Array.isArray(b)||a.length!==2||b.length!==2||[...a,...b,units].some(v=>!Number.isFinite(v))||distance(a,b)<4||units<8||units>32768)
      throw Error('Invalid image calibration.');
    if(Math.abs(units/distance(a,b)-plan.unitsPerPixel)>1e-5)throw Error('Image calibration does not match the saved scale.');
  }
  const ids=new Set<string>();
  for(const stroke of plan.strokes){
    if(typeof stroke.id!=='string'||!stroke.id||ids.has(stroke.id)||!['wall','room'].includes(stroke.kind)||
      typeof stroke.name!=='string'||stroke.name.length>100||typeof stroke.floor!=='boolean'||typeof stroke.ceiling!=='boolean'||
      !Array.isArray(stroke.points)||stroke.points.length<(stroke.kind==='room'?3:2)||stroke.points.length>64||
      !Array.isArray(stroke.openings)||stroke.openings.length>48)throw Error('Invalid wall or room outline.');
    if(!levelIds.has(blueprintStrokeLevel(stroke)))throw Error('Room references an unknown floor.');
    if(stroke.roof){
      const r=stroke.roof;
      if(stroke.kind!=='room'||!['gable','shed'].includes(r.kind)||!Number.isFinite(r.rise)||r.rise<16||r.rise>512)
        throw Error('Invalid pitched roof. Select a room and a roof rise between 16 and 512 units.');
      if(!allowIncomplete&&blueprintStrokeLevel(stroke)!==levels.at(-1)?.id)
        throw Error('A pitched roof can only be generated on the top floor. Move or remove the roof first.');
    }
    ids.add(stroke.id);
    const pixels=cleanPoints(stroke.points,stroke.kind==='room');
    if(pixels.length<(stroke.kind==='room'?3:2))throw Error('The outline needs additional corners.');
    if(pixels.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||Math.abs(v)>131072)))throw Error('Outline coordinates are invalid.');
    const world=pixels.map(p=>blueprintPixelToWorld(plan,p));
    if(world.some(p=>p.some(v=>Math.abs(v)>32768)))throw Error('Blueprint extends outside a safe GoldSrc mapping area.');
    if(!allowIncomplete&&stroke.kind==='room'&&Math.abs(area(world))<plan.wallThickness**2*6)throw Error('The room is too small.');
    if(!allowIncomplete)simplePolygon(world,stroke.kind==='room');
    const n=stroke.kind==='room'?world.length:world.length-1;
    if(!allowIncomplete)for(let e=0;e<n;e++)if(distance(world[e],world[(e+1)%world.length])<plan.wallThickness*2+8)throw Error('Wall segment is too short for its thickness.');
    const openingsPerEdge=new Map<number,Array<[number,number]>>();
    const openIds=new Set<string>();
    for(const opening of stroke.openings){
      if(typeof opening.id!=='string'||!opening.id||openIds.has(opening.id)||
        !['door','window'].includes(opening.kind)||!Number.isInteger(opening.edge)||opening.edge<0||opening.edge>=n||
        !Number.isFinite(opening.t)||opening.t<=0||opening.t>=1||!Number.isFinite(opening.width)||opening.width<(allowIncomplete?1:24)||opening.width>512||
        !Number.isFinite(opening.sill)||opening.sill<0||opening.sill>4096||!Number.isFinite(opening.height)||opening.height<1||opening.height>4096||(!allowIncomplete&&(opening.height<32||opening.sill+opening.height>plan.wallHeight-8)))
        throw Error('Door or window has an invalid position or size.');
      openIds.add(opening.id);
      const length=distance(world[opening.edge],world[(opening.edge+1)%world.length]);
      const center=opening.t*length,a=center-opening.width/2,b=center+opening.width/2;
      if(!allowIncomplete&&(a<plan.wallThickness+4||b>length-plan.wallThickness-4))throw Error('Door or window is too close to a corner.');
      const list=openingsPerEdge.get(opening.edge)||[];
      if(!allowIncomplete&&list.some(([left,right])=>a<right+8&&b>left-8))throw Error('Two openings overlap or are too close.');
      list.push([a,b]);openingsPerEdge.set(opening.edge,list);
    }
  }
}
/** Add a hole at the chosen wall position. If other outlines share the SAME
 * wall centerline, cut them as well so that a room divider is actually passable.
 * Reject conflicts atomically; never leave one side closed. */
export function addBlueprintOpening(plan:BlueprintPlan,strokeId:string,edge:number,opening:Omit<BlueprintOpening,'id'|'edge'>):BlueprintPlan{
  const source=plan.strokes.find(s=>s.id===strokeId);
  if(!source)throw Error('Select a wall or a room first.');
  const n=source.kind==='room'?source.points.length:source.points.length-1;
  if(!Number.isInteger(edge)||edge<0||edge>=n)throw Error('Invalid wall segment.');
  const a=source.points[edge],b=source.points[(edge+1)%source.points.length];
  const center:PlanPoint=[a[0]+(b[0]-a[0])*opening.t,a[1]+(b[1]-a[1])*opening.t];
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length<1)throw Error('Wall is too short.');
  let shared=0;
  const strokes=plan.strokes.map(stroke=>{
    const count=stroke.kind==='room'?stroke.points.length:stroke.points.length-1;
    const additions:BlueprintOpening[]=[];
    for(let i=0;i<count;i++){
      const p=stroke.points[i],q=stroke.points[(i+1)%stroke.points.length];
      if(stroke.id===strokeId&&i===edge){additions.push({id:uid(),edge:i,...opening});continue;}
      if(blueprintStrokeLevel(stroke)!==blueprintStrokeLevel(source))continue;
      const vx=q[0]-p[0],vy=q[1]-p[1],l=Math.hypot(vx,vy);
      if(l<1)continue;
      // Both endpoints must lie on the same infinite line (within half a pixel),
      // including reversed wall segments. Not for merely close parallel walls.
      const errA=Math.abs(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/length;
      const errB=Math.abs(dx*(q[1]-a[1])-dy*(q[0]-a[0]))/length;
      if(errA>.5||errB>.5)continue;
      const t=((center[0]-p[0])*vx+(center[1]-p[1])*vy)/(l*l);
      if(t<=0||t>=1)continue;
      const crossDir=Math.abs(dx*vy-dy*vx)/(length*l);
      if(crossDir>.01)continue;
      additions.push({id:uid(),edge:i,...opening,t});shared++;
    }
    return additions.length?{...stroke,openings:[...stroke.openings,...additions]}:stroke;
  });
  const candidate={...plan,strokes};validateBlueprintPlan(candidate);
  return candidate;
}

/** Find usable distances on a wall while preserving the mandatory corner and inter-opening clearances. */
export function blueprintOpeningSpaces(plan:BlueprintPlan,strokeId:string,openingId:string):Array<[number,number]>{
  const stroke=plan.strokes.find(s=>s.id===strokeId);
  const opening=stroke?.openings.find(o=>o.id===openingId);
  if(!stroke||!opening)throw Error('Opening not found.');
  const a=blueprintPixelToWorld(plan,stroke.points[opening.edge]);
  const b=blueprintPixelToWorld(plan,stroke.points[(opening.edge+1)%stroke.points.length]);
  const len=distance(a,b),margin=plan.wallThickness+4;
  const obstacles=stroke.openings.filter(o=>o.id!==openingId&&o.edge===opening.edge)
    .map(o=>[o.t*len-o.width/2-8,o.t*len+o.width/2+8] as [number,number]).sort((x,y)=>x[0]-y[0]);
  const slots:Array<[number,number]>=[];let start=margin;
  for(const [low,high] of obstacles){if(low-start>=24)slots.push([start,low]);start=Math.max(start,high);}
  if(len-margin-start>=24)slots.push([start,len-margin]);
  return slots;
}
/** Constrain a change to the nearest viable interval; never leave a door hanging past a corner. */
export function fitBlueprintOpening(plan:BlueprintPlan,strokeId:string,openingId:string,patch:Partial<Pick<BlueprintOpening,'t'|'width'|'height'|'sill'>>):BlueprintPlan{
  const stroke=plan.strokes.find(s=>s.id===strokeId),original=stroke?.openings.find(o=>o.id===openingId);
  if(!stroke||!original)throw Error('Opening not found.');
  const a=blueprintPixelToWorld(plan,stroke.points[original.edge]);
  const b=blueprintPixelToWorld(plan,stroke.points[(original.edge+1)%stroke.points.length]);
  const len=distance(a,b);
  const desiredT=Math.min(.999,Math.max(.001,Number.isFinite(patch.t??original.t)?patch.t??original.t:original.t));
  const desiredWidth=Math.max(24,Math.min(512,Number.isFinite(patch.width??original.width)?patch.width??original.width:original.width));
  // Vertical movement preserves the opening's height. Clamp its bottom Z to
  // the wall's remaining clearance; resizing the height is a separate action.
  const requestedHeight=Number.isFinite(patch.height??original.height)?patch.height??original.height:original.height;
  const requestedSill=Number.isFinite(patch.sill??original.sill)?patch.sill??original.sill:original.sill;
  const height=Math.max(32,Math.min(plan.wallHeight-8,requestedHeight));
  const sill=Math.max(0,Math.min(plan.wallHeight-height-8,requestedSill));
  const slots=blueprintOpeningSpaces(plan,strokeId,openingId);
  if(!slots.length)throw Error('This segment has no room for an opening of at least 24 units.');
  const candidates=slots.map(([left,right])=>{
    const width=Math.min(desiredWidth,right-left);
    const center=Math.max(left+width/2,Math.min(right-width/2,desiredT*len));
    return {width,center,score:Math.abs(center-desiredT*len)+(desiredWidth-width)*.7};
  }).sort((a,b)=>a.score-b.score);
  const best=candidates[0];
  const changed={...original,t:best.center/len,width:best.width,height,sill};
  const originalCenter:PlanPoint=[a[0]+(b[0]-a[0])*original.t,a[1]+(b[1]-a[1])*original.t];
  const newCenter:PlanPoint=[a[0]+(b[0]-a[0])*changed.t,a[1]+(b[1]-a[1])*changed.t];
  const strokes=plan.strokes.map(s=>({...s,openings:s.openings.map(o=>{
    if(s.id===strokeId&&o.id===openingId)return changed;
    // Keep identical openings on coincident walls in sync (even in old HF1 documents).
    if(s.id===strokeId||blueprintStrokeLevel(s)!==blueprintStrokeLevel(stroke)||o.kind!==original.kind||Math.abs(o.width-original.width)>.01||Math.abs(o.height-original.height)>.01||Math.abs(o.sill-original.sill)>.01)return o;
    const start=blueprintPixelToWorld(plan,s.points[o.edge]);
    const end=blueprintPixelToWorld(plan,s.points[(o.edge+1)%s.points.length]);
    const dx=end[0]-start[0],dy=end[1]-start[1],l=Math.hypot(dx,dy);
    if(l<1)return o;
    const cross1=Math.abs((originalCenter[0]-start[0])*dy-(originalCenter[1]-start[1])*dx)/l;
    const cross2=Math.abs((newCenter[0]-start[0])*dy-(newCenter[1]-start[1])*dx)/l;
    const originalT=((originalCenter[0]-start[0])*dx+(originalCenter[1]-start[1])*dy)/(l*l);
    const otherCenter=blueprintPixelToWorld(plan,[s.points[o.edge][0]+(s.points[(o.edge+1)%s.points.length][0]-s.points[o.edge][0])*o.t,
      s.points[o.edge][1]+(s.points[(o.edge+1)%s.points.length][1]-s.points[o.edge][1])*o.t]);
    if(cross1>.5||cross2>.5||distance(otherCenter,originalCenter)>.5||originalT<=0||originalT>=1)return o;
    return {...o,t:((newCenter[0]-start[0])*dx+(newCenter[1]-start[1])*dy)/(l*l),width:changed.width,height:changed.height,sill:changed.sill};
  })}));
  const updated={...plan,strokes};validateBlueprintPlan(updated);return updated;
}

/** Make a best-effort non-destructive repair of misplaced openings in a saved draft.
 * The user keeps the original on error; no geometry or project objects are mutated. */
export function repairBlueprintOpenings(plan:BlueprintPlan):BlueprintPlan{
  validateBlueprintPlan(plan,true);
  const original=copy(plan);
  let repaired:BlueprintPlan={...copy(plan),strokes:plan.strokes.map(s=>({...copy(s),openings:[]}))};
  for(const stroke of original.strokes){
    for(const opening of stroke.openings){
      repaired={...repaired,strokes:repaired.strokes.map(s=>s.id===stroke.id?
        {...s,openings:[...s.openings,copy(opening)]}:s)};
      repaired=fitBlueprintOpening(repaired,stroke.id,opening.id,{});
    }
  }
  validateBlueprintPlan(repaired);
  return repaired;
}

/** Exported plan is an editable asset with no project-owned brush identifiers. */
export type BlueprintAsset={format:'svenstudio-blueprint';version:1;plan:BlueprintPlan};
export function exportBlueprintAsset(plan:BlueprintPlan):BlueprintAsset{
  validateBlueprintPlan(plan,true);
  return {format:'svenstudio-blueprint',version:1,plan:{...copy(plan),memberIds:[],signatures:[]}};
}
export function importBlueprintAsset(value:unknown):BlueprintPlan{
  if(!value||typeof value!=='object')throw Error('Invalid blueprint document.');
  const asset=value as Partial<BlueprintAsset>;
  if(asset.format!=='svenstudio-blueprint'||asset.version!==1||!asset.plan)throw Error('Unsupported blueprint document format.');
  const plan=copy(asset.plan);validateBlueprintPlan(plan,true);
  return {...plan,id:uid(),memberIds:[],signatures:[]};
}

function prism(outline:PlanPoint[],lo:number,hi:number,texture:string,name:string,group:string):Brush{
  if(hi-lo<1-EPS)throw Error(`${name}: height too small for a brush.`);
  const n=outline.length,cx=outline.reduce((sum,p)=>sum+p[0],0)/n,cy=outline.reduce((sum,p)=>sum+p[1],0)/n,cz=(lo+hi)/2;
  const vertices:Vec3[]=[...outline.map(p=>[p[0]-cx,p[1]-cy,lo-cz] as Vec3),...outline.map(p=>[p[0]-cx,p[1]-cy,hi-cz] as Vec3)];
  const edges=Array.from({length:n},(_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n]);
  const faces=orientFaces(vertices,[Array.from({length:n},(_,i)=>n-1-i),Array.from({length:n},(_,i)=>i+n),...edges].map(indices=>({indices,texture})));
  return {id:uid(),kind:'brush',name,primitive:'poly',vertices,faces,position:[cx,cy,cz],rotation:[0,0,0],scale:[1,1,1],layer:'Blueprint',group};
}
const ccw=(points:PlanPoint[])=>area(points)>=0?points:[...points].reverse();
type WallSection={left:PlanPoint;right:PlanPoint};
const normal=(a:PlanPoint,b:PlanPoint):PlanPoint=>{
  const d=distance(a,b);return [-(b[1]-a[1])/d,(b[0]-a[0])/d];
};
const offsetSection=(p:PlanPoint,normal:PlanPoint,half:number):WallSection=>({
  left:[p[0]+normal[0]*half,p[1]+normal[1]*half],right:[p[0]-normal[0]*half,p[1]-normal[1]*half]
});
/** Adjacent wall segments share the same miter plane, not overlapping cubes.
 * Extremely acute corners are rejected rather than generating self-intersections. */
function vertexSection(points:PlanPoint[],i:number,closed:boolean,thickness:number):WallSection{
  const n=points.length,at=points[i],half=thickness/2;
  if(!closed&&i===0)return offsetSection(at,normal(points[0],points[1]),half);
  if(!closed&&i===n-1)return offsetSection(at,normal(points[n-2],points[n-1]),half);
  const before=points[(i+n-1)%n],after=points[(i+1)%n];
  const previous:PlanPoint=[(at[0]-before[0])/distance(at,before),(at[1]-before[1])/distance(at,before)];
  const next:PlanPoint=[(after[0]-at[0])/distance(at,after),(after[1]-at[1])/distance(at,after)];
  const nBefore=normal(before,at),nAfter=normal(at,after);
  const denominator=1+previous[0]*next[0]+previous[1]*next[1];
  if(denominator<.08)throw Error('A wall doubles back too sharply. Add a wider corner or separate the outline.');
  const shift:PlanPoint=[(nBefore[0]+nAfter[0])*half/denominator,(nBefore[1]+nAfter[1])*half/denominator];
  if(Math.hypot(...shift)>Math.min(distance(before,at),distance(at,after))*.45)
    throw Error('The wall corner is too sharp for the selected thickness.');
  return offsetSection(at,[shift[0]/half,shift[1]/half],half);
}
function sectionAlong(a:PlanPoint,b:PlanPoint,d:number,thickness:number):WallSection{
  const len=distance(a,b),t=d/len;
  return offsetSection([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],normal(a,b),thickness/2);
}
function makeWallSegment(start:WallSection,end:WallSection,lo:number,hi:number,texture:string,name:string,group:string):Brush{
  return prism([start.right,end.right,end.left,start.left],lo,hi,texture,name,group);
}
/** Shared-wall topology is computed from the EDITABLE outlines rather than altering
 * their vertices or ownership. Two rooms can reference the same wall while the MAP
 * contains exactly one physical convex wall brush. */
type WallEdge = {a:PlanPoint;b:PlanPoint;start:WallSection;end:WallSection;
  strokeName:string;strokeId:string;index:number;openings:BlueprintOpening[]};
type OrientedEdge = {min:number;max:number;start:WallSection;end:WallSection;edge:WallEdge};
type WallRun = {min:number;max:number;group:WallGroup;edges:OrientedEdge[];name:string};
type WallGroup = {u:PlanPoint;n:PlanPoint;offset:number;edges:OrientedEdge[]};
const dot=(a:PlanPoint,b:PlanPoint)=>a[0]*b[0]+a[1]*b[1];
const flipSection=(sec:WallSection):WallSection=>({left:sec.right,right:sec.left});
const wallEdges=(plan:BlueprintPlan):WallEdge[]=>{
  const edges:WallEdge[]=[];
  for(const stroke of plan.strokes){
    const pts=cleanPoints(stroke.points,stroke.kind==='room').map(p=>blueprintPixelToWorld(plan,p));
    const joins=pts.map((_,i)=>vertexSection(pts,i,stroke.kind==='room',plan.wallThickness));
    const count=stroke.kind==='room'?pts.length:pts.length-1;
    for(let i=0;i<count;i++)edges.push({a:pts[i],b:pts[(i+1)%pts.length],start:joins[i],end:joins[(i+1)%pts.length],
      strokeName:stroke.name||'Room',strokeId:stroke.id,index:i,openings:stroke.openings.filter(o=>o.edge===i)});
  }
  return edges;
};
function groupWallEdges(edges:WallEdge[]):WallGroup[]{
  const byLine=new Map<string,WallGroup>();
  if(edges.length>BLUEPRINT_MAX_BRUSHES*4)throw Error('Too many individual wall edges for one blueprint. Split the plan.');
  for(const edge of edges){
    const len=distance(edge.a,edge.b),dx=(edge.b[0]-edge.a[0])/len,dy=(edge.b[1]-edge.a[1])/len;
    const reversed=dx<-.0000001||(Math.abs(dx)<.0000001&&dy<0);
    const u:PlanPoint=reversed?[-dx,-dy]:[dx,dy],n:PlanPoint=[-u[1],u[0]];
    const offset=dot(n,edge.a);
    // 0.001 map-unit tolerance is strictly for numerical drift, not arbitrary
    // nearby parallel walls. Near matches are corrected only with Repair.
    const key=`${Math.round(u[0]*1000000)}:${Math.round(u[1]*1000000)}:${Math.round(offset*1000)}`;
    let group=byLine.get(key);
    if(!group){group={u,n,offset,edges:[]};byLine.set(key,group)}
    const a=dot(group.u,edge.a),b=dot(group.u,edge.b);
    group.edges.push({min:Math.min(a,b),max:Math.max(a,b),edge,
      start:a<=b?edge.start:flipSection(edge.end),end:a<=b?edge.end:flipSection(edge.start)});
  }
  return [...byLine.values()];
}
function createWallRuns(groups:WallGroup[]):WallRun[]{
  const runs:WallRun[]=[];
  for(const group of groups){
    const sorted=[...group.edges].sort((a,b)=>a.min-b.min||b.max-a.max);
    for(const edge of sorted){
      const current=runs.at(-1);
      if(current&&current.group===group&&edge.min<=current.max+.001){
        current.max=Math.max(current.max,edge.max);current.edges.push(edge);
      }else runs.push({group,min:edge.min,max:edge.max,edges:[edge],name:edge.edge.strokeName});
    }
  }
  return runs;
}
const wallPoint=(group:WallGroup,s:number):PlanPoint=>[
  group.u[0]*s+group.n[0]*group.offset,group.u[1]*s+group.n[1]*group.offset];
const wallSectionAt=(group:WallGroup,s:number,t:number):WallSection=>offsetSection(wallPoint(group,s),group.n,t/2);
const pointOnRun=(run:WallRun,p:PlanPoint,margin:number)=>Math.abs(dot(run.group.n,p)-run.group.offset)<.002&&
  dot(run.group.u,p)>run.min+margin&&dot(run.group.u,p)<run.max-margin;
const wallAngle=(a:WallGroup,b:WallGroup)=>Math.abs(a.u[0]*b.u[1]-a.u[1]*b.u[0]);
/** Count repeated centerlines. No source outlines are destructively merged. */
export function blueprintWallConnections(plan:BlueprintPlan):{sharedLength:number;sharedSections:number;partialSections:number;junctions:number;sharedRanges:Array<[PlanPoint,PlanPoint]>}{
  const sharedRanges:Array<[PlanPoint,PlanPoint]>=[];
  const groups=groupWallEdges(wallEdges(plan)),runs=createWallRuns(groups);
  let sharedLength=0,sharedSections=0,partialSections=0;
  for(const group of groups){
    const cuts=[...new Set(group.edges.flatMap(e=>[e.min,e.max]))].sort((a,b)=>a-b);
    for(let i=1;i<cuts.length;i++){
      const a=cuts[i-1],b=cuts[i];if(b-a<.001)continue;
      const sharing=group.edges.filter(e=>e.min<(a+b)/2&&e.max>(a+b)/2);
      if(sharing.length>1){sharedLength+=b-a;sharedSections++;sharedRanges.push([wallPoint(group,a),wallPoint(group,b)]);if(sharing.some(e=>Math.abs(e.min-a)>.001||Math.abs(e.max-b)>.001))partialSections++;}
    }
  }
  let junctions=0;
  for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){
    const a=runs[i],b=runs[j],sin=wallAngle(a.group,b.group);if(sin<.3)continue;
    const cp=wallIntersection(a,b);if(cp&&(pointOnRun(a,cp,.01)||pointOnRun(b,cp,.01)))junctions++;
  }
  return {sharedLength,sharedSections,partialSections,junctions,sharedRanges};
}
/** The two infinite supporting lines meet at one world point. */
function wallIntersection(a:WallRun,b:WallRun):PlanPoint|null{
  const {u:ua}=a.group,{u:ub}=b.group;
  const denominator=ua[0]*ub[1]-ua[1]*ub[0];
  if(Math.abs(denominator)<.3)return null;
  const pa=wallPoint(a.group,a.min),pb=wallPoint(b.group,b.min);
  const delta:PlanPoint=[pb[0]-pa[0],pb[1]-pa[1]];
  const along=(delta[0]*ub[1]-delta[1]*ub[0])/denominator;
  const hit:PlanPoint=[pa[0]+ua[0]*along,pa[1]+ua[1]*along];
  if(!pointOnRun(a,hit,-.01)||!pointOnRun(b,hit,-.01))return null;
  return hit;
}
/** Magnetic drawing snap: nearby existing vertices first, then a point on an
 * existing wall. Uses WORLD distances and keeps unsnapped points grid-aligned.
 * During vertex dragging, exclude that outline to prevent self-attraction. */
export function snapBlueprintPoint(plan:BlueprintPlan,raw:PlanPoint,grid:number,excludeStrokeId?:string):PlanPoint{
  if(!Number.isFinite(grid)||grid<=0)return raw;
  const pt=blueprintPixelToWorld(plan,raw),rounded:PlanPoint=[Math.round(pt[0]/grid)*grid,Math.round(pt[1]/grid)*grid];
  if(plan.smartWalls===false)return blueprintWorldToPixel(plan,rounded);
  const tol=Math.min(16,Math.max(2,grid*1.5));
  let best:PlanPoint|null=null,dist=tol+1e-5;
  for(const stroke of plan.strokes){
    if(stroke.id===excludeStrokeId)continue;
    const points=stroke.points.map(p=>blueprintPixelToWorld(plan,p));
    for(const v of points){const d=distance(pt,v);if(d<dist){best=v;dist=d}}
  }
  if(best)return blueprintWorldToPixel(plan,best);
  for(const stroke of plan.strokes){
    if(stroke.id===excludeStrokeId)continue;
    const points=stroke.points.map(p=>blueprintPixelToWorld(plan,p)),count=stroke.kind==='room'?points.length:points.length-1;
    for(let i=0;i<count;i++){
      const a=points[i],b=points[(i+1)%points.length],len=distance(a,b);if(len<.001)continue;
      const u:PlanPoint=[(b[0]-a[0])/len,(b[1]-a[1])/len],along=dot([pt[0]-a[0],pt[1]-a[1]],u);
      if(along<=.001||along>=len-.001)continue;
      const projected:PlanPoint=[a[0]+u[0]*along,a[1]+u[1]*along],d=distance(pt,projected);
      if(d<dist){best=projected;dist=d}
    }
  }
  return blueprintWorldToPixel(plan,best||rounded);
}
/** Snap only near-coincident vertices and endpoints-to-segments.
 * This routine is a PREVIEW/undoable edit; never silently rewrites a saved plan. */
export function repairBlueprintWallConnections(plan:BlueprintPlan,tolerance=Math.min(8,plan.wallThickness/2)):BlueprintPlan{
  validateBlueprintPlan(plan,true);
  if(!Number.isFinite(tolerance)||tolerance<0||tolerance>32)throw Error('Invalid connection tolerance.');
  const original=copy(plan);
  const next=copy(plan);
  // Older outlines have priority. Moving BOTH near-matching rooms toward one
  // another would exchange their positions instead of repairing their seam.
  for(let strokeIndex=1;strokeIndex<next.strokes.length;strokeIndex++){
    const stroke=next.strokes[strokeIndex];
    const anchors=original.strokes.slice(0,strokeIndex);
    const vertices=anchors.flatMap(s=>s.points.map(p=>blueprintPixelToWorld(plan,p)));
    const edges=wallEdges({...plan,strokes:anchors});
    for(let i=0;i<stroke.points.length;i++){
      const p=blueprintPixelToWorld(plan,stroke.points[i]);let best:PlanPoint|null=null,bestDist=tolerance+1e-5;
      for(const target of vertices){const d=distance(p,target);if(d>.001&&d<bestDist){best=target;bestDist=d}}
      for(const edge of edges){
        const len=distance(edge.a,edge.b),u:PlanPoint=[(edge.b[0]-edge.a[0])/len,(edge.b[1]-edge.a[1])/len];
        const t=dot([p[0]-edge.a[0],p[1]-edge.a[1]],u);
        if(t<=tolerance||t>=len-tolerance)continue;
        const proj:PlanPoint=[edge.a[0]+u[0]*t,edge.a[1]+u[1]*t],d=distance(p,proj);
        if(d>.001&&d<bestDist){best=proj;bestDist=d}
      }
      if(best)stroke.points[i]=blueprintWorldToPixel(plan,best);
    }
  }
  const repaired={...next,smartWalls:true};
  validateBlueprintPlan(repaired);
  buildBlueprintBrushes(repaired);
  // A no-op is allowed; caller can report existing aligned connections.
  return repaired;
}
/** Build only the geometry; this function has no store or DOM side effects. */
function buildSingleBlueprintLevel(plan:BlueprintPlan,cutouts:BlueprintStair[]=[]):Brush[]{
  validateBlueprintPlan(plan);
  const brushes:Brush[]=[],groupName=`Blueprint ${plan.id.slice(0,8)}`;
  const {wallThickness:t,baseZ:z,wallHeight:h,slabThickness:slab,texture}=plan;
  if(plan.smartWalls===false){
    // Optional legacy comparison, never used for newly created documents.
    for(const edge of wallEdges(plan)){
      const len=distance(edge.a,edge.b),openings=[...edge.openings].sort((a,b)=>a.t-b.t);
      let cursor=0,part=0;
      const section=(low:number,high:number,zLow:number,zHigh:number)=>{
        if(high-low<1||zHigh-zLow<1)return;
        brushes.push(makeWallSegment(low<=EPS?edge.start:sectionAlong(edge.a,edge.b,low,t),high>=len-EPS?edge.end:sectionAlong(edge.a,edge.b,high,t),
          z+zLow,z+zHigh,texture,`${edge.strokeName} Wall ${edge.index+1} ${++part} · Exterior`,groupName));
      };
      for(const o of openings){const mid=o.t*len,left=mid-o.width/2,right=mid+o.width/2;
        section(cursor,left,0,h);if(o.sill>0)section(left,right,0,o.sill);
        if(o.sill+o.height<h)section(left,right,o.sill+o.height,h);cursor=right;
      }
      section(cursor,len,0,h);
    }
  }else{
    const groups=groupWallEdges(wallEdges(plan)),runs=createWallRuns(groups);
    for(const [index,run] of runs.entries()){
      const {group,min,max}=run,len=max-min;
      // Opening on either owner applies to the single physical wall. Existing
      // HF2 documents with duplicated openings remain compatible.
      const openings:Array<{left:number;right:number;sill:number;height:number}>=[];
      for(const edge of run.edges)for(const o of edge.edge.openings){
        const start=dot(group.u,edge.edge.a),end=dot(group.u,edge.edge.b),center=start+(end-start)*o.t;
        const left=center-o.width/2,right=center+o.width/2;
        const duplicate=openings.find(p=>Math.abs((p.left+p.right)/2-center)<.25);
        if(duplicate){
          if(Math.abs(duplicate.left-left)>.25||Math.abs(duplicate.right-right)>.25||duplicate.sill!==o.sill||duplicate.height!==o.height)
            throw Error('Shared wall has different door/window dimensions on its two sides. Make the openings match.');
          continue;
        }
        if(openings.some(p=>left<p.right+8&&right>p.left-8))throw Error('Overlapping openings on a shared wall. Move one of them.');
        openings.push({left,right,sill:o.sill,height:o.height});
      }
      openings.sort((a,b)=>a.left-b.left);
      // Full wall crossings: one wall stays continuous; the other terminates
      // flush on each side. Avoid two overlapping solids at the crossroads.
      const junctionCuts:Array<[number,number]>=[];
      for(let j=0;j<runs.length;j++){
        if(j===index)continue;const other=runs[j],sin=wallAngle(group,other.group);if(sin<.3)continue;
        const hit=wallIntersection(run,other);if(!hit)continue;
        const at=dot(group.u,hit),atOther=dot(other.group.u,hit);
        const interior=at>min+.001&&at<max-.001;
        const otherInterior=atOther>other.min+.001&&atOther<other.max-.001;
        if(interior&&otherInterior&&openings.some(o=>o.left<at+t/2/sin&&o.right>at-t/2/sin))
          throw Error('An opening overlaps a wall junction. Move it away from the crossing wall.');
        // When both run through the intersection, keep the longer one.
        // At a T, only the branch end is trimmed below.
        if(interior&&otherInterior&&(len<other.max-other.min-.001||Math.abs(len-(other.max-other.min))<.001&&index>j)){
          const cut=t/2/sin;
          if(openings.some(o=>o.left<at+cut&&o.right>at-cut))throw Error('An opening overlaps a crossing wall. Move the opening away from the junction.');
          junctionCuts.push([at-cut,at+cut]);
        }
      }
      junctionCuts.sort((a,b)=>a[0]-b[0]);
      const active:Array<[number,number]>=[];let boundary=min;
      for(const [a,b] of junctionCuts){
        if(a>boundary+.001)active.push([boundary,a]);boundary=Math.max(boundary,b);
      }
      if(max>boundary+.001)active.push([boundary,max]);
      const touching=(s:number,side:'start'|'end'):WallSection=>{
        const matching=run.edges.find(e=>Math.abs((side==='start'?e.min:e.max)-s)<.001);
        const original=matching?(side==='start'?matching.start:matching.end):wallSectionAt(group,s,t);
        // An endpoint on the middle of ANOTHER wall meets its near face, not
        // the centerline, so no brush overlaps are required at T junctions.
        for(const other of runs){
          if(other===run||wallAngle(group,other.group)<.3)continue;
          const at=wallPoint(group,s),sin=wallAngle(group,other.group);
          if(pointOnRun(other,at,t*.52)){
            const delta=t/2/sin*(side==='start'?1:-1);
            if(s+delta>min+.001&&s+delta<max-.001)return wallSectionAt(group,s+delta,t);
          }
        }
        return original;
      };
      for(const [leftBoundary,rightBoundary] of active){
        let cursor=leftBoundary,part=0;
        const section=(a:number,b:number,low:number,high:number,suffix:string)=>{
          if(b-a<1||high-low<1)return;
          const left=Math.abs(a-leftBoundary)<.001?touching(a,'start'):wallSectionAt(group,a,t);
          const right=Math.abs(b-rightBoundary)<.001?touching(b,'end'):wallSectionAt(group,b,t);
          if(distance(left.left,right.left)<1||distance(left.right,right.right)<1)return;
          brushes.push(makeWallSegment(left,right,z+low,z+high,texture,`${run.name} · Wall ${index+1} ${suffix} ${++part}${run.edges.length===1?' · Exterior':''}`,groupName));
          if(brushes.length>BLUEPRINT_MAX_BRUSHES)throw Error(`Blueprint exceeds ${BLUEPRINT_MAX_BRUSHES} brushes. Split it into smaller plans.`);
        };
        for(const opening of openings){
          if(opening.right<=leftBoundary||opening.left>=rightBoundary)continue;
          if(opening.left<leftBoundary-.001||opening.right>rightBoundary+.001)throw Error('An opening crosses a structural wall junction. Move the opening.');
          section(cursor,opening.left,0,h,'side');
          if(opening.sill>0)section(opening.left,opening.right,0,opening.sill,'sill');
          if(opening.sill+opening.height<h)section(opening.left,opening.right,opening.sill+opening.height,h,'lintel');
          cursor=opening.right;
        }
        section(cursor,rightBoundary,0,h,'main');
      }
    }
  }
  for(const stroke of plan.strokes){
    if(stroke.kind!=='room'||(!stroke.floor&&!stroke.ceiling))continue;
    const pts=cleanPoints(stroke.points,true).map(p=>blueprintPixelToWorld(plan,p));
    const contour=ccw(pts),convex=contour.every((p,i)=>cross(p,contour[(i+1)%contour.length],contour[(i+2)%contour.length])>=-EPS);
    const pieces=convex?[contour]:triangulateArchitectureFloor(contour);
    for(const [i,p] of pieces.entries()){
      if(stroke.floor){
        const filtered=clipSlabForStairs(p,cutouts,plan,z-slab,z);
        for(const [part,shape] of filtered.entries())brushes.push(prism(shape,z-slab,z,texture,`${stroke.name} Floor ${i+1}.${part+1}`,groupName));
      }
      if(stroke.ceiling){
        const filtered=clipSlabForStairs(p,cutouts,plan,z+h,z+h+slab);
        for(const [part,shape] of filtered.entries())brushes.push(prism(shape,z+h,z+h+slab,texture,`${stroke.name} Ceiling ${i+1}.${part+1}`,groupName));
      }
    }
    if(brushes.length>BLUEPRINT_MAX_BRUSHES)throw Error(`Blueprint exceeds ${BLUEPRINT_MAX_BRUSHES} brushes. Split it into smaller plans.`);
  }
  for(const brush of brushes){const errors=validateBrush(brush);if(errors.length)throw Error(`${brush.name}: ${errors[0]}`)}
  return brushes;
}

/** Stair footprint: bottom entrance is the centre of its first tread. */
export function blueprintStairRectangle(plan:BlueprintPlan,stair:BlueprintStair):PlanPoint[]{
  const p=blueprintPixelToWorld(plan,stair.start),a=stair.direction*Math.PI/180;
  const dir:PlanPoint=[Math.cos(a),Math.sin(a)],side:PlanPoint=[-dir[1],dir[0]];
  const world=(along:number,lateral:number):PlanPoint=>[p[0]+dir[0]*along+side[0]*lateral,p[1]+dir[1]*along+side[1]*lateral];
  return [world(0,-stair.width/2),world(stair.length,-stair.width/2),world(stair.length,stair.width/2),world(0,stair.width/2)];
}
const cleanPolygon=(points:PlanPoint[]):PlanPoint[]=>{
  const unique=points.filter((p,i)=>!i||distance(p,points[i-1])>1e-5);
  if(unique.length>2&&distance(unique[0],unique[unique.length-1])<1e-5)unique.pop();
  return unique.filter((p,i)=>{if(unique.length<4)return true;const a=unique[(i+unique.length-1)%unique.length],b=unique[(i+1)%unique.length];return Math.abs(cross(a,p,b))>1e-5});
};
/** Intersect convex polygon with one half-plane (n·p<=k or >=k). */
function clipHalfPlane(poly:PlanPoint[],n:PlanPoint,k:number,keepInside:boolean):PlanPoint[]{
  if(!poly.length)return [];
  const signed=(p:PlanPoint)=>(dot(n,p)-k)*(keepInside?1:-1);
  const output:PlanPoint[]=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],fa=signed(a),fb=signed(b),insideA=fa<=1e-7,insideB=fb<=1e-7;
    if(insideA)output.push(a);
    if(insideA!==insideB){const t=fa/(fa-fb);output.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  const result=cleanPolygon(output);return result.length>=3&&Math.abs(area(result))>.5?result:[];
}
/** Remove a rotated rectangular stairwell from convex floor/ceiling polygons.
 * The complement is partitioned into at most four convex pieces; no CSG/nonconvex brushes. */
function subtractStairRect(poly:PlanPoint[],rectangle:PlanPoint[]):PlanPoint[][]{
  let inner=poly;const result:PlanPoint[][]=[];
  for(let i=0;i<4;i++){
    if(!inner.length)break;
    const a=rectangle[i],b=rectangle[(i+1)%4],d:PlanPoint=[b[0]-a[0],b[1]-a[1]];
    // Rectangle is CCW, so its inside is the left half-plane of the edge.
    const n:PlanPoint=[d[1],-d[0]],k=dot(n,a);
    const outside=clipHalfPlane(inner,n,k,false);if(outside.length)result.push(outside);
    inner=clipHalfPlane(inner,n,k,true);
  }
  return result;
}
function clipSlabForStairs(poly:PlanPoint[],stairs:BlueprintStair[],plan:BlueprintPlan,lo:number,hi:number):PlanPoint[][]{
  let pieces=[poly];const floors=blueprintLevels(plan);
  for(const stair of stairs){
    const lower=floors.find(f=>f.id===stair.fromLevelId)!,upper=floors.find(f=>f.id===stair.toLevelId)!;
    const base=plan.baseZ+lower.offsetZ,top=plan.baseZ+upper.offsetZ;
    if(hi<=base+1||lo>=top-1)continue;
    const rect=blueprintStairRectangle(plan,stair);
    pieces=pieces.flatMap(piece=>subtractStairRect(piece,rect));
  }
  return pieces;
}
/** Tilted top face; each independent rectangle has a single planar slope. */
function roofWedge(outline:PlanPoint[],lo:number,high:number[],texture:string,name:string,group:string):Brush{
  const n=outline.length,cx=outline.reduce((a,p)=>a+p[0],0)/n,cy=outline.reduce((a,p)=>a+p[1],0)/n;
  const cz=(lo+Math.max(...high))/2;
  const vertices:Vec3[]=[...outline.map(p=>[p[0]-cx,p[1]-cy,lo-cz] as Vec3),
    ...outline.map((p,i)=>[p[0]-cx,p[1]-cy,high[i]-cz] as Vec3)];
  const faces=orientFaces(vertices,[Array.from({length:n},(_,i)=>n-1-i),Array.from({length:n},(_,i)=>i+n),
    ...Array.from({length:n},(_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])].map(indices=>({indices,texture})));
  return {id:uid(),kind:'brush',name,primitive:'poly',vertices,faces,position:[cx,cy,cz],rotation:[0,0,0],scale:[1,1,1],layer:'Blueprint',group};
}
function buildRoofBrushes(plan:BlueprintPlan):Brush[]{
  const levels=blueprintLevels(plan),top=levels.at(-1)!;
  const output:Brush[]=[];
  for(const stroke of plan.strokes){
    if(!stroke.roof)continue;
    // A ceiling slab is optional: never leave a 16-unit gap between wall and roof.
    const base=plan.baseZ+top.offsetZ+plan.wallHeight+(stroke.ceiling?plan.slabThickness:0);
    if(blueprintStrokeLevel(stroke)!==top.id)throw Error('Only the highest floor can have a pitched roof.');
    const pts=stroke.points.map(p=>blueprintPixelToWorld(plan,p));
    if(pts.length!==4)throw Error('Pitched roofs require a rectangular room.');
    const add=(a:PlanPoint,b:PlanPoint):PlanPoint=>[a[0]+b[0],a[1]+b[1]];
    const sub=(a:PlanPoint,b:PlanPoint):PlanPoint=>[a[0]-b[0],a[1]-b[1]];
    const d1=sub(pts[1],pts[0]),d2=sub(pts[3],pts[0]);
    const l1=Math.hypot(...d1),l2=Math.hypot(...d2),orth=Math.abs(dot(d1,d2)/(l1*l2));
    if(orth>.005||distance(add(pts[1],d2),pts[2])>.1)throw Error('Pitched roofs require a true rectangle. Adjust the room corners.');
    const long=l1>=l2?d1:d2,short=l1>=l2?d2:d1;
    const point=(u:number,v:number):PlanPoint=>[pts[0][0]+long[0]*u+short[0]*v,pts[0][1]+long[1]*u+short[1]*v];
    const {kind,rise}=stroke.roof;
    const part=(loV:number,hiV:number,i:number)=>{
      const uv:[[number,number],[number,number],[number,number],[number,number]]=[[0,loV],[1,loV],[1,hiV],[0,hiV]];
      const quad=uv.map(([u,v])=>point(u,v));
      const topZ=uv.map(([_,v])=>base+8+rise*(kind==='shed'?v:1-Math.abs(v*2-1)));
      const brush=roofWedge(quad,base,topZ,plan.texture,`${stroke.name} Roof ${kind} ${i}`,`Blueprint ${plan.id.slice(0,8)}`);
      const issues=validateBrush(brush);if(issues.length)throw Error(`${brush.name}: ${issues[0]}`);
      output.push(brush);
    };
    if(kind==='shed')part(0,1,1);else{part(0,.5,1);part(.5,1,2);}
  }
  return output;
}

function buildStairBrushes(plan:BlueprintPlan):Brush[]{
  const floors=blueprintLevels(plan),result:Brush[]=[];
  for(const stair of plan.stairs||[]){
    const lower=floors.find(f=>f.id===stair.fromLevelId)!,upper=floors.find(f=>f.id===stair.toLevelId)!;
    const rise=upper.offsetZ-lower.offsetZ,rect=blueprintStairRectangle(plan,stair);
    const base=plan.baseZ+lower.offsetZ,dir:PlanPoint=[(rect[1][0]-rect[0][0])/stair.length,(rect[1][1]-rect[0][1])/stair.length];
    for(let i=0;i<stair.steps;i++){
      const t0=i/stair.steps,t1=(i+1)/stair.steps;
      const step:PlanPoint[]=[
        [rect[0][0]+dir[0]*stair.length*t0,rect[0][1]+dir[1]*stair.length*t0],
        [rect[0][0]+dir[0]*stair.length*t1,rect[0][1]+dir[1]*stair.length*t1],
        [rect[3][0]+dir[0]*stair.length*t1,rect[3][1]+dir[1]*stair.length*t1],
        [rect[3][0]+dir[0]*stair.length*t0,rect[3][1]+dir[1]*stair.length*t0]
      ];
      result.push(prism(step,base,base+rise*t1,plan.texture,`${stair.name||'Staircase'} · Step ${i+1}`,`Blueprint ${plan.id.slice(0,8)}`));
    }
  }
  return result;
}
/** Generates separate floors but never allows shared-wall detection across Z levels. */
export function buildBlueprintBrushes(plan:BlueprintPlan):Brush[]{
  validateBlueprintPlan(plan);
  const floors=blueprintLevels(plan),all:Brush[]=[];
  for(const floor of floors){
    const strokes=plan.strokes.filter(st=>blueprintStrokeLevel(st)===floor.id);
    if(!strokes.length)continue;
    const subset={...plan,baseZ:plan.baseZ+floor.offsetZ,strokes};
    // Stair clipping uses absolute Z from the original plan, never the subset.
    const brushes=buildSingleBlueprintLevel(subset,[]);
    for(const brush of brushes){
      if(floors.length>1)brush.name=`@${floor.id} ${brush.name}`;
      if((brush.name.includes(' Floor ')||brush.name.includes(' Ceiling '))&&(plan.stairs||[]).length){
        const pts=transformedBrushFootprint(brush);
        const zLo=brush.position[2]+Math.min(...brush.vertices.map(v=>v[2])),zHi=brush.position[2]+Math.max(...brush.vertices.map(v=>v[2]));
        const cut=clipSlabForStairs(pts,plan.stairs||[],plan,zLo,zHi);
        for(const [i,polygon] of cut.entries())all.push(prism(polygon,zLo,zHi,plan.texture,`${brush.name} cut ${i+1}`,brush.group||''));
      }else all.push(brush);
    }
  }
  all.push(...buildStairBrushes(plan),...buildRoofBrushes(plan));
  // Only identical solid slabs are deduplicated (adjacent floor+ceiling).
  const seen=new Set<string>();const dedup:Brush[]=[];
  for(const brush of all){
    if(brush.name.includes(' Floor ')||brush.name.includes(' Ceiling ')){
      const lo=brush.position[2]+Math.min(...brush.vertices.map(v=>v[2]));
      const hi=brush.position[2]+Math.max(...brush.vertices.map(v=>v[2]));
      const outline=transformedBrushFootprint(brush).map(p=>p.map(n=>Math.round(n*1000)/1000).join(':')).sort();
      const signature=`${lo.toFixed(3)}:${hi.toFixed(3)}:${outline.join(';')}`;
      if(seen.has(signature))continue;seen.add(signature);
    }
    const errors=validateBrush(brush);if(errors.length)throw Error(`${brush.name}: ${errors[0]}`);
    dedup.push(brush);
    if(dedup.length>BLUEPRINT_MAX_BRUSHES)throw Error(`Blueprint exceeds ${BLUEPRINT_MAX_BRUSHES} brushes. Split it into smaller plans.`);
  }
  return dedup;
}
/** Prism footprint in world XY, supporting all regular Blueprint slabs. */
function transformedBrushFootprint(b:Brush):PlanPoint[]{
  return b.vertices.slice(0,b.vertices.length/2).map(p=>[b.position[0]+p[0],b.position[1]+p[1]] as PlanPoint);
}

function assertUnmodified(project:Project,record:BlueprintPlan){
  if(record.memberIds.length!==record.signatures.length)throw Error('Blueprint provenance is incomplete.');
  for(let i=0;i<record.memberIds.length;i++){
    const brush=project.objects.find(o=>o.id===record.memberIds[i]);
    if(!brush||brush.kind!=='brush'||architecturePartSignature(brush)!==record.signatures[i])
      throw Error('Blueprint brushes were manually edited, removed or locked. Detach the plan before creating a new version; nothing was overwritten.');
  }
}
/** Atomic persistence. The caller creates exactly one Undo snapshot. */
export function saveBlueprintToProject(project:Project,input:BlueprintPlan):{project:Project;memberIds:string[]}{
  const existing=(project.blueprintPlans||[]).find(p=>p.id===input.id);
  if(existing)assertUnmodified(project,existing);
  else if((project.blueprintPlans||[]).length>=16)throw Error('Maximum 16 blueprint documents per project.');
  const brushes=buildBlueprintBrushes(input);
  if(!brushes.length)throw Error('Trace at least one wall or room before generating geometry.');
  const record:BlueprintPlan={...copy(input),memberIds:brushes.map(b=>b.id),signatures:brushes.map(architecturePartSignature)};
  const oldIds=new Set(existing?.memberIds||[]);
  return {project:{...project,objects:[...project.objects.filter(o=>!oldIds.has(o.id)),...brushes],
    blueprintPlans:[...(project.blueprintPlans||[]).filter(p=>p.id!==input.id),record]},memberIds:record.memberIds};
}
/** Persist the editable source WITHOUT generating or modifying brushes.
 * This is different from Generate/Update and allows safe drafts and reference images. */
export function saveBlueprintDraftToProject(project:Project,input:BlueprintPlan):Project{
  validateBlueprintPlan(input,true);
  const plans=project.blueprintPlans||[];
  const existing=plans.find(p=>p.id===input.id);
  if(!existing&&plans.length>=16)throw Error('Maximum 16 blueprint documents per project.');
  // Provenance always describes the generated geometry, never an unsaved preview.
  const record:BlueprintPlan={...copy(input),memberIds:copy(existing?.memberIds||[]),signatures:copy(existing?.signatures||[])};
  return {...project,blueprintPlans:[...plans.filter(p=>p.id!==input.id),record]};
}
/** Move the actual traced bounds to the clicked map coordinate, not the center of
 * the reference image. Floor Z is set to the clicked surface height. */
export function placeBlueprintAtPoint(project:Project,id:string,at:Vec3):{project:Project;memberIds:string[]}{
  if(at.some(n=>!Number.isFinite(n)||Math.abs(n)>32768))throw Error('Invalid placement point.');
  const record=project.blueprintPlans?.find(p=>p.id===id);
  if(!record)throw Error('Save the blueprint before placing it.');
  if(!record.strokes.length)throw Error('The blueprint has no walls or rooms.');
  const points=record.strokes.flatMap(stroke=>stroke.points.map(pt=>blueprintPixelToWorld(record,pt)));
  const mx=(Math.min(...points.map(pt=>pt[0]))+Math.max(...points.map(pt=>pt[0])))/2;
  const my=(Math.min(...points.map(pt=>pt[1]))+Math.max(...points.map(pt=>pt[1])))/2;
  const shifted={...copy(record),origin:[record.origin[0]+at[0]-mx,record.origin[1]+at[1]-my] as PlanPoint,baseZ:at[2]};
  const result=saveBlueprintToProject(project,shifted);
  return result;
}
export function removeBlueprintFromProject(project:Project,id:string,detach=false):Project{
  const old=(project.blueprintPlans||[]).find(p=>p.id===id);
  if(!old)throw Error('Blueprint not found.');
  if(!detach)assertUnmodified(project,old);
  const oldIds=new Set(detach?[]:old.memberIds);
  return {...project,objects:project.objects.filter(o=>!oldIds.has(o.id)),blueprintPlans:(project.blueprintPlans||[]).filter(p=>p.id!==id)};
}
/** Project validation; used both on import and before generation. */
export function validateBlueprintMetadata(value:Record<string,unknown>):void{
  const list=value.blueprintPlans;
  if(list===undefined)return;
  if(!Array.isArray(list)||list.length>16)throw Error('Invalid project: blueprint collection exceeds the document limit.');
  const ids=new Set<string>();
  for(const entry of list){
    const record=entry as BlueprintPlan;
    try{
      validateBlueprintPlan(record,true);
      if(ids.has(record.id)||!Array.isArray(record.memberIds)||!Array.isArray(record.signatures)||record.memberIds.length!==record.signatures.length||record.memberIds.length>BLUEPRINT_MAX_BRUSHES||record.memberIds.some(x=>typeof x!=='string'||x.length>256)||record.signatures.some(x=>typeof x!=='string'||x.length>128))
        throw Error('Duplicate document or invalid brush provenance.');
    }catch(error){throw Error(`Invalid project: blueprint metadata (${String(error)}).`)}
    ids.add(record.id);
  }
}
