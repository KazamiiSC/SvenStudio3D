/** v2.6 Optimisation assistant (TWHL: Total Map Optimisation 1-3, R_Speeds, Hint Brushes,
 * Reducing Clipnodes with zhlt_usemodel, Compiler charts and limits). Static estimates only:
 * real wpoly/clipnode counts come from the compiler, so every finding is a suggestion. */
import {transformedVertices} from './geometry';
import {uid,type Brush,type MapObject,type PointEntity,type Project} from './types';

export type OptFinding={id:string;level:'tip'|'warning';title:string;detail:string;ids:string[];action?:'detail'|'select';/** Replaces {n} in detail (keeps the text translatable). */n?:number};
export type OptReport={stats:{worldBrushes:number;worldFaces:number;detailBrushes:number;brushEntities:number;entities:number;textures:number;span:number};score:number;findings:OptFinding[]};

const TOOL=/^(sky|clip|hint|skip|origin|aaatrigger|null|bevel|solidhint|blackhole|clipbevel|cliphull\d|contentwater|translucent)$/i;
const isBrush=(o:MapObject):o is Brush=>o.kind==='brush';
function bounds(b:Brush){const p=transformedVertices(b);const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const v of p)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],v[i]);hi[i]=Math.max(hi[i],v[i]);}return {lo,hi,size:hi.map((h,i)=>h-lo[i])};}
const toolOnly=(b:Brush)=>b.faces.every(f=>TOOL.test(f.texture));
const signature=(b:Brush)=>{const {lo}=bounds(b);return transformedVertices(b).map(v=>v.map((x,i)=>Math.round(x-lo[i])).join(',')).sort().join(';')+'|'+b.faces.length;};

export function analyzeOptimization(project:Project):OptReport{
  const objects=project.objects;
  const ents=new Map(objects.filter((o):o is PointEntity=>o.kind==='entity').map(e=>[e.id,e]));
  const brushes=objects.filter(isBrush);
  const world=brushes.filter(b=>!b.entityId);
  const detail=brushes.filter(b=>b.entityId&&ents.get(b.entityId)?.classname==='func_detail');
  const textures=new Set(brushes.flatMap(b=>b.faces.map(f=>f.texture.toLowerCase())));
  const worldFaces=world.reduce((n,b)=>n+b.faces.filter(f=>!TOOL.test(f.texture)).length,0);
  let span=0;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  const info=new Map<string,ReturnType<typeof bounds>>();
  for(const b of brushes){const bb=bounds(b);info.set(b.id,bb);for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],bb.lo[i]);hi[i]=Math.max(hi[i],bb.hi[i]);}}
  if(brushes.length)span=Math.max(hi[0]-lo[0],hi[1]-lo[1]);
  const findings:OptFinding[]=[];
  // 1) Small or curved world brushes → func_detail (no VIS splits, fewer wpoly).
  const candidates=world.filter(b=>{if(b.locked||toolOnly(b))return false;const s=info.get(b.id)!.size;const max=Math.max(...s),min=Math.min(...s);
    return (max<=96&&min<=48)||(b.faces.length>8&&max<=320)||(min<=8&&max<=256);});
  if(candidates.length)findings.push({id:'detail',level:'tip',title:'Small and curved world brushes can be func_detail',detail:'They split VIS leaves and add world polygons. As func_detail they are compiled like world geometry but do not cut visibility. func_detail does not seal the map: compile again and check for leaks.',ids:candidates.map(b=>b.id),action:'detail'});
  // 2) Big map without any func_detail.
  if(world.length>300&&!detail.length)findings.push({id:'nodetail',level:'warning',title:'Large map with no func_detail',detail:'Every brush is structural, so VIS has to process all of them. Converting props, trims, pipes and furniture usually cuts compile time and r_speeds a lot.',ids:[]});
  // 3) Brushes with many faces → clipnodes.
  const heavy=brushes.filter(b=>b.faces.length>12&&!toolOnly(b));
  if(heavy.length)findings.push({id:'clipnodes',level:heavy.length>40?'warning':'tip',title:'Brushes with many faces add clipnodes',detail:'Cylinders, spheres and arches create many clip planes. Cover them with a simple CLIP brush and set zhlt_clipnodedetaillevel on their entity, or make them func_illusionary if players never touch them.',ids:heavy.map(b=>b.id),action:'select'});
  // 4) Repeated identical brush entities → zhlt_usemodel.
  const groups=new Map<string,string[]>();
  for(const e of ents.values()){if(e.props.zhlt_usemodel)continue;const own=brushes.filter(b=>b.entityId===e.id);if(own.length!==1)continue;
    const key=`${e.classname}|${signature(own[0])}`;(groups.get(key)??groups.set(key,[]).get(key)!).push(e.id);}
  const repeated=[...groups.values()].filter(g=>g.length>=3).flat();
  if(repeated.length)findings.push({id:'usemodel',level:'tip',title:'Identical brush entities could share one model',detail:'Several copies of the same brush entity each get their own model and clipnodes. With zhlt_usemodel the copies reuse one template (the template needs an ORIGIN brush).',ids:repeated,action:'select'});
  // 5) Wide map without hint brushes.
  const hasHint=brushes.some(b=>b.faces.some(f=>/^hint$/i.test(f.texture)));
  if(span>3072&&!hasHint)findings.push({id:'hint',level:'tip',title:'Wide map without HINT brushes',detail:'Large open areas let the engine see too much at once. HINT brushes at corners and doorways split visibility so distant rooms are not drawn (watch r_speeds in game).',ids:[]});
  // 6) Micro brushes.
  const micro=brushes.filter(b=>Math.min(...info.get(b.id)!.size)<1);
  if(micro.length)findings.push({id:'micro',level:'warning',title:'Brushes thinner than 1 unit',detail:'Micro brushes create tiny faces and compile errors (bad surface extents, invalid planes). Make them at least 1 unit thick or delete them.',ids:micro.map(b=>b.id),action:'select'});
  // 7) Engine limits (estimates).
  if(textures.size>400)findings.push({id:'textures',level:'warning',title:'Many different textures',detail:'{n} textures are used; the compiler limit is 512 and every texture costs memory. Reuse textures where possible.',n:textures.size,ids:[]});
  if(ents.size>1500)findings.push({id:'entities',level:'warning',title:'Close to the entity limit',detail:'{n} entities. Sven Co-op allows about 2048 at once including players, NPCs and projectiles. Merge relays into multi_manager and remove unused entities.',n:ents.size,ids:[]});
  if(worldFaces>20000)findings.push({id:'faces',level:'warning',title:'Very high world face count',detail:'About {n} visible world faces. Turn hidden faces to NULL, use func_detail and avoid tiny brushes to keep wpoly low.',n:worldFaces,ids:[]});
  const score=Math.max(0,Math.min(100,100-findings.reduce((n,f)=>n+(f.level==='warning'?18:6),0)));
  return {stats:{worldBrushes:world.length,worldFaces,detailBrushes:detail.length,brushEntities:new Set(brushes.map(b=>b.entityId).filter(Boolean)).size,entities:ents.size,textures:textures.size,span:Math.round(span)},score,findings};
}

/** Moves the given world brushes into one func_detail entity (single undo step in the store). */
export function convertToDetail(objects:readonly MapObject[],ids:readonly string[]):{objects:MapObject[];entityId:string;count:number}{
  const set=new Set(ids);const picked=objects.filter((o):o is Brush=>isBrush(o)&&set.has(o.id)&&!o.entityId&&!o.locked);
  if(!picked.length)throw Error('No unlocked world brushes to convert.');
  const id=uid();const n=picked.length;
  const position=[0,1,2].map(i=>picked.reduce((s,b)=>s+b.position[i],0)/n) as [number,number,number];
  const e:PointEntity={id,kind:'entity',name:'func_detail',classname:'func_detail',position,props:{zhlt_detaillevel:'1',zhlt_chopdown:'0',zhlt_chopup:'0',zhlt_clipnodedetaillevel:'1'},layer:'Detail'};
  const pickedIds=new Set(picked.map(b=>b.id));
  return {objects:[...objects.map(o=>pickedIds.has(o.id)?{...o,entityId:id}:o),e],entityId:id,count:n};
}
