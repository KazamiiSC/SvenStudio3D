/** Scoped edit history for the Smart Connect dialog. Map-level geometry Undo
 * is intentionally separate and remains handled by the editor store. */
import type {SmartConnectOptions} from './smartConnect';
export type SmartConnectDraft={fromId:string;toId:string;fromFace:number;toFace:number;options:SmartConnectOptions;selectedPoint:number;allowCollisions:boolean;cutIds:string[];routeFeedback:string};
export type SmartConnectHistory={past:SmartConnectDraft[];future:SmartConnectDraft[]};
export const createSmartConnectHistory=():SmartConnectHistory=>({past:[],future:[]});
const copy=(d:SmartConnectDraft):SmartConnectDraft=>({...d,cutIds:[...d.cutIds],options:{...d.options,points:d.options.points.map(p=>[...p] as typeof p)}});
export function recordSmartConnectChange(h:SmartConnectHistory,current:SmartConnectDraft):SmartConnectHistory{
 const previous=h.past.at(-1);
 if(previous&&JSON.stringify(previous)===JSON.stringify(current))return h;
 return {past:[...h.past.slice(-59),copy(current)],future:[]};
}
export function undoSmartConnectChange(h:SmartConnectHistory,current:SmartConnectDraft):{history:SmartConnectHistory;draft:SmartConnectDraft}|null{
 if(!h.past.length)return null;
 return {draft:copy(h.past[h.past.length-1]),history:{past:h.past.slice(0,-1),future:[copy(current),...h.future].slice(0,60)}};
}
export function redoSmartConnectChange(h:SmartConnectHistory,current:SmartConnectDraft):{history:SmartConnectHistory;draft:SmartConnectDraft}|null{
 if(!h.future.length)return null;
 return {draft:copy(h.future[0]),history:{past:[...h.past.slice(-59),copy(current)],future:h.future.slice(1)}};
}
