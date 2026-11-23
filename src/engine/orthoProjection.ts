/** Top / Front / Side wireframe projections for the optional 4-view layout.
 * GoldSrc axes: X right, Y forward, Z up. Screen Y grows downward, so the vertical axis is negated.
 */
import type {Brush,MapObject,Vec3} from './types';
import {transformedVertices} from './geometry';
import {uniqueBrushEdges} from './modeling';

export type OrthoView='top'|'front'|'side';
export const ORTHO_VIEWS:readonly OrthoView[]=['top','front','side'];
/** [horizontal axis, vertical axis] in game coordinates for each view. */
export const ORTHO_AXES:Record<OrthoView,[0|1|2,0|1|2]>={top:[0,1],front:[0,2],side:[1,2]};

export type Projected={id:string;kind:'brush'|'entity';path:string;min:[number,number];max:[number,number];entityBrush:boolean};

export function project2d(p:Vec3,view:OrthoView):[number,number]{
  const [h,v]=ORTHO_AXES[view];
  return [p[h],-p[v]];
}

const r=(n:number)=>Math.round(n*10)/10;

// Map objects are immutable: an unchanged object keeps its identity, so its projection is cached.
// Editing one brush in a 3000-brush map only re-projects that brush.
const cache:Record<OrthoView,WeakMap<MapObject,Projected|null>>={top:new WeakMap(),front:new WeakMap(),side:new WeakMap()};

/** Screen-space (world units, Y flipped) edges and bounds of every visible object. */
export function projectObjects(objects:readonly MapObject[],view:OrthoView):Projected[]{
  const out:Projected[]=[];
  for(const o of objects){
    if(o.hidden)continue;
    let projected=cache[view].get(o);
    if(projected===undefined){projected=projectOne(o,view);cache[view].set(o,projected);}
    if(projected)out.push(projected);
  }
  return out;
}

function projectOne(o:MapObject,view:OrthoView):Projected|null{
  {
    if(o.kind==='entity'){
      const [x,y]=project2d(o.position,view);
      return {id:o.id,kind:'entity',path:'',min:[x,y],max:[x,y],entityBrush:false};
    }
    const pts=transformedVertices(o).map(p=>project2d(p,view));
    if(!pts.length)return null;
    let path='';
    for(const [a,b] of uniqueBrushEdges(o)){
      const pa=pts[a],pb=pts[b];
      if(!pa||!pb)continue;
      if(Math.abs(pa[0]-pb[0])<1e-6&&Math.abs(pa[1]-pb[1])<1e-6)continue; // edge seen end-on
      path+=`M${r(pa[0])} ${r(pa[1])}L${r(pb[0])} ${r(pb[1])}`;
    }
    const min:[number,number]=[Infinity,Infinity],max:[number,number]=[-Infinity,-Infinity];
    for(const [x,y] of pts){min[0]=Math.min(min[0],x);min[1]=Math.min(min[1],y);max[0]=Math.max(max[0],x);max[1]=Math.max(max[1],y);}
    return {id:o.id,kind:'brush',path,min,max,entityBrush:!!o.entityId};
  }
}

/** Smallest object whose 2D bounds contain the point (entities win within their marker radius). */
export function pickProjected(items:readonly Projected[],x:number,y:number,entityRadius:number):string|null{
  let best:string|null=null,bestArea=Infinity;
  for(const it of items){
    if(it.kind==='entity'){
      if(Math.abs(it.min[0]-x)<=entityRadius&&Math.abs(it.min[1]-y)<=entityRadius)return it.id;
      continue;
    }
    if(x<it.min[0]||x>it.max[0]||y<it.min[1]||y>it.max[1])continue;
    const area=Math.max(1,(it.max[0]-it.min[0])*(it.max[1]-it.min[1]));
    if(area<bestArea){bestArea=area;best=it.id;}
  }
  return best;
}

/** Screen drag (world units, Y flipped) → 3D move delta, snapped to the grid. */
export function dragDelta(view:OrthoView,dx:number,dy:number,snap:number):Vec3{
  const [h,v]=ORTHO_AXES[view];
  const s=(n:number)=>snap>0?Math.round(n/snap)*snap:Math.round(n*1000)/1000;
  const delta:Vec3=[0,0,0];
  delta[h]=s(dx);delta[v]=s(-dy);
  return delta;
}

export function boundsOf(items:readonly Projected[],ids?:ReadonlySet<string>):{min:[number,number];max:[number,number]}|null{
  const min:[number,number]=[Infinity,Infinity],max:[number,number]=[-Infinity,-Infinity];
  let any=false;
  for(const it of items){
    if(ids&&!ids.has(it.id))continue;
    any=true;min[0]=Math.min(min[0],it.min[0]);min[1]=Math.min(min[1],it.min[1]);max[0]=Math.max(max[0],it.max[0]);max[1]=Math.max(max[1],it.max[1]);
  }
  return any?{min,max}:null;
}

/** World-space bounds of a brush (game units). */
export function brushBounds(brush:Brush):{min:Vec3;max:Vec3}{
  const pts=transformedVertices(brush);
  const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const p of pts)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
  return {min,max};
}
/** Resize handles only apply to brushes without rotation (their bounds are their real faces). */
export function resizableBrush(o:MapObject|undefined):o is Brush{
  return !!o&&o.kind==='brush'&&!o.locked&&!o.hidden&&o.rotation.every(v=>Math.abs(v)<1e-6)&&o.scale.every(v=>v>0);
}
/** New scale/position so the brush exactly fills [min,max]; the opposite side stays put. */
export function fitBrushToBounds(brush:Brush,min:Vec3,max:Vec3):Brush{
  if(!resizableBrush(brush))throw Error('Only unrotated, unlocked brushes can be resized from the 2D views.');
  if([...min,...max].some(v=>!Number.isFinite(v))||max.some((v,i)=>v-min[i]<1))throw Error('The brush must stay at least 1 unit thick.');
  const lmin:Vec3=[Infinity,Infinity,Infinity],lmax:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const v of brush.vertices)for(let i=0;i<3;i++){lmin[i]=Math.min(lmin[i],v[i]);lmax[i]=Math.max(lmax[i],v[i]);}
  const scale=[0,1,2].map(i=>Math.round((max[i]-min[i])/(lmax[i]-lmin[i])*1e6)/1e6) as Vec3;
  const position=[0,1,2].map(i=>Math.round((min[i]-lmin[i]*scale[i])*1e5)/1e5) as Vec3;
  return {...brush,scale,position};
}
