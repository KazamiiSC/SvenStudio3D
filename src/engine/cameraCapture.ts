/** Camera-only pointer capture policy. Does not modify any map/editor state. */
export interface MapCaptureContext {
  walkMode:boolean;
  flyMode:boolean;
  drawMode:boolean;
  modalTransform:unknown;
  textureDragSnapshot:unknown;
  hudEditing:boolean;
  dialogOpen:boolean;
}
export function canCaptureMapCamera(context:MapCaptureContext):boolean{
  return !context.walkMode&&!context.flyMode&&!context.drawMode
    &&!context.modalTransform&&!context.textureDragSnapshot
    &&!context.hudEditing&&!context.dialogOpen;
}
/** Ctrl/Meta plus WASD is potentially reserved by the browser (e.g. Ctrl+W). */
export function canMoveInCameraCapture(keys:ReadonlySet<string>):boolean{
  return !keys.has('ControlLeft')&&!keys.has('ControlRight')
    &&!keys.has('MetaLeft')&&!keys.has('MetaRight');
}
