/** v2.4: last player-size check result, shown as coloured floor marks in the 3D view. Editor-only. */
import {create} from 'zustand';
import type {ClearanceKind,ClearanceReport} from './engine/mapTools24';

export const CLEARANCE_COLORS:Record<ClearanceKind,string>={narrow:'#ff4d5e',tooHigh:'#c26bff',crouch:'#ffd23f',crouchJump:'#ff9a3c',jump:'#4fc3f7'};
export const CLEARANCE_LABELS:Record<ClearanceKind,string>={
  narrow:'Too narrow for the player (< 32u)',
  tooHigh:'Ledge too high to climb (63–96u)',
  crouch:'Crouch only (36–72u high)',
  crouchJump:'Needs a crouch-jump (45–63u)',
  jump:'Needs a jump (step over 18u)'
};
type State={report:ClearanceReport|null;visible:Record<ClearanceKind,boolean>;focus:number|null;
  setReport:(report:ClearanceReport|null)=>void;toggle:(kind:ClearanceKind)=>void;setFocus:(index:number|null)=>void};
export const usePlayerCheck=create<State>(set=>({
  report:null,focus:null,
  visible:{narrow:true,tooHigh:true,crouch:true,crouchJump:true,jump:true},
  setReport:report=>set({report,focus:null}),
  toggle:kind=>set(s=>({visible:{...s.visible,[kind]:!s.visible[kind]}})),
  setFocus:focus=>set({focus})
}));
