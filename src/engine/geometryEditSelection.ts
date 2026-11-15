/** HF22: sub-object selection helpers shared by the MAP viewport and inspector.
 * This is NOT a new modeling engine: existing convex-hull/CSG editing is reused.
 * Everything here is pure, for predictable Shift/Ctrl selection and undo. */
import type {Vec3} from './types';

export function selectedGeometryIndices(current:readonly number[], clicked:readonly number[], additive:boolean):number[]{
  const part=[...new Set(clicked.filter(i=>Number.isInteger(i)&&i>=0))];
  if(!additive)return part;
  const old=new Set(current.filter(i=>Number.isInteger(i)&&i>=0));
  // Shift+click on a selected vertex/edge toggles that handle off.
  if(part.length&&part.every(i=>old.has(i)))part.forEach(i=>old.delete(i));
  else part.forEach(i=>old.add(i));
  return [...old].sort((a,b)=>a-b);
}

export function geometrySelectionCentroid(points:readonly Vec3[],selected:readonly number[]):Vec3|null{
  const ids=[...new Set(selected)].filter(i=>Number.isInteger(i)&&i>=0&&i<points.length);
  if(!ids.length)return null;
  const out:Vec3=[0,0,0];
  for(const id of ids){const p=points[id];if(p.some(n=>!Number.isFinite(n)))return null;for(let i=0;i<3;i++)out[i]+=p[i]}
  return out.map(n=>n/ids.length) as Vec3;
}

export function sanitizeGeometryDelta(value:readonly number[],snap=0):Vec3{
  if(value.length!==3||value.some(n=>!Number.isFinite(n)))throw Error('Geometry delta must contain three finite coordinates.');
  if(!Number.isFinite(snap)||snap<0)throw Error('Invalid snap increment.');
  return value.map(n=>{
    const v=snap>0?Math.round(n/snap)*snap:n;
    if(Math.abs(v)>131072)throw Error('Geometry displacement is outside safe map limits.');
    return Math.round(v*100000)/100000;
  }) as Vec3;
}

export type EditableEdge=readonly [number,number];
/** Keep actual edge selections, rather than inferring selected edges from a
 * vertex union (which would accidentally select extra adjacent edges). */
export function selectedGeometryEdges(current:readonly EditableEdge[],clicked:EditableEdge,additive:boolean):[number,number][]{
  const pair=[...clicked].sort((a,b)=>a-b) as [number,number];
  if(pair.length!==2||pair[0]===pair[1]||pair.some(n=>!Number.isInteger(n)||n<0))return [...current].map(p=>[p[0],p[1]]);
  const before=additive?[...current].map(p=>[...p].sort((a,b)=>a-b) as [number,number]):[];
  const index=before.findIndex(p=>p[0]===pair[0]&&p[1]===pair[1]);
  if(index>=0)before.splice(index,1);
  else before.push(pair);
  return before;
}
export function edgeSelectionVertices(edges:readonly EditableEdge[]):number[]{
  return [...new Set(edges.flatMap(p=>[p[0],p[1]]))].sort((a,b)=>a-b);
}
