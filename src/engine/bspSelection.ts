/** BSP Editor selection. Entity indices are the stable IDs within one loaded BSP. */
export type BspSelection={primary:number|null;additional:number[]};
export function bspToggleSelection(current:BspSelection,index:number,extend:boolean):BspSelection{
  if(!Number.isSafeInteger(index)||index<=0)return current; // Never select worldspawn.
  if(!extend)return {primary:index,additional:[]};
  if(current.primary===null)return {primary:index,additional:[]};
  if(index===current.primary){
    if(!current.additional.length)return {primary:null,additional:[]};
    return {primary:current.additional[0],additional:current.additional.slice(1)};
  }
  const additional=current.additional.includes(index)?current.additional.filter(i=>i!==index):[...current.additional,index].slice(0,255);
  return {primary:current.primary,additional};
}
