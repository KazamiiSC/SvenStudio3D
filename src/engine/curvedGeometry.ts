/** v1.9.7: valid curved ramps and bridges made from triangular closed prisms.
 * Split each radial quadrilateral into two triangles because a sloped
 * 4-corner polygon on a circular path would not be planar in GoldSrc.
 */
import {orientFaces,rotateBrushTextureLock} from './geometry';
import {validateBrush} from './exportMap';
import {uid} from './types';
import type {Brush,Face,Vec3} from './types';
export type CurveSettings={origin:Vec3;radius:number;width:number;thickness:number;sweep:number;rise:number;segments:number;startAngle:number;texture:string};
export type CurveRecord={id:string;options:CurveSettings;memberIds:string[];signatures:string[]};
export const defaultCurveSettings:CurveSettings={origin:[0,0,96],radius:256,width:128,thickness:16,sweep:180,rise:0,segments:12,startAngle:0,texture:'SV_BRICK01'};
const round=(n:number)=>Math.round(n*1e5)/1e5;
export function validateCurveSettings(o:CurveSettings):string[]{
 const errors:string[]=[];
 if(!o.origin.every(n=>Number.isFinite(n)&&Math.abs(n)<120000))errors.push('Invalid world origin.');
 if(!Number.isFinite(o.radius)||o.radius<32||o.radius>8192)errors.push('Radius must be 32–8192 units.');
 if(!Number.isFinite(o.width)||o.width<8||o.width>=o.radius*2||o.width>2048)errors.push('Width must fit within the curve radius.');
 if(!Number.isFinite(o.thickness)||o.thickness<2||o.thickness>512)errors.push('Thickness must be between 2 and 512 units.');
 if(!Number.isFinite(o.sweep)||Math.abs(o.sweep)<5||Math.abs(o.sweep)>360)errors.push('Sweep must be 5–360 degrees.');
 if(!Number.isFinite(o.rise)||Math.abs(o.rise)>8192)errors.push('Total elevation exceeds the safety limit.');
 if(!Number.isInteger(o.segments)||o.segments<3||o.segments>64)errors.push('Use 3–64 segments.');
 if(!Number.isFinite(o.startAngle))errors.push('Invalid starting angle.');
 if(!/^[a-zA-Z0-9_!{}+\-]{1,32}$/.test(o.texture))errors.push('Invalid GoldSrc texture name.');
 if(o.radius*(Math.abs(o.sweep)*Math.PI/180)/Math.max(1,o.segments)<2)errors.push('Segments would be too short for reliable BSP geometry.');
 return errors;
}
function prism(a:Vec3,b:Vec3,c:Vec3,thickness:number,texture:string,index:number):Brush{
  const vertices:Vec3[]=[a,b,c,...[a,b,c].map(p=>[p[0],p[1],round(p[2]-thickness)] as Vec3)];
  const faces:Face[]=orientFaces(vertices,[[0,1,2],[3,4,5],[0,3,4,1],[1,4,5,2],[2,5,3,0]].map(indices=>({indices,texture})));
  const result:Brush={id:uid(),kind:'brush',name:`Curved ramp ${index}`,primitive:'poly',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices,faces,layer:'Geometry'};
  const problems=validateBrush(result);if(problems.length)throw Error(`Curve segment ${index}: ${problems[0]}`);
  return result;
}
export function buildCurvedRamp(o:CurveSettings):Brush[]{
 const issues=validateCurveSettings(o);if(issues.length)throw Error(issues[0]);
 const brushes:Brush[]=[];
 const xy=(radius:number,t:number):Vec3=>{
  const a=(o.startAngle+o.sweep*t)*Math.PI/180;
  return [round(o.origin[0]+Math.cos(a)*radius),round(o.origin[1]+Math.sin(a)*radius),round(o.origin[2]+o.rise*t)];
 };
 for(let i=0;i<o.segments;i++){
  const t0=i/o.segments,t1=(i+1)/o.segments;
  const a=xy(o.radius-o.width/2,t0),b=xy(o.radius+o.width/2,t0),c=xy(o.radius+o.width/2,t1),d=xy(o.radius-o.width/2,t1);
  // Two triangular prisms share the diagonal, their top faces are planar.
  brushes.push(prism(a,b,c,o.thickness,o.texture,2*i+1));
  brushes.push(prism(a,c,d,o.thickness,o.texture,2*i+2));
 }
 return brushes;
}
export function curvedBrushSignature(b:Brush):string{
  return JSON.stringify([b.vertices,b.faces,b.position,b.rotation,b.scale,b.entityId]);
}
export type RadialArrayOptions={origin:Vec3;sweep:number;radius:number;rise:number;copies:number;startAngle:number};
/** Rigidly repeat existing geometry along an arc. Never deform or discard
 * a brush's vertices or its texture projection. */
export function radialArrayBrushes(selected:Brush[],options:RadialArrayOptions):Brush[]{
 if(!selected.length||selected.length>64)throw Error('Select 1–64 brushes to repeat.');
 if(![...options.origin,options.sweep,options.radius,options.rise,options.copies,options.startAngle].every(Number.isFinite)||!Number.isInteger(options.copies)||options.copies<2||options.copies>64||options.radius<32||options.radius>8192||Math.abs(options.sweep)>360||Math.abs(options.rise)>8192)
   throw Error('Invalid radial array parameters.');
 if(selected.some(b=>b.hidden||b.locked||b.entityId!==selected[0].entityId))throw Error('Only unlocked brushes from the same entity can be arrayed.');
 if(selected.length*options.copies>512)throw Error('Radial array exceeds the safe 512-brush limit.');
 const pivot:Vec3=[0,1,2].map(i=>selected.reduce((s,b)=>s+b.position[i],0)/selected.length) as Vec3;
 const copies:Brush[]=[];
 for(let j=0;j<options.copies;j++){
  const t=j/Math.max(1,options.copies-1),a=(options.startAngle+options.sweep*t)*Math.PI/180;
  const ca=Math.cos(a),sa=Math.sin(a);
  for(const b of selected){
    const dx=b.position[0]-pivot[0],dy=b.position[1]-pivot[1];
    const next:Brush={...b,id:uid(),name:`${b.name} · Curve ${j+1}`,group:undefined,
      position:[round(options.origin[0]+options.radius*ca+dx*ca-dy*sa),round(options.origin[1]+options.radius*sa+dx*sa+dy*ca),round(options.origin[2]+options.rise*t+b.position[2]-pivot[2])],
      rotation:[b.rotation[0],b.rotation[1],round(b.rotation[2]+a*180/Math.PI)]};
    next.faces=rotateBrushTextureLock(b,next);
    const issues=validateBrush(next);if(issues.length)throw Error(`Invalid repeated brush: ${issues[0]}`);
    copies.push(next);
  }
 }
 return copies;
}
