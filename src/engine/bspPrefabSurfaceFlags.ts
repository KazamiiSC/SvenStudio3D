/** Identify the invented closing faces of visible BSP surface-shell prefabs.
 * They are required to form a valid closed Valve 220 brush, but neither
 * their geometry nor their material existed in the compiled source BSP.
 *
 * HF1/HF2 saved unmarked faces, HF3 marked side caps but not the back. Old
 * already-placed MAP projects must get the same repair without roundtripping
 * their prefab file, while ordinary boxes/exact BSP solids stay untouched.
 */
import type {Brush,Face} from './types';

export function isBspSurfacePanel(brush:Brush):boolean{
  const front=brush.faces[0],n=front?.indices.length??0;
  if(n<3||brush.primitive!=='poly'||brush.vertices.length!==n*2||brush.faces.length!==n+2)return false;
  if(!brush.faces[1]?.indices.every(i=>i>=n&&i<2*n))return false;
  if(!brush.faces.slice(2).every((face,i)=>face.indices.length===4&&
      face.indices[0]===i&&face.indices[1]===i+n&&
      face.indices[2]===n+(i+1)%n&&face.indices[3]===(i+1)%n))return false;
  // A source BSP extractor shell has a reliable historical group/layer/name.
  // The explicit side markers also cover cases where users renamed the shell.
  return brush.faces.slice(2).some(face=>face.bspPrefabGeneratedCap===true)||
    brush.layer==='Imported BSP'&&/ panel \d+$/i.test(brush.name);
}

/** Never hide an authentic source polygon, even when a shell is edited later.
 * Synthetic closures compile with NULL, preventing fake texture fragments.
 */
export function isBspSyntheticClosure(brush:Brush,faceIndex:number,face:Face):boolean{
  if(face.bspPrefabGeneratedCap||face.bspPrefabGeneratedBack)return true;
  if(faceIndex<1)return false;
  return isBspSurfacePanel(brush);
}
