/** World Builder Studio 1.9.3 — non-destructive route/terrain integration.
 * Plans are pure. A caller must validate generated brushes and commit terrain
 * plus the new route as ONE editor transaction; no world BSP subtraction.
 */
import type {Vec3} from './types';
import {terrainTopVertex,validateTerrainDraft,type TerrainDraft} from './terrain';
import {samplePath,validatePathStructure,type PathStructureOptions} from './pathStructures';

export type SmartWorldSettings={shoulder:number;clearance:number};
export type SmartWorldPlan={terrain:TerrainDraft;path:PathStructureOptions;changedVertices:number;openedCells:number;warnings:string[]};
const round=(n:number)=>Math.round(n*100)/100;
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const smoothstep=(x:number)=>{const v=clamp(x,0,1);return v*v*(3-2*v)};
/** Sample the ACTUAL two-triangle surface used by the MAP export, not a
 * bilinear heightmap (which can disagree with diagonal-flipped brush faces). */
export function smartTerrainHeightAt(d:TerrainDraft,x:number,y:number):number{
  const u=(x-d.origin[0]+d.width/2)/d.width,v=(y-d.origin[1]+d.depth/2)/d.depth;
  if(u<0||u>1||v<0||v>1)throw Error('Route must stay completely inside the selected saved terrain.');
  const n=d.resolution,px=u*n,py=v*n,i=Math.min(n-1,Math.floor(px)),j=Math.min(n-1,Math.floor(py));
  const fx=px-i,fy=py-j,row=n+1;
  const a=d.heights[j*row+i],b=d.heights[j*row+i+1],c=d.heights[(j+1)*row+i+1],e=d.heights[(j+1)*row+i];
  const flip=d.diagonalFlips?.[j*n+i]===1;
  let h:number;
  if(flip)h=fx+fy<=1?a*(1-fx-fy)+b*fx+e*fy:b*(1-fy)+c*(fx+fy-1)+e*(1-fx);
  else h=fx>=fy?a*(1-fx)+b*(fx-fy)+c*fy:a*(1-fy)+c*fx+e*(fy-fx);
  return round(d.origin[2]+h);
}
const surfaceAt=smartTerrainHeightAt;
// XY distance and elevation of the nearest line segment, in GoldSrc coordinates.
function nearest(points:Vec3[],x:number,y:number){
  let best=Infinity,z=0;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
    if(len<0.01)continue;
    const t=clamp(((x-a[0])*dx+(y-a[1])*dy)/len,0,1),px=a[0]+dx*t,py=a[1]+dy*t;
    const dist=Math.hypot(px-x,py-y);
    if(dist<best){best=dist;z=a[2]+(b[2]-a[2])*t;}
  }
  return {distance:best,height:z};
}
/** Pure preview planner. Does not read or mutate the editor store. */
export function planSmartWorld(terrain:TerrainDraft,original:PathStructureOptions,settings:SmartWorldSettings):SmartWorldPlan{
  const errors=[...validateTerrainDraft(terrain),...validatePathStructure(original)];
  if(errors.length)throw Error(errors.join(' · '));
  if(!Number.isFinite(settings.shoulder)||settings.shoulder<16||settings.shoulder>512)throw Error('Shoulder blend must be between 16 and 512 units.');
  if(!Number.isFinite(settings.clearance)||settings.clearance<4||settings.clearance>128)throw Error('Clearance must be between 4 and 128 units.');
  if(!['road','walkway','cave'].includes(original.kind))throw Error('Smart integration is available only for roads, walkways and cave tunnels.');
  // Never flatten unrelated terrain, edit user-authored routes, or relocate an
  // existing route automatically. Only newly generated paths are supported.
  const warnings:string[]=[];
  const d={...terrain,origin:[...terrain.origin] as Vec3,heights:[...terrain.heights],excludedCells:terrain.excludedCells?[...terrain.excludedCells]:undefined};
  const path={...original,points:original.points.map(p=>[...p] as Vec3)};
  const footprint=path.width/2+(path.kind==='road'?(path.sidewalkWidth??0):0);
  const margin=footprint+(path.kind==='cave'?0:settings.shoulder);
  const xmin=d.origin[0]-d.width/2,xmax=d.origin[0]+d.width/2;
  const ymin=d.origin[1]-d.depth/2,ymax=d.origin[1]+d.depth/2;
  // Route and its full width must lie on the selected terrain, not merely its
  // control points. Otherwise it could carve the boundary or neighboring maps.
  const sourceSamples=samplePath(path);
  if(sourceSamples.length<2)throw Error('Route must contain at least two usable stations.');
  for(const p of sourceSamples){
    if(p[0]-margin<xmin||p[0]+margin>xmax||p[1]-margin<ymin||p[1]+margin>ymax)
      throw Error('Route or its width/shoulder crosses the terrain boundary. Move it inward or reduce width.');
  }
  const cellSize=Math.max(d.width,d.depth)/d.resolution;
  if(cellSize>path.width*.8)warnings.push('Terrain cells are wide compared with this route. Increase terrain resolution for cleaner edges.');

  if(path.kind==='cave'){
    if((d.baseMode??'solid')!=='thin')throw Error('Cave surface portals require Thin surface terrain. Solid/custom bases are left untouched.');
    if(sourceSamples.length<3)throw Error('Cave portal requires at least three sampled stations. Add another control point.');
    // The tunnel is routed beneath the heightfield. End station roof panels
    // are omitted and the corresponding TOP terrain cells become open portals.
    // This is NOT a volumetric boolean cut and must be checked for map sealing.
    const drop=path.height*.5+(d.surfaceThickness??16)+settings.clearance;
    path.points=path.points.map(p=>[p[0],p[1],round(surfaceAt(d,p[0],p[1])-drop)]);
    path.surfacePortals=true;
    const samples=samplePath(path);
    for(const p of samples){
      if(p[0]-margin<xmin||p[0]+margin>xmax||p[1]-margin<ymin||p[1]+margin>ymax)
        throw Error('Cave route leaves the terrain after elevation adjustment. Reduce curves or move the route.');
      const h=surfaceAt(d,p[0],p[1]);
      if(p[2]+path.height*.5+settings.clearance>h-(d.surfaceThickness??16)+0.1)
        throw Error('Cave roof collides with the terrain. Use fewer curves or a larger clearance.');
    }
    const n=d.resolution,mask=d.excludedCells??Array(n*n).fill(0),before=mask.filter(Boolean).length;
    const entrances=[samples[0],samples[samples.length-1]];
    const half=path.width/2;
    for(const endpoint of entrances){
      let candidates:{index:number;distance:number}[]=[];
      for(let j=0;j<n;j++)for(let i=0;i<n;i++){
        const x=xmin+(i+.5)*d.width/n,y=ymin+(j+.5)*d.depth/n;
        const distance=Math.hypot(endpoint[0]-x,endpoint[1]-y);
        if(distance<=half+Math.max(d.width/n,d.depth/n)*.25)candidates.push({index:j*n+i,distance});
      }
      candidates.sort((a,b)=>a.distance-b.distance);
      // Ensure a portal has a reliable hole even when its center falls right
      // on a grid boundary. Limit removal to 4 cells per mouth.
      if(!candidates.length)throw Error('Portal cannot align to the terrain grid. Refine resolution or move the entrance.');
      for(const c of candidates.slice(0,4))mask[c.index]=1;
    }
    if(mask.filter(Boolean).length>=n*n*.3)throw Error('Cave portals would remove too much terrain. Increase terrain size or reduce portal width.');
    if(d.optimized)warnings.push('Cave portal cells disable planar merging. Review resulting terrain brush count.');
    d.excludedCells=mask;d.optimized=false;
    const opened=mask.filter(Boolean).length-before;
    if(opened===0)throw Error('These entrances already have cutouts. Place them elsewhere.');
    warnings.push('Surface portals open through thin terrain only. Stairs/ramps and BSP sealing must be checked in Sven Co-op.');
    return {terrain:d,path,changedVertices:0,openedCells:opened,warnings};
  }

  // Seat the road/walkway on terrain, rather than using a fixed Z=0. Use the
  // control points as an editable design grade and blend nearby vertex heights
  // smoothly to the underside of the road deck (no z-fighting on the top).
  path.points=path.points.map(p=>[p[0],p[1],round(surfaceAt(d,p[0],p[1])+settings.clearance)]);
  const centerline=samplePath(path);
  for(const p of centerline)surfaceAt(d,p[0],p[1]);
  let sharpest=0;
  for(let i=1;i<centerline.length;i++){
    const a=centerline[i-1],b=centerline[i],length=Math.hypot(a[0]-b[0],a[1]-b[1]);
    if(length>1)sharpest=Math.max(sharpest,Math.abs(b[2]-a[2])/length);
  }
  if(sharpest>1)throw Error('Road grade exceeds 100%. Smooth the terrain or change route control points.');
  if(sharpest>.35)warnings.push('Steep road section detected. Check NPC movement and player traction in-game.');
  let modified=0;
  for(let j=0;j<=d.resolution;j++)for(let i=0;i<=d.resolution;i++){
    const index=j*(d.resolution+1)+i;
    const [x,y]=terrainTopVertex(d,i,j),nearestPoint=nearest(centerline,x,y),distance=nearestPoint.distance;
    if(distance>margin)continue;
    const weight=distance<=footprint?1:1-smoothstep((distance-footprint)/settings.shoulder);
    const desired=nearestPoint.height-Math.max(4,original.wallThickness*.5);
    const height=round(d.heights[index]+(desired-d.origin[2]-d.heights[index])*weight);
    if(height<-512||height>512)throw Error('Smart road terrain elevation exceeds ±512. Move route or reduce heights.');
    if(Math.abs(height-d.heights[index])>.01){d.heights[index]=height;modified++;}
  }
  if(!modified)warnings.push('No terrain vertices lie in the road corridor. Increase shoulder width or terrain resolution.');
  if(d.excludedCells?.some(Boolean))warnings.push('This terrain contains cave portals; inspect how the road crosses them.');
  return {terrain:d,path,changedVertices:modified,openedCells:0,warnings};
}
