/** Read-only runtime presentation of compiled BSP environment entities.
 * Never writes a MAP/BSP or changes SC-RAD samples. Fog is a *view* option:
 * dynamic triggering and the user's in-game fog preference cannot be inferred.
 */
import type {BspEntity} from './bsp';

export type BspFogSettings={color:[number,number,number];hex:string;start:number;end:number;initiallyEnabled:boolean;targetname:string};

const num=(value:string|undefined)=>value===undefined||!value.trim()?NaN:Number(value);
const byte=(value:number)=>Number.isInteger(value)&&value>=0&&value<=255;
export function readBspFog(entities:readonly BspEntity[]):BspFogSettings|null{
  for(const entity of entities){
    if(entity.classname.toLowerCase()!=='env_fog')continue;
    const props=entity.properties,start=num(props.iuser2),end=num(props.iuser3);
    const color=(props.rendercolor||'').trim().split(/\s+/).map(Number);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<=0||end<=start||
      !Number.isFinite(end-start)||color.length!==3||!color.every(byte))continue;
    const channels=color as [number,number,number];
    const hex='#'+channels.map(n=>n.toString(16).padStart(2,'0')).join('');
    // Bit 1: Start Off. Bitwise & ignores malformed values safely.
    const flags=Number(props.spawnflags)||0;
    return {color:channels,hex,start,end,initiallyEnabled:(flags&1)===0,targetname:props.targetname||''};
  }
  return null;
}
/** Diagnostic reference for the usual linear start/end OpenGL fog ramp. */
export function bspFogFactor(distance:number,fog:BspFogSettings|null):number{
  if(!fog||!Number.isFinite(distance))return 0;
  return Math.max(0,Math.min(1,(distance-fog.start)/(fog.end-fog.start)));
}
export type BspLightFilter='linear'|'nearest';
export const BSP_DISPLAY_GAMMA_DEFAULT=1;
export function normalizeBspDisplayGamma(value:number):number{
  return Number.isFinite(value)?Math.max(.65,Math.min(1.6,value)):BSP_DISPLAY_GAMMA_DEFAULT;
}
