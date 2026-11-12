import type {Vec3} from './types';
/** Studio uses GoldSrc XY ground with Z up, Three preview uses X/Z ground. */
export type PathEditAxis='xy'|'x'|'y'|'z';
export const pathPointToPreview=(p:Vec3):Vec3=>[p[0],p[2],-p[1]];
/** Delta from the camera-plane ray intersection. Snap only the edited axes. */
export function movePathPointOnAxis(start:Vec3,delta:Vec3,axis:PathEditAxis,snap=8):Vec3{
  const round=(n:number)=>Math.round(n/snap)*snap;
  const next=[...start] as Vec3;
  if(axis==='xy'||axis==='x')next[0]=round(start[0]+delta[0]);
  if(axis==='xy'||axis==='y')next[1]=round(start[1]-delta[2]);
  if(axis==='z')next[2]=round(start[2]+delta[1]);
  return next;
}
