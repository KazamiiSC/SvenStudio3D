/** v2.5 Gameplay Studio engine: pure helpers for the WebGL map and the Logic view.
 * Nothing here touches the project; everything is derived from entities and native references. */
import type {PointEntity} from './types';
import type {MapOutline} from './gameplayMap2d';

export type GLink={from:string;to:string;via:string};

/** All brush outlines as one LINE_SEGMENTS buffer (x,y pairs; y flipped so +y is up for the GPU). */
export function outlineSegments(outlines:readonly MapOutline[]):Float32Array{
  let count=0;for(const o of outlines)if(o.polygon.length>1)count+=o.polygon.length;
  const out=new Float32Array(count*4);let k=0;
  for(const o of outlines){const p=o.polygon;if(p.length<2)continue;
    for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];out[k++]=a[0];out[k++]=-a[1];out[k++]=b[0];out[k++]=-b[1];}}
  return out;
}

/** Floors detected from entity heights: sorted Z values split where the gap is larger than `gap`. */
export type Floor={id:string;index:number;min:number;max:number;center:number;count:number};
export function detectFloors(entities:readonly PointEntity[],gap=112,minCount=4):Floor[]{
  const zs=entities.map(e=>e.position[2]).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!zs.length)return [];
  const groups:number[][]=[[zs[0]]];
  for(let i=1;i<zs.length;i++){if(zs[i]-zs[i-1]>gap)groups.push([]);groups[groups.length-1].push(zs[i]);}
  // Tiny groups (a lamp near the ceiling) join the closest floor instead of becoming a floor.
  const merged:number[][]=[];
  for(const g of groups){if(g.length<minCount&&merged.length){merged[merged.length-1].push(...g);}else merged.push([...g]);}
  if(merged.length>1&&merged[0].length<minCount){merged[1].unshift(...merged[0]);merged.shift();}
  return merged.map((g,i)=>({id:`floor-${i}`,index:i,min:g[0],max:g[g.length-1],center:(g[0]+g[g.length-1])/2,count:g.length}));
}

/** The activation chain of an entity: what triggers it (backwards) and what it triggers (forwards). */
export function gameplayChain(links:readonly GLink[],id:string|null,maxDepth=12,maxNodes=400):{nodes:Set<string>;links:Set<number>}{
  const nodes=new Set<string>(),used=new Set<number>();
  if(!id)return {nodes,links:used};
  const out=new Map<string,number[]>(),inn=new Map<string,number[]>();
  links.forEach((l,i)=>{(out.get(l.from)??out.set(l.from,[]).get(l.from)!).push(i);(inn.get(l.to)??inn.set(l.to,[]).get(l.to)!).push(i);});
  nodes.add(id);
  for(const [index,key] of [[out,'to'],[inn,'from']] as const){
    let frontier=[id];
    for(let depth=0;depth<maxDepth&&frontier.length&&nodes.size<maxNodes;depth++){
      const next:string[]=[];
      for(const n of frontier)for(const li of index.get(n)??[]){used.add(li);const other=links[li][key];if(!nodes.has(other)){nodes.add(other);next.push(other);}}
      frontier=next;
    }
  }
  return {nodes,links:used};
}

/** Layered layout for the Logic view: sources on the left, each step one column to the right.
 * Cycles are broken (back edges ignored for depth); columns are ordered by the average row of the
 * nodes that feed them, so chains read left to right with few crossings. */
/** Each group of connected entities is laid out on its own; groups are packed in rows (biggest first),
 * so a map with many small chains reads like a page instead of one very tall column. */
export function layoutLogicGraph(ids:readonly string[],links:readonly GLink[],columnGap=320,rowGap=64,maxWidth=3200):Map<string,[number,number]>{
  const set=new Set(ids);const parent=new Map<string,string>();const find=(x:string):string=>{let r=x;while(parent.get(r)!==r)r=parent.get(r)!;while(parent.get(x)!==r){const n=parent.get(x)!;parent.set(x,r);x=n;}return r;};
  for(const id of set)parent.set(id,id);
  for(const l of links)if(set.has(l.from)&&set.has(l.to)){const a=find(l.from),b=find(l.to);if(a!==b)parent.set(a,b);}
  const groups=new Map<string,string[]>();for(const id of set){const r=find(id);(groups.get(r)??groups.set(r,[]).get(r)!).push(id);}
  const sorted=[...groups.values()].sort((a,b)=>b.length-a.length||a[0].localeCompare(b[0]));
  const out=new Map<string,[number,number]>();let cx=0,cy=0,rowH=0;const gap=200;
  for(const g of sorted){const local=layoutComponent(g,links,columnGap,rowGap);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const [x,y] of local.values()){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    const w=maxX-minX,h=maxY-minY;if(cx>0&&cx+w>maxWidth){cx=0;cy+=rowH+gap;rowH=0;}
    for(const [id,[x,y]] of local)out.set(id,[cx+x-minX,cy+y-minY]);cx+=w+gap+columnGap*.5;rowH=Math.max(rowH,h);}
  return out;
}
function layoutComponent(ids:readonly string[],links:readonly GLink[],columnGap:number,rowGap:number):Map<string,[number,number]>{
  const set=new Set(ids),pos=new Map<string,[number,number]>();
  const inner=links.filter(l=>set.has(l.from)&&set.has(l.to)&&l.from!==l.to);
  const out=new Map<string,string[]>(),indeg=new Map<string,number>();
  for(const id of set){out.set(id,[]);indeg.set(id,0);}
  for(const l of inner){out.get(l.from)!.push(l.to);}
  // 1) Mark back edges (cycles) with an iterative DFS. 2) Longest path on the remaining DAG (Kahn).
  const back=new Set<string>(),state=new Map<string,number>();
  for(const start of set){
    if(state.get(start))continue;
    const stack:[string,number][]=[[start,0]];state.set(start,1);
    while(stack.length){
      const top=stack[stack.length-1],next=out.get(top[0])!;
      if(top[1]<next.length){const child=next[top[1]++];const s=state.get(child)??0;
        if(s===1)back.add(`${top[0]}>${child}`);else if(s===0){state.set(child,1);stack.push([child,0]);}}
      else{state.set(top[0],2);stack.pop();}
    }
  }
  const dagOut=new Map<string,string[]>();for(const id of set){dagOut.set(id,[]);indeg.set(id,0);}
  for(const l of inner)if(!back.has(`${l.from}>${l.to}`)){dagOut.get(l.from)!.push(l.to);indeg.set(l.to,indeg.get(l.to)!+1);}
  const depth=new Map<string,number>();const queue=[...set].filter(id=>!indeg.get(id));for(const q of queue)depth.set(q,0);
  for(let qi=0;qi<queue.length;qi++){const n=queue[qi];for(const child of dagOut.get(n)!){depth.set(child,Math.max(depth.get(child)??0,(depth.get(n)??0)+1));indeg.set(child,indeg.get(child)!-1);if(!indeg.get(child))queue.push(child);}}  const columns=new Map<number,string[]>();
  for(const id of set){const d=Math.min(depth.get(id)??0,60);(columns.get(d)??columns.set(d,[]).get(d)!).push(id);}
  const row=new Map<string,number>();
  const preds=new Map<string,string[]>();for(const l of inner)(preds.get(l.to)??preds.set(l.to,[]).get(l.to)!).push(l.from);
  for(const d of [...columns.keys()].sort((a,b)=>a-b)){
    const col=columns.get(d)!;
    col.sort((a,b)=>{const avg=(n:string)=>{const p=(preds.get(n)??[]).filter(x=>row.has(x));return p.length?p.reduce((s,x)=>s+row.get(x)!,0)/p.length:Number.POSITIVE_INFINITY;};return avg(a)-avg(b)||a.localeCompare(b);});
    col.forEach((id,i)=>{row.set(id,i);pos.set(id,[d*columnGap,(i-(col.length-1)/2)*rowGap]);});
  }
  return pos;
}

/** Uniform grid over 2D points for fast picking (world units). */
export class PointGrid{
  private cells=new Map<string,number[]>();
  constructor(private xs:Float32Array,private ys:Float32Array,private cell=64){
    for(let i=0;i<xs.length;i++){const k=`${Math.floor(xs[i]/cell)},${Math.floor(ys[i]/cell)}`;(this.cells.get(k)??this.cells.set(k,[]).get(k)!).push(i);}
  }
  query(x:number,y:number,r:number):number[]{
    const out:number[]=[],c=this.cell,r2=r*r;
    for(let gx=Math.floor((x-r)/c);gx<=Math.floor((x+r)/c);gx++)for(let gy=Math.floor((y-r)/c);gy<=Math.floor((y+r)/c);gy++)
      for(const i of this.cells.get(`${gx},${gy}`)??[]){const dx=this.xs[i]-x,dy=this.ys[i]-y;if(dx*dx+dy*dy<=r2)out.push(i);}
    return out;
  }
}
