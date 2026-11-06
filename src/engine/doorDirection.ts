/** Svengine/GoldSrc sliding-door orientation. The native entity direction is
 * `angles` (pitch yaw roll): yaw -1 means UP, yaw -2 means DOWN.
 * Keep a single canonical key so legacy `angle` never competes with it. */
export type DoorDirection = 'up'|'down'|'horizontal';
export type DoorOrientation = {direction:DoorDirection; yaw:number; conflict:boolean; legacy:boolean};
function finiteYaw(angles:string|undefined):number|null{
 const values=(angles||'').trim().split(/\s+/).map(Number);
 return values.length===3&&values.every(Number.isFinite)?values[1]:null;
}
export function readDoorOrientation(props:Record<string,string>):DoorOrientation{
 const yawFromAngles=finiteYaw(props.angles);
 const yawFromLegacy=props.angle===undefined?null:Number(props.angle);
 const legacy=props.angle!==undefined&&Number.isFinite(yawFromLegacy);
 const conflict=legacy&&yawFromAngles!==null&&Math.abs(yawFromAngles-(yawFromLegacy as number))>0.00001;
 // Older editor builds wrote angle but could leave the default angles untouched.
 // Show that intent without silently changing original project data.
 const yaw=legacy&&(yawFromAngles===null||yawFromAngles===0&&yawFromLegacy!==0)
   ?yawFromLegacy as number:yawFromAngles??(legacy?yawFromLegacy as number:0);
 return {direction:yaw===-1?'up':yaw===-2?'down':'horizontal',yaw,conflict,legacy};
}
/** Set a direction in one undoable editor update; the old alias is removed. */
export function withDoorDirection(props:Record<string,string>,direction:DoorDirection,yaw=0):Record<string,string>{
 const next={...props};
 delete next.angle;
 const horizontal=Number.isFinite(yaw)&&yaw!==-1&&yaw!==-2?yaw:0;
 next.angles=`0 ${direction==='up'?-1:direction==='down'?-2:horizontal} 0`;
 return next;
}
export function doorMotionOffsetYaw(props:Record<string,string>):number{return readDoorOrientation(props).yaw;}
