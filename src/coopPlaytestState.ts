/** Temporary visual analysis state. Never persisted to MAP/project or sent to BuildTogether. */
import {create} from 'zustand';
import type {Vec3} from './engine/types';
export const useCoopPlaytestState=create<{
 visible:boolean;count:2|4|8;anchorId:string|null;manualAnchor:Vec3|null;
 setVisible:(visible:boolean)=>void;setCount:(count:2|4|8)=>void;setAnchor:(id:string|null)=>void;setManualAnchor:(position:Vec3|null)=>void;
}>(set=>({
 visible:false,count:4,anchorId:null,manualAnchor:null,
 setVisible:visible=>set({visible}),setCount:count=>set({count}),setAnchor:anchorId=>set({anchorId,manualAnchor:null}),setManualAnchor:manualAnchor=>set({manualAnchor})
}));
