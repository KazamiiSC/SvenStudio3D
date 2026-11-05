/** Editor-side merge operations. A GoldSrc brush must remain convex. */
import {createBrush,transformedVertices} from './geometry';
import {rebuildConvexBrush} from './modeling';
import {intersectConvex} from './advancedModeling';
import {validateBrush} from './exportMap';
import {uid} from './types';
import type {Brush,Vec3} from './types';

function volume(b:Brush):number{
  const p=transformedVertices(b);
  const c:Vec3=[0,0,0];p.forEach(v=>v.forEach((n,i)=>c[i]+=n));c.forEach((_,i)=>c[i]/=p.length);
  let total=0;
  for(const face of b.faces){
    if(face.indices.length<3)continue;
    const a=p[face.indices[0]];
    for(let j=1;j<face.indices.length-1;j++){
      const q=p[face.indices[j]],r=p[face.indices[j+1]];
      const x=a.map((n,i)=>n-c[i]);const y=q.map((n,i)=>n-c[i]);const z=r.map((n,i)=>n-c[i]);
      total+=Math.abs(x[0]*(y[1]*z[2]-y[2]*z[1])-x[1]*(y[0]*z[2]-y[2]*z[0])+x[2]*(y[0]*z[1]-y[1]*z[0]))/6;
    }
  }
  return total;
}
export function mergeIntoConvexBrush(brushes:Brush[]):Brush{
  if(brushes.length<2)throw Error('Select at least two brushes.');
  const entity=brushes[0].entityId;
  if(brushes.some(b=>b.locked||b.hidden||b.entityId!==entity))throw Error('All brushes must be visible, unlocked and belong to the same entity/world.');
  let current=brushes[0];
  for(const other of brushes.slice(1)){
    const source:Brush={...current,vertices:transformedVertices(current),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
    const points:Vec3[]=[];
    for(const v of [...source.vertices,...transformedVertices(other)]){
      if(!points.some(p=>p.every((n,i)=>Math.abs(n-v[i])<1e-5)))points.push(v);
    }
    let hull:Brush;
    if([current,other].every(b=>b.primitive==='box'&&b.rotation.every(v=>Math.abs(v)<1e-6))){
      const low=[0,1,2].map(i=>Math.min(...points.map(v=>v[i]))) as Vec3;
      const high=[0,1,2].map(i=>Math.max(...points.map(v=>v[i]))) as Vec3;
      hull=createBrush('box',low.map((v,i)=>(v+high[i])/2) as Vec3,high.map((v,i)=>v-low[i]) as Vec3,'Merged Brush');
      hull.faces=hull.faces.map(f=>({...f,texture:current.faces[0]?.texture||'NULL'}));
    }else{
      try{hull=rebuildConvexBrush(source,points,{requireAllVertices:false})}
      catch{throw Error('Cannot create a valid convex brush from these solids. Use Smart Merge instead.');}
    }
    const unitedVolume=volume(current)+volume(other)-volume(intersectConvex(current,other)??{...current,faces:[],vertices:[]});
    const hullVolume=volume(hull);
    if(hullVolume<1e-3||Math.abs(hullVolume-unitedVolume)>Math.max(.05,unitedVolume*.0005))
      throw Error('The union would be concave or disconnected. Use Smart Merge to keep valid convex brushes.');
    const problems=validateBrush(hull);
    if(problems.length)throw Error(`Merged brush invalid: ${problems[0]}`);
    current={...hull,id:uid(),name:'Merged Brush',primitive:hull.primitive,layer:brushes[0].layer,group:brushes[0].group,entityId:entity};
  }
  return current;
}
