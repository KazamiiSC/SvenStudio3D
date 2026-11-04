import * as THREE from 'three';
import type {MapObject,Vec3} from './types';
import {gameToThree,threeToGame,toRenderQuaternion,fromRenderQuaternion} from './geometry';
export type OrthoAxis='X'|'Y'|'Z';
/** One-step deterministic transform, all selected convex brushes share a pivot.
 * Data stays in GoldSrc Z-up coordinates; rendering uses Three's Y-up basis.
 */
export function orthoObjectUpdates(objects:MapObject[],ids:string[],axis:OrthoAxis,action:'rotate'|'scale'|'nudge',amount:number){
  const members=objects.filter(o=>ids.includes(o.id)&&o.kind==='brush'&&!o.locked&&!o.hidden);
  const result:Record<string,{position:Vec3;rotation?:Vec3;scale?:Vec3}>={};
  if(!members.length||!Number.isFinite(amount))return result;
  const center=new THREE.Vector3();members.forEach(o=>center.add(gameToThree(o.position)));center.multiplyScalar(1/members.length);
  const direction=axis==='X'?new THREE.Vector3(1,0,0):axis==='Y'?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0);
  const q=new THREE.Quaternion().setFromAxisAngle(direction,THREE.MathUtils.degToRad(amount));
  for(const obj of members){
    if(obj.kind!=='brush')continue;
    const p=gameToThree(obj.position);
    const rotation=toRenderQuaternion(obj.rotation);
    if(action==='rotate'){
      p.sub(center).applyQuaternion(q).add(center);rotation.premultiply(q);
      result[obj.id]={position:threeToGame(p),rotation:fromRenderQuaternion(rotation),scale:obj.scale};
    }else if(action==='scale'){
      const scalar=Math.max(.05,Math.min(20,amount));
      p.sub(center).multiplyScalar(scalar).add(center);
      result[obj.id]={position:threeToGame(p),rotation:obj.rotation,scale:obj.scale.map(s=>Math.max(.05,s*scalar)) as Vec3};
    }else{
      p.addScaledVector(direction,amount);result[obj.id]={position:threeToGame(p),rotation:obj.rotation,scale:obj.scale};
    }
  }
  return result;
}
