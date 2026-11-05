/** Screen-space handle hit testing for the MAP editor gizmo.
 * TransformControls uses an invisible picker rather than the rendered colored
 * mesh. Scene geometry must not change selection when that picker was hit.
 * Editor-only: never affects Valve 220 MAP/BSP data.
 */
import * as THREE from 'three';

type PickerControls = THREE.Object3D & {
  enabled:boolean;
  dragging:boolean;
  mode:string;
  gizmo:{picker:Record<string,THREE.Object3D>};
};

/** Match the native TransformControls raycast, including its invisible parent. */
export function hitTransformPicker(control:THREE.Object3D | null | undefined,camera:THREE.Camera,
  bounds:Pick<DOMRect,'left'|'top'|'width'|'height'>,clientX:number,clientY:number):boolean{
  if(!control)return false;
  const gizmo=control as PickerControls;
  if(gizmo.enabled===false||gizmo.visible===false)return false;
  // Once a drag has started, a brush must not steal any subsequent pointer hits.
  if(gizmo.dragging)return true;
  const picker=gizmo.gizmo?.picker?.[gizmo.mode];
  if(!picker||bounds.width<=0||bounds.height<=0||
    clientX<bounds.left||clientX>bounds.left+bounds.width||
    clientY<bounds.top||clientY>bounds.top+bounds.height)return false;
  camera.updateMatrixWorld();
  gizmo.updateMatrixWorld(true);
  const x=(clientX-bounds.left)/bounds.width*2-1;
  const y=-(clientY-bounds.top)/bounds.height*2+1;
  const ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(x,y),camera);
  // Three's invisible *group* is raycastable, while hidden child handles are not.
  // This matches TransformControls.intersectObjectWithRay(), not mesh selection.
  return ray.intersectObject(picker,true).some(hit=>hit.object.visible);
}
