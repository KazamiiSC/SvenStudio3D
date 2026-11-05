/** Camera target/position is independent of the large project snapshot. */
export type SavedCamera={
  version:1;projection:'perspective'|'orthographic';
  position:[number,number,number];target:[number,number,number];
  up:[number,number,number];orthoHeight:number;perspectiveFov:number;
};
const KEY='svenstudio-camera-session-v1';
const vecOk=(v:unknown):v is [number,number,number]=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e7);
export function readSavedCamera():SavedCamera|null{
  try{
    const s=JSON.parse(localStorage.getItem(KEY)||'null') as SavedCamera|null;
    if(s?.version!==1||!vecOk(s.position)||!vecOk(s.target)||!vecOk(s.up)||!Number.isFinite(s.orthoHeight)||s.orthoHeight<=0||s.orthoHeight>1e7)return null;
    if(s.projection!=='perspective'&&s.projection!=='orthographic')return null;
    return s;
  }catch{return null;}
}
export function writeSavedCamera(state:SavedCamera){
  try{localStorage.setItem(KEY,JSON.stringify(state));}catch{/* private mode */}
}
