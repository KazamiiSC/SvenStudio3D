/** Browser-only construction measurements. Never serialized into MAP/BSP. */
import type {PlaceableShape,Vec3} from './types';
const KEY='svenstudio:shape-dimensions-v14';
const valid=(value:unknown):value is Vec3=>Array.isArray(value)&&value.length===3&&value.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=1&&v<=16384);
export function readShapeDimensions(shape:PlaceableShape):Vec3|null{
  try{const item=JSON.parse(localStorage.getItem(KEY)||'{}') as Record<string,unknown>;
    return valid(item[shape])?[...item[shape]] as Vec3:null;
  }catch{return null}
}
export function rememberShapeDimensions(shape:PlaceableShape,size:Vec3):void{
  if(!valid(size))return;
  try{const read=JSON.parse(localStorage.getItem(KEY)||'{}');
    const dictionary=read&&typeof read==='object'&&!Array.isArray(read)?read:{};
    localStorage.setItem(KEY,JSON.stringify({...dictionary,[shape]:[...size]}));
  }catch{/* Storage unavailable / quota reached: keep editor working. */}
}
