/** Utilities shared by BSP viewer navigation and labels (never modify BSP data). */
import type {BspEntity} from './bsp';

export const BSP_FLY_SPEED_MIN=40;
export const BSP_FLY_SPEED_MAX=2000;
export const BSP_FLY_SENSITIVITY_MIN=.0005;
export const BSP_FLY_SENSITIVITY_MAX=.006;

export function clampBspFlySpeed(speed:number){
  return Math.max(BSP_FLY_SPEED_MIN,Math.min(BSP_FLY_SPEED_MAX,Number.isFinite(speed)?speed:360));
}
export function clampBspFlySensitivity(sensitivity:number){
  return Math.max(BSP_FLY_SENSITIVITY_MIN,Math.min(BSP_FLY_SENSITIVITY_MAX,Number.isFinite(sensitivity)?sensitivity:.002));
}
/** Keep each classname in its original game language, and include targetname when present. */
export function bspEntityLabel(entity:BspEntity){
  const name=entity.properties.targetname?.trim();
  return name ? `${entity.classname} · ${name}` : entity.classname;
}
export function bspEntitySearchText(entity:BspEntity){
  return `${entity.classname} ${entity.properties.targetname||''} ${entity.properties.target||''}`.toLowerCase();
}
/** Unit wish direction in camera-local forward/right plus global vertical movement. */
export function bspFlyAxes(keys:ReadonlySet<string>){
  return {
    forward:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),
    right:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),
    up:Number(keys.has('KeyE')||keys.has('Space'))-Number(keys.has('KeyQ'))
  };
}
export function bspFlyMultiplier(keys:ReadonlySet<string>){
  return (keys.has('ShiftLeft')||keys.has('ShiftRight'))?3:(keys.has('ControlLeft')||keys.has('ControlRight'))?.3:1;
}
