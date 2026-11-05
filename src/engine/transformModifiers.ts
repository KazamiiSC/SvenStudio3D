/** Temporary keyboard+mouse modifiers for G/R/C and native gizmo.
 * Pure editor-only calculations: no GoldSrc/Valve 220 data is changed here.
 */
import type {ControlSettings} from './controls';
export type TransformMode='translate'|'rotate'|'scale';
export type ModifierKeys={shift:boolean;ctrl:boolean;alt:boolean};
export const EMPTY_MODIFIERS:ModifierKeys={shift:false,ctrl:false,alt:false};
export function modifierKeys(event:Pick<KeyboardEvent,'shiftKey'|'ctrlKey'|'altKey'>):ModifierKeys{
  return {shift:event.shiftKey,ctrl:event.ctrlKey,alt:event.altKey};
}
export function modifierEqual(a:ModifierKeys,b:ModifierKeys){return a.shift===b.shift&&a.ctrl===b.ctrl&&a.alt===b.alt;}
export function transformGesture(mode:TransformMode,keys:ModifierKeys,options:Pick<ControlSettings,
  'transformFineFactor'|'transformRotationStep'|'transformScaleStep'|'rotationSnapDegrees'|'scaleSnapStep'>,
  gridEnabled:boolean,hasAxis:boolean){
  // Shift temporarily frees fine movements from the global snap; Ctrl has priority.
  const fine=keys.shift?options.transformFineFactor:1;
  const grid=keys.ctrl||(gridEnabled&&!keys.shift);
  const degrees=keys.ctrl?options.transformRotationStep:keys.shift?0:options.rotationSnapDegrees;
  const factorStep=keys.ctrl?options.transformScaleStep:keys.shift?0:options.scaleSnapStep;
  return {
    fine,
    grid,
    degrees:mode==='rotate'?degrees:0,
    factorStep:mode==='scale'?factorStep:0,
    vertical:mode==='translate'&&keys.alt&&!hasAxis,
    trackball:mode==='rotate'&&keys.alt&&!hasAxis,
    centered:mode==='scale'&&keys.alt
  };
}
export function snapIncrement(value:number,step:number):number{
  return step>0?Math.round(value/step)*step:value;
}
