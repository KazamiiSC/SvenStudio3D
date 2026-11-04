/** User-configurable keyboard and camera navigation settings. Key bindings use
 * KeyboardEvent.code so they remain stable with different keyboard layouts. */
export type ShortcutAction = 'move'|'rotate'|'scale'|'fly'|'frame'|'frameAll'|'front'|'right'|'top'|'projection'|'back'|'left'|'bottom'|'isometric'|'orbitLeft'|'orbitRight'|'orbitUp'|'orbitDown'|'panLeft'|'panRight'|'panUp'|'panDown'|'zoomIn'|'zoomOut'|'resetView';
export type CameraPreset = 'blender'|'classic';
/** Alt + left drag is reserved for face texture offset editing. */
export function isUvDragGesture(pointer:Pick<PointerEvent,'button'|'altKey'>,faceMode:boolean):boolean{
  return faceMode&&pointer.button===0&&pointer.altKey;
}
export type ControlSettings = {
  cameraPreset:CameraPreset;
  orbitSensitivity:number;
  panSensitivity:number;
  zoomSensitivity:number;
  flySpeed:number;
  invertOrbit:boolean;
  cameraDamping:boolean;dampingFactor:number;zoomToCursor:boolean;
  minCameraDistance:number;maxCameraDistance:number;perspectiveFov:number;
  flyBoostMultiplier:number;flySlowMultiplier:number;flyLookSensitivity:number;
  gizmoSpace:'world'|'local';rotationSnapDegrees:number;scaleSnapStep:number;gizmoSize:number;
  shortcuts:Record<ShortcutAction,string>;
};
export const CONTROL_ACTIONS:{id:ShortcutAction;label:string;description:string}[]=[
  {id:'move',label:'Blender Move (G)',description:'Mouse-follow move; repeat key to confirm'},
  {id:'rotate',label:'Blender Rotate (R)',description:'Mouse-follow rotate; repeat key to confirm'},
  {id:'scale',label:'Scale with mouse (C)',description:'Mouse-follow scale; repeat key to confirm'},
  {id:'fly',label:'Fly / Walk navigation',description:'Toggle WASD navigation'},
  {id:'frame',label:'Frame selection',description:'Center selected objects'},
  {id:'frameAll',label:'Frame all',description:'Center complete map'},
  {id:'front',label:'Front view',description:'View from front'},
  {id:'right',label:'Right view',description:'View from right'},
  {id:'top',label:'Top view',description:'View from above'},
  {id:'projection',label:'Orthographic / Perspective',description:'Toggle projection'},
  {id:'back',label:'Back view',description:'Back orthographic view'},
  {id:'left',label:'Left view',description:'Left orthographic view'},
  {id:'bottom',label:'Bottom view',description:'Bottom orthographic view'},
  {id:'isometric',label:'Isometric view',description:'Isometric orthographic view'},
  {id:'orbitLeft',label:'Orbit camera left',description:'Rotate the viewport 15 degrees left'},
  {id:'orbitRight',label:'Orbit camera right',description:'Rotate the viewport 15 degrees right'},
  {id:'orbitUp',label:'Orbit camera up',description:'Tilt the viewport 15 degrees up'},
  {id:'orbitDown',label:'Orbit camera down',description:'Tilt the viewport 15 degrees down'},
  {id:'panLeft',label:'Pan camera left',description:'Move the viewpoint left'},
  {id:'panRight',label:'Pan camera right',description:'Move the viewpoint right'},
  {id:'panUp',label:'Pan camera up',description:'Move the viewpoint up'},
  {id:'panDown',label:'Pan camera down',description:'Move the viewpoint down'},
  {id:'zoomIn',label:'Camera zoom in',description:'Move closer without changing selection'},
  {id:'zoomOut',label:'Camera zoom out',description:'Move away without changing selection'},
  {id:'resetView',label:'Reset camera view',description:'Restore the default viewpoint'}
];
export const DEFAULT_CONTROLS:ControlSettings={
  cameraPreset:'blender',orbitSensitivity:1,panSensitivity:1,zoomSensitivity:1,flySpeed:360,invertOrbit:false,
  cameraDamping:true,dampingFactor:.08,zoomToCursor:false,minCameraDistance:10,maxCameraDistance:180000,perspectiveFov:60,flyBoostMultiplier:2.5,flySlowMultiplier:.35,flyLookSensitivity:1,
  gizmoSpace:'world',rotationSnapDegrees:0,scaleSnapStep:0,gizmoSize:0.9,
  shortcuts:{move:'KeyG',rotate:'KeyR',scale:'KeyC',fly:'Shift+KeyF',frame:'NumpadDecimal',frameAll:'Home',front:'Numpad1',right:'Numpad3',top:'Numpad7',projection:'Numpad5',back:'Ctrl+Numpad1',left:'Ctrl+Numpad3',bottom:'Ctrl+Numpad7',isometric:'Numpad0',orbitLeft:'Numpad4',orbitRight:'Numpad6',orbitUp:'Numpad8',orbitDown:'Numpad2',panLeft:'Ctrl+Numpad4',panRight:'Ctrl+Numpad6',panUp:'Ctrl+Numpad8',panDown:'Ctrl+Numpad2',zoomIn:'NumpadAdd',zoomOut:'NumpadSubtract',resetView:'Shift+Home'}
};
const STORAGE_KEY='svenstudio-controls-v2';
const LEGACY_STORAGE_KEY='svenstudio-controls-v1';
export function normalizeBinding(binding:string):string{
  const parts=binding.split('+');const code=parts.at(-1)||'';
  return `${parts.includes('Ctrl')?'Ctrl+':''}${parts.includes('Alt')?'Alt+':''}${parts.includes('Shift')?'Shift+':''}${code}`;
}
export function keyEventBinding(event:Pick<KeyboardEvent,'code'|'ctrlKey'|'altKey'|'shiftKey'|'metaKey'>):string{
  if(event.metaKey)return ''; // OS shortcuts should remain available
  if(['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight'].includes(event.code))return '';
  return normalizeBinding(`${event.ctrlKey?'Ctrl+':''}${event.altKey?'Alt+':''}${event.shiftKey?'Shift+':''}${event.code}`);
}
export function shortcutAction(config:ControlSettings,code:string):ShortcutAction|undefined{
  return CONTROL_ACTIONS.find(({id})=>config.shortcuts[id]===code)?.id;
}
export function displayBinding(binding:string):string{
  const parts=binding.split('+');const code=parts.pop()||'';
  const keys:Record<string,string>={KeyG:'G',KeyR:'R',KeyS:'S',KeyC:'C',KeyF:'F',NumpadDecimal:'Num .',Numpad1:'Num 1',Numpad3:'Num 3',Numpad7:'Num 7',Numpad5:'Num 5',Numpad0:'Num 0',Numpad2:'Num 2',Numpad4:'Num 4',Numpad6:'Num 6',Numpad8:'Num 8',NumpadAdd:'Num +',NumpadSubtract:'Num -',Home:'Home',Backquote:'`',Period:'.',Space:'Space',Escape:'Esc'};
  return [...parts,keys[code]||code.replace(/^Key/,'').replace(/^Digit/,'')].join(' + ');
}
export function clampControlNumber(x:number,fallback:number,min:number,max:number):number{return Number.isFinite(x)?Math.min(max,Math.max(min,x)):fallback;}
export function readControls():ControlSettings{
  try{
    if(typeof localStorage==='undefined')return structuredClone(DEFAULT_CONTROLS);
    const current=localStorage.getItem(STORAGE_KEY);
    const isLegacy=current===null;
    const raw=JSON.parse(current??localStorage.getItem(LEGACY_STORAGE_KEY)??'{}');
    const shortcuts={...DEFAULT_CONTROLS.shortcuts};
    for(const {id} of CONTROL_ACTIONS)if(typeof raw.shortcuts?.[id]==='string'&&raw.shortcuts[id].length<70)shortcuts[id]=raw.shortcuts[id];
    // v0.8.1 stored the old default S in localStorage. Upgrade only that old
    // default, while keeping user-defined key combinations unchanged.
    if(isLegacy&&shortcuts.scale==='KeyS')shortcuts.scale='KeyC';
    return {
      cameraPreset:raw.cameraPreset==='classic'?'classic':'blender',shortcuts,
      orbitSensitivity:clampControlNumber(raw.orbitSensitivity,1,.15,4),
      panSensitivity:clampControlNumber(raw.panSensitivity,1,.15,4),
      zoomSensitivity:clampControlNumber(raw.zoomSensitivity,1,.15,4),
      flySpeed:clampControlNumber(raw.flySpeed,360,10,3000),
      invertOrbit:raw.invertOrbit===true,
      cameraDamping:raw.cameraDamping!==false,
      dampingFactor:clampControlNumber(raw.dampingFactor,.08,.02,.25),
      zoomToCursor:raw.zoomToCursor===true,
      minCameraDistance:clampControlNumber(raw.minCameraDistance,10,1,500),
      maxCameraDistance:clampControlNumber(raw.maxCameraDistance,180000,500,250000),
      perspectiveFov:clampControlNumber(raw.perspectiveFov,60,35,100),
      flyBoostMultiplier:clampControlNumber(raw.flyBoostMultiplier,2.5,1,8),
      flySlowMultiplier:clampControlNumber(raw.flySlowMultiplier,.35,.05,1),
      flyLookSensitivity:clampControlNumber(raw.flyLookSensitivity,1,.2,3),
      gizmoSpace:raw.gizmoSpace==='local'?'local':'world',
      rotationSnapDegrees:clampControlNumber(raw.rotationSnapDegrees,0,0,90),
      scaleSnapStep:clampControlNumber(raw.scaleSnapStep,0,0,1),
      gizmoSize:clampControlNumber(raw.gizmoSize,.9,.5,2)
    };
  }catch{return structuredClone(DEFAULT_CONTROLS)}
}
export function saveControls(config:ControlSettings){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(config))}catch{ /* storage unavailable in private browser mode */ }}
