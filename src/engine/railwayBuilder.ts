/** Railway Builder 2.0: compile-safe tracks, platforms and native Sven Co-op
 * path_track/func_tracktrain templates. Gameplay entities are generated only
 * for the rail profile, and remain associated with their editable path record.
 * Complex turnout clipping is NOT simulated: treat visual junctions as a
 * preview and verify behaviour in Sven Co-op after BSP compilation.
 */
import type {Brush,MapObject,PointEntity,Vec3} from './types';
import {uid} from './types';
import {createBrush} from './geometry';
import {validateBrush} from './exportMap';
import {createPathStructureBrushes,pathStations,samplePath,type PathStructureOptions} from './pathStructures';

export type RailwaySettings={
  prefix:string;
  doubleTrack?:boolean;parallelSpacing?:number;
  branch?:boolean;branchNode?:number;branchSide?:'left'|'right';
  station?:boolean;stationNode?:number;stationSide?:'left'|'right';
  platformWidth?:number;platformLength?:number;stationStop?:boolean;
  train?:boolean;trainControls?:boolean;trainSpeed?:number;trainLength?:number;
};
export type RailwayExtras={brushes:Brush[];entities:PointEntity[];warnings:string[]};
const validPrefix=/^[a-z][a-z0-9_]{2,22}$/;
const round=(n:number)=>Math.round(n*1000)/1000;
const plus=(p:Vec3,v:Vec3):Vec3=>[round(p[0]+v[0]),round(p[1]+v[1]),round(p[2]+v[2])];
const nearby=(points:Vec3[],point:Vec3)=>points.reduce((best,p,i)=>{
  const distance=Math.hypot(p[0]-point[0],p[1]-point[1],p[2]-point[2]);
  return distance<best.dist?{index:i,dist:distance}:best;
},{index:0,dist:Infinity}).index;
const norm=(dx:number,dy:number):[number,number]=>{const l=Math.hypot(dx,dy)||1;return [dx/l,dy/l]};
const makePoint=(name:string,classname:string,position:Vec3,props:Record<string,string>,group:string):PointEntity=>({
  id:uid(),kind:'entity',name,classname,position:[...position],props,group,layer:'Railway'
});
const texBox=(center:Vec3,size:Vec3,texture:string,name:string,group:string,entityId?:string,angle=0):Brush=>{
  const brush=createBrush('box',center,size,name);brush.rotation=[0,0,angle];
  brush.faces=brush.faces.map(face=>({...face,texture}));brush.group=group;
  brush.layer='Railway';if(entityId)brush.entityId=entityId;
  return brush;
};
export function defaultRailwaySettings():RailwaySettings{
  return {prefix:`rail_${uid().replace(/[^a-z0-9]/gi,'').slice(0,11).toLowerCase()}`,doubleTrack:false,parallelSpacing:192,
    branch:false,branchNode:0,branchSide:'left',station:false,stationNode:1,stationSide:'right',
    platformLength:192,platformWidth:96,stationStop:false,train:false,trainControls:true,trainSpeed:180,trainLength:96};
}
export function validateRailwaySettings(r:RailwaySettings|undefined,points:Vec3[]):string[]{
  if(!r)return [];
  const errors:string[]=[];
  if(!validPrefix.test(r.prefix))errors.push('Railway network ID must use 3–23 lowercase letters, numbers and underscores.');
  if(!Number.isFinite(r.parallelSpacing??192)||(r.parallelSpacing??192)<96||(r.parallelSpacing??192)>512)errors.push('Parallel track spacing must be 96–512 units.');
  if(!Number.isInteger(r.branchNode??0)||(r.branchNode??0)<0||(r.branchNode??0)>=points.length-1)errors.push('Turnout must start before the final path point.');
  if(!Number.isInteger(r.stationNode??0)||(r.stationNode??0)<0||(r.stationNode??0)>=points.length)errors.push('Invalid station path point.');
  if(!['left','right'].includes(r.branchSide??'left')||!['left','right'].includes(r.stationSide??'right'))errors.push('Invalid railway side.');
  if(!Number.isFinite(r.platformLength??192)||(r.platformLength??192)<64||(r.platformLength??192)>512)errors.push('Platform length must be 64–512 units.');
  if(!Number.isFinite(r.platformWidth??96)||(r.platformWidth??96)<48||(r.platformWidth??96)>256)errors.push('Platform width must be 48–256 units.');
  if(!Number.isFinite(r.trainSpeed??180)||(r.trainSpeed??180)<16||(r.trainSpeed??180)>800)errors.push('Train speed must be 16–800 units/second.');
  if(!Number.isFinite(r.trainLength??96)||(r.trainLength??96)<48||(r.trainLength??96)>256)errors.push('Train length must be 48–256 units.');
  for(const name of ['doubleTrack','branch','station','stationStop','train','trainControls'] as const)
    if(r[name]!==undefined&&typeof r[name]!=='boolean')errors.push(`Invalid ${name} option.`);
  return errors;
}
function yaw(a:Vec3,b:Vec3){return Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI}
function branchPath(o:PathStructureOptions,samples:Vec3[],settings:RailwaySettings):{points:Vec3[];junction:number}{
  const junction=Math.min(samples.length-2,nearby(samples,o.points[Math.min(settings.branchNode??0,o.points.length-2)]));
  const a=samples[junction],b=samples[junction+1],v=norm(b[0]-a[0],b[1]-a[1]);
  const n:[number,number]=[-v[1],v[0]],side=settings.branchSide==='right'?-1:1,offset=Math.max(192,o.width*2);
  const branch1:Vec3=[round(a[0]+v[0]*offset*.85+n[0]*offset*.5*side),round(a[1]+v[1]*offset*.85+n[1]*offset*.5*side),a[2]+(b[2]-a[2])*.85];
  const branch2:Vec3=[round(a[0]+v[0]*offset*1.9+n[0]*offset*side),round(a[1]+v[1]*offset*1.9+n[1]*offset*side),a[2]+(b[2]-a[2])*1.9];
  return {points:[[...a],branch1,branch2],junction};
}
/** Generate optional geometric and gameplay add-ons. Never mutates the supplied
 * options or project. The core rail geometry is generated separately.
 * The caller must preserve all of these brushes/entities on route regeneration.
 */
export function createRailwayExtras(o:PathStructureOptions,verify=false):RailwayExtras{
  if(o.kind!=='rail'||!o.railway)return {brushes:[],entities:[],warnings:[]};
  const r=o.railway,errors=validateRailwaySettings(r,o.points);if(errors.length)throw Error(errors.join(' '));
  const samples=samplePath(o);
  if(samples.length<2||samples.length>160)throw Error('The railway network needs 2–160 sampled points. Reduce curve detail or split the route.');
  const group=`Railway ${r.prefix}`,brushes:Brush[]=[],entities:PointEntity[]=[],warnings:string[]=[];
  const s=pathStations(samples,o.width);
  const appendRails=(points:Vec3[],name:string)=>{
    const output=createPathStructureBrushes({...o,points,smooth:false,railway:undefined,name,sidewalkWidth:0},verify);
    brushes.push(...output);
  };
  if(r.doubleTrack){
    const offset=r.parallelSpacing??192;
    const parallelRaw=samples.map((p,i)=>plus(p,[round(s.normals[i][0]*offset),round(s.normals[i][1]*offset),0]));
    // Offset curves can locally compress: remove short segments before making
    // a GoldSrc brush (world brushes may not have near-zero-length edges).
    const parallel:Vec3[]=[parallelRaw[0]];
    for(let i=1;i<parallelRaw.length-1;i++)if(Math.hypot(parallelRaw[i][0]-parallel.at(-1)![0],parallelRaw[i][1]-parallel.at(-1)![1])>=16)parallel.push(parallelRaw[i]);
    if(Math.hypot(parallelRaw.at(-1)![0]-parallel.at(-1)![0],parallelRaw.at(-1)![1]-parallel.at(-1)![1])<16)parallel.pop();
    parallel.push(parallelRaw.at(-1)!);
    appendRails(parallel,`${group} parallel line`);
  }
  let branch:{points:Vec3[];junction:number}|null=null;
  if(r.branch){
    branch=branchPath(o,samples,r);
    appendRails(branch.points,`${group} turnout`);
    warnings.push('Visual turnout is experimental: inspect the shared junction rails and collision in Sven Co-op.');
  }
  const nearStation=Math.min(samples.length-1,nearby(samples,o.points[Math.min(r.stationNode??0,o.points.length-1)]));
  if(r.station){
    const i=nearStation,p=samples[i],other=samples[i<samples.length-1?i+1:i-1];
    const along=norm(other[0]-p[0],other[1]-p[1]);
    const forward=i<samples.length-1?along:[-along[0],-along[1]] as [number,number];
    const lateral:[number,number]=[-forward[1],forward[0]];
    const side=r.stationSide==='left'?1:-1,w=r.platformWidth??96,l=r.platformLength??192;
    const offset=o.width/2+w/2+24;
    const center:Vec3=[round(p[0]+lateral[0]*offset*side),round(p[1]+lateral[1]*offset*side),round(p[2]+8)];
    brushes.push(texBox(center,[l,w,16],o.texture,`${group} station platform`,group,undefined,Math.atan2(forward[1],forward[0])*180/Math.PI));
    warnings.push('Station platform is a flat local platform; it does not automatically cut or raise surrounding terrain.');
  }
  const id=(index:number)=>`${r.prefix}_p${index+1}`;
  const trackHeight=24;
  // A node at every sampled station keeps native track-train movement close to
  // the geometry, rather than cutting across a curved railway by control points.
  for(let i=0;i<samples.length;i++){
    const props:Record<string,string>={targetname:id(i)};
    if(i<samples.length-1)props.target=id(i+1);
    if(branch&&i===branch.junction)props.altpath=`${r.prefix}_b1`;
    if(r.station&&r.stationStop&&i===nearStation)props.newspeed='0';
    entities.push(makePoint(`Rail path ${i+1}`,'path_track',plus(samples[i],[0,0,trackHeight]),props,group));
  }
  if(branch){
    entities.push(makePoint('Rail branch 1','path_track',plus(branch.points[1],[0,0,trackHeight]),{targetname:`${r.prefix}_b1`,target:`${r.prefix}_b2`},group));
    entities.push(makePoint('Rail branch terminal','path_track',plus(branch.points[2],[0,0,trackHeight]),{targetname:`${r.prefix}_b2`},group));
    const j=branch.points[0],a=samples[branch.junction],b=samples[branch.junction+1],v=norm(b[0]-a[0],b[1]-a[1]);
    const sign=r.branchSide==='right'?-1:1;
    const controls=makePoint('Turnout switch','func_button',plus(j,[-v[1]*(o.width+70)*sign,v[0]*(o.width+70)*sign,36]),{
      targetname:`${r.prefix}_switch`,target:id(branch.junction),wait:'1',speed:'5'},group);
    entities.push(controls);
    brushes.push(texBox([...controls.position], [32,32,16],o.texture,'Turnout switch button',group,controls.id));
  }
  if(r.train){
    const p=samples[0],center=plus(p,[0,0,48]),train=makePoint('Player-controlled railway train','func_tracktrain',center,{
      targetname:`${r.prefix}_train`,target:id(0),speed:String(r.trainSpeed??180),startspeed:'0',
      wheels:String(r.trainLength??96),sounds:'0',angles:'0 90 0'
    },group);
    entities.push(train);
    const w=Math.max(32,Math.min(o.width*.7,128)),len=r.trainLength??96;
    brushes.push(texBox(center,[len,w,48],o.texture,`${group} train body`,group,train.id));
    brushes.push(texBox(plus(p,[0,0,24]),[8,8,8],'ORIGIN',`${group} origin brush`,group,train.id));
    if(r.trainControls!==false){
      const controls=makePoint('Train control volume','func_traincontrols',plus(p,[0,0,78]),{target:`${r.prefix}_train`},group);
      entities.push(controls);
      brushes.push(texBox([...controls.position],[Math.min(48,len-8),Math.min(36,w-8),20],o.texture,`${group} train controls`,group,controls.id));
    }
    warnings.push('Train is a starter brush template with an ORIGIN brush; verify player controls, orientation and clearances in Sven Co-op.');
  }
  if(brushes.length>600)throw Error('Railway extras exceed 600 brushes; reduce route detail or switch off repeats.');
  if(verify)for(const brush of brushes){const errors=validateBrush(brush);if(errors.length)throw Error(errors.join(' | '));}
  return {brushes,entities,warnings};
}
/** Compact hash of native entity data for non-destructive saved-route edits. */
export function railwayEntitySignature(entity:PointEntity):string{
  const data=JSON.stringify([entity.classname,entity.position,entity.props,entity.name]);
  let hash=2166136261;for(let i=0;i<data.length;i++)hash=Math.imul(hash^data.charCodeAt(i),16777619);
  return `rail:${(hash>>>0).toString(16).padStart(8,'0')}`;
}
/** Detect missing, duplicate or dangling generated train links; external links
 * are intentionally permitted elsewhere in user-authored map projects. */
export function checkRailwayGraph(entities:PointEntity[]):string[]{
  const errors:string[]=[],names=new Set<string>();
  for(const e of entities){const name=e.props.targetname;
    if(name){if(names.has(name))errors.push(`Duplicate railway targetname: ${name}`);names.add(name);}
  }
  for(const entity of entities){
    if(entity.classname==='path_track')for(const key of ['target','altpath']){
      const next=entity.props[key];if(next&&!names.has(next))errors.push(`Disconnected railway ${key}: ${next}`);
    }
    if(entity.classname==='func_tracktrain'&&(!names.has(entity.props.target)||!entity.props.targetname))errors.push('Track train has no valid first path_track or name.');
  }
  return errors;
}
