/** Quick Architecture: GoldSrc-safe parametric convex-brush assembly. */
import {createArch,createBrush,transformedVertices} from './geometry';
import {subtractConvex} from './advancedModeling';
import {validateBrush} from './exportMap';
import type {Brush,MapObject,Vec3} from './types';

export type ArchitectureKind='door'|'window'|'frame'|'arch'|'stairs'|'ramp'|'column'|'room';
export type ArchitectureOptions={width:number;height:number;depth:number;frame:number;steps:number;cutOnly:boolean;doorLeaf:boolean};
export const defaultArchitecture:ArchitectureOptions={width:96,height:128,depth:24,frame:8,steps:8,cutOnly:false,doorLeaf:false};
export type ArchitectureResult={objects:MapObject[];removeId?:string};
export type OpeningPlacement={center:Vec3};
const EPS=.01;
const positive=(v:number,label:string,min=1,max=8192)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error(`${label} must be between ${min} and ${max} units.`);return v};
function bounds(b:Brush){const points=transformedVertices(b);return {min:[0,1,2].map(i=>Math.min(...points.map(v=>v[i]))) as Vec3,max:[0,1,2].map(i=>Math.max(...points.map(v=>v[i]))) as Vec3};}
function addBox(result:Brush[],name:string,center:Vec3,size:Vec3,texture:string,group:string,layer='Architecture'){
  if(size.some(n=>n<EPS))throw Error('Architecture piece has no thickness.');
  const b=createBrush('box',center,size,name);b.layer=layer;b.group=group;b.faces.forEach(f=>f.texture=texture);result.push(b);
}
/** Door/window openings require an upright, axis-aligned BOX wall with no entity attachment.
 * A cutter extends past both sides of the wall to make a genuine through-hole. */
function opening(wall:Brush,kind:'door'|'window',o:ArchitectureOptions,texture:string,group:string,placement?:OpeningPlacement):ArchitectureResult{
  if(wall.locked||wall.entityId||wall.primitive!=='box'||wall.rotation.some(v=>Math.abs(v)>EPS))
    throw Error('Choose an unlocked, worldspawn, axis-aligned Box wall. Brush entities and rotated walls are not supported.');
  const {min,max}=bounds(wall);const size=max.map((v,i)=>v-min[i]) as Vec3;
  const thin=size[0]<size[1]?0:1,across=thin===0?1:0;
  if(size[thin]>size[across]*.5||size[2]<32)throw Error('Select an upright wall: its X or Y thickness must be smaller than its width.');
  const width=positive(o.width,'Opening width'),height=positive(o.height,'Opening height');
  if(width>=size[across]-2||height>=size[2]-(kind==='window'?16:1))throw Error('Opening must fit within the wall. Reduce width or height.');
  const frame=o.cutOnly?0:positive(o.frame,'Frame thickness',1,128);
  if(frame*2+width>=size[across]||height+(kind==='window'?2*frame:frame)>=size[2])throw Error('Frame will not fit inside the wall.');
  const center:Vec3=placement?[...placement.center]:[(min[0]+max[0])/2,(min[1]+max[1])/2,kind==='door'?min[2]+height/2:(min[2]+max[2])/2];
  // The picked point is projected to the wall's center plane. Keep the
  // full cutter / frame inside the wall, not just its nominal opening.
  center[thin]=(min[thin]+max[thin])/2;
  const outerWidth=width+2*frame;
  const requiredBottom=kind==='door'?0:frame;
  const requiredTop=frame;
  if(placement){
    if(center[across]-outerWidth/2<min[across]+.01||center[across]+outerWidth/2>max[across]-.01)
      throw Error('Opening is too close to the wall side. Move the cursor inward or reduce width.');
    if(kind==='door')center[2]=min[2]+height/2;
    if(center[2]-height/2-requiredBottom<min[2]-.01||center[2]+height/2+requiredTop>max[2]-.01)
      throw Error('Opening is too close to the top/bottom of the wall.');
  }
  // Reserve the full outer frame footprint so the frame does not overlap wall solids.
  const cutterSize:Vec3=[width+2*frame,width+2*frame,height+(kind==='window'?2*frame:frame)];
  cutterSize[thin]=size[thin]+8;
  const cutterCenter=[...center] as Vec3;
  if(kind==='door')cutterCenter[2]+=frame/2;
  const cutter=createBrush('box',cutterCenter,cutterSize,'Architecture Cutter');
  const pieces=subtractConvex(wall,cutter);
  if(!pieces.length)throw Error('Opening removed entire wall.');
  const result:Brush[]=pieces.map((b,i)=>({...b,name:`${wall.name} / ${kind} wall ${i+1}`,group:wall.group??group}));
  const addFrame=(name:string,p:Vec3,s:Vec3)=>addBox(result,name,p,s,texture,group);
  if(!o.cutOnly){
    const depth=Math.max(size[thin]+2,positive(o.depth,'Frame depth'));
    const sides:Vec3=[width,width,height];sides[thin]=depth;
    for(const sign of [-1,1]){
      const p=[...center] as Vec3;p[across]+=sign*(width/2+frame/2);
      const s=[...sides] as Vec3;s[across]=frame;
      addFrame(`${kind} / side frame`,p,s);
    }
    const top=[...center] as Vec3;top[2]+=height/2+frame/2;
    const topSize=[...sides] as Vec3;topSize[across]=width+2*frame;topSize[2]=frame;
    addFrame(`${kind} / header`,top,topSize);
    if(kind==='window'){
      const bottom=[...center] as Vec3;bottom[2]-=height/2+frame/2;
      addFrame('window / sill',bottom,topSize);
    }
    if(kind==='door'&&o.doorLeaf){
      const leafCenter=[...center] as Vec3;leafCenter[2]=min[2]+height/2;
      const leafSize=[...sides] as Vec3;leafSize[across]=width-4;leafSize[thin]=Math.min(8,depth/2);leafSize[2]=height-4;
      addFrame('door / leaf (convert to func_door)',leafCenter,leafSize);
    }
  }
  return {objects:result,removeId:wall.id};
}
export function createArchitecture(kind:ArchitectureKind,o:ArchitectureOptions,selected:Brush|null,texture='SV_BRICK01',placement?:OpeningPlacement):ArchitectureResult{
  const w=positive(o.width,'Width'),h=positive(o.height,'Height'),d=positive(o.depth,'Depth');
  const frame=positive(o.frame,'Frame thickness',1,128),steps=Math.round(positive(o.steps,'Steps',1,64));
  const group=`Architecture ${kind}`;
  if(kind==='door'||kind==='window'){
    if(!selected)throw Error('Select a Box wall before creating a door or window.');
    return opening(selected,kind,o,texture,group,placement);
  }
  const at:Vec3=selected?[...selected.position]:[0,0,0];
  const result:Brush[]=[];
  const box=(name:string,pos:Vec3,size:Vec3)=>addBox(result,name,pos,size,texture,group);
  // All freestanding generators use the ground plane at selected brush center (Z up).
  const [x,y,z]=at;
  if(kind==='frame'){
    if(w<=frame*2||h<=frame*2)throw Error('Frame thickness must be smaller than half the opening dimensions.');
    box('Frame left',[x-w/2+frame/2,y,z+h/2],[frame,d,h]);
    box('Frame right',[x+w/2-frame/2,y,z+h/2],[frame,d,h]);
    box('Frame top',[x,y,z+h-frame/2],[w-2*frame,d,frame]);
    box('Frame bottom',[x,y,z+frame/2],[w-2*frame,d,frame]);
  }else if(kind==='arch'){
    if(w<=frame*2)throw Error('Arch must be wider than its frame.');
    const radius=w/2,inner=radius-frame;
    for(const b of createArch([x,y,z+h-radius],radius,inner,d,Math.max(4,Math.min(24,steps)))){
      b.group=group;b.layer='Architecture';b.faces.forEach(f=>f.texture=texture);result.push(b);
    }
    const pillarHeight=h-radius;
    if(pillarHeight>1){box('Arch pillar left',[x-radius+frame/2,y,z+pillarHeight/2],[frame,d,pillarHeight]);box('Arch pillar right',[x+radius-frame/2,y,z+pillarHeight/2],[frame,d,pillarHeight]);}
  }else if(kind==='stairs'){
    for(let i=0;i<steps;i++){const length=d/steps,rise=h/steps;
      box(`Stair ${i+1}/${steps}`,[x-d/2+(i+.5)*length,y,z+(i+1)*rise/2],[length,w,(i+1)*rise]);}
  }else if(kind==='ramp'){
    const b=createBrush('wedge',[x,y,z+h/2],[d,w,h],'Ramp');b.group=group;b.layer='Architecture';b.faces.forEach(f=>f.texture=texture);result.push(b);
  }else if(kind==='column'){
    box('Column',[x,y,z+h/2],[w,d,h]);
  }else if(kind==='room'){
    if(w<=frame*2||d<=frame*2||h<=frame*2)throw Error('Room is too small for the specified wall thickness.');
    box('Room floor',[x,y,z+frame/2],[w,d,frame]);
    box('Room ceiling',[x,y,z+h-frame/2],[w,d,frame]);
    box('Room west',[x-w/2+frame/2,y,z+h/2],[frame,d-2*frame,h-2*frame]);
    box('Room east',[x+w/2-frame/2,y,z+h/2],[frame,d-2*frame,h-2*frame]);
    box('Room north',[x,y+d/2-frame/2,z+h/2],[w,frame,h-2*frame]);
    box('Room south',[x,y-d/2+frame/2,z+h/2],[w,frame,h-2*frame]);
  }
  for(const b of result){const errors=validateBrush(b);if(errors.length)throw Error(`${b.name}: ${errors[0]}`)}
  return {objects:result};
}

/** Rebuild several non-overlapping openings on ONE original wall.  GoldSrc has
 * no concave brushes: all remaining wall material is decomposed into convex
 * fragments.  Frame/door-leaf pieces remain separate edit-friendly brushes. */
export function createMultipleWallOpenings(
  wall:Brush,
  placements:{kind:'door'|'window';center:Vec3;options:ArchitectureOptions}[],
  texture:string
):{objects:Brush[];memberIds:string[][]}{
  const {min,max}=bounds(wall);
  const extent=max.map((v,i)=>v-min[i]) as Vec3;
  const thin=extent[0]<extent[1]?0:1;
  const across=thin===0?1:0;
  const rectangles:{left:number;right:number;bottom:number;top:number}[]=[];
  let remaining:Brush[]=[wall];
  const decorationGroups:Brush[][]=[];
  for(const placement of placements){
    // This also performs all standard dimension, margin, rotation and
    // eligibility validation against the ORIGINAL wall.
    const once=opening(wall,placement.kind,placement.options,texture,'Architecture '+placement.kind,{center:placement.center});
    const frame=placement.options.cutOnly?0:placement.options.frame;
    const center=[...placement.center] as Vec3;
    center[thin]=(min[thin]+max[thin])/2;
    if(placement.kind==='door')center[2]=min[2]+placement.options.height/2;
    const width=placement.options.width+2*frame;
    const bottom=center[2]-placement.options.height/2-(placement.kind==='window'?frame:0);
    const top=center[2]+placement.options.height/2+frame;
    const rect={left:center[across]-width/2,right:center[across]+width/2,bottom,top};
    if(rectangles.some(r=>rect.left<r.right-EPS&&rect.right>r.left+EPS&&rect.bottom<r.top-EPS&&rect.top>r.bottom+EPS))
      throw Error('The new opening overlaps an existing door or window. Move it farther apart.');
    rectangles.push(rect);
    const cutterCenter=[...center] as Vec3;
    if(placement.kind==='door')cutterCenter[2]+=frame/2;
    const cutterSize:Vec3=[width,width,top-bottom];
    cutterSize[thin]=extent[thin]+8;
    const cutter=createBrush('box',cutterCenter,cutterSize,'Wall opening cutter');
    remaining=remaining.flatMap(piece=>subtractConvex(piece,cutter));
    const prefix=`${wall.name} / ${placement.kind} wall `;
    decorationGroups.push(once.objects.filter((b):b is Brush=>b.kind==='brush'&&!b.name.startsWith(prefix)));
  }
  const walls=remaining.map((b,i)=>({...b,name:`${wall.name} / wall section ${i+1}`,group:wall.group}));
  const members=decorationGroups.map(parts=>[...walls.map(b=>b.id),...parts.map(p=>p.id)]);
  const all=[...walls,...decorationGroups.flat()];
  for(const b of all){const issues=validateBrush(b);if(issues.length)throw Error(`${b.name}: ${issues[0]}`)}
  return {objects:all,memberIds:members};
}
