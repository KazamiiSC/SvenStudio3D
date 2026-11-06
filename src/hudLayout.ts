/** Viewport HUD only. Persist UI coordinates, never .map / .bsp geometry. */
import {create} from 'zustand';
import {persist} from 'zustand/middleware';

export const HUD_IDS=['status','view','pivot','tools','orthographic','help','stats','transform','alerts','axes','shapes','fps'] as const;
export type HudId=typeof HUD_IDS[number];
export type HudPreset='default'|'compact'|'minimal'|'custom';
export type HudItem={x:number;y:number;scale:number;opacity:number;visible:boolean};
export type HudItems=Record<HudId,HudItem>;
const item=(x:number,y:number,scale=1,opacity=1,visible=true):HudItem=>({x,y,scale,opacity,visible});
export const DEFAULT_HUD:HudItems={
  status:item(1,1),view:item(1,6),pivot:item(1,12),tools:item(1,20,.83),
  orthographic:item(2,59,.85),help:item(1,94,.9),
  stats:item(1,88,.9),transform:item(37,78,.88),alerts:item(27,18,.9),axes:item(92,89,.9),
  shapes:item(72,12,.94),fps:item(90,15,.9)
};
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export function normalizeHudItem(raw:Partial<HudItem>|undefined,fallback:HudItem):HudItem{
  const number=(v:unknown,min:number,max:number,def:number)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,min,max):def;
  return {x:number(raw?.x,0,99,fallback.x),y:number(raw?.y,0,99,fallback.y),scale:number(raw?.scale,.45,1.8,fallback.scale),opacity:number(raw?.opacity,.15,1,fallback.opacity),visible:typeof raw?.visible==='boolean'?raw.visible:fallback.visible};
}
export function hudPreset(preset:Exclude<HudPreset,'custom'>):HudItems{
  const result=Object.fromEntries(HUD_IDS.map(id=>[id,{...DEFAULT_HUD[id]}])) as HudItems;
  if(preset==='compact'){
    result.tools={...result.tools,x:1,y:18,scale:.7};
    result.view={...result.view,scale:.86};result.status={...result.status,scale:.8};
    result.help={...result.help,scale:.8};result.stats={...result.stats,scale:.8};
    result.axes={...result.axes,scale:.75};
  }
  if(preset==='minimal'){
    for(const id of ['status','help','stats','alerts'] as HudId[])result[id]={...result[id],visible:false};
    result.view={...result.view,x:1,y:1,scale:.8};
    result.tools={...result.tools,x:1,y:12,scale:.7};
    result.pivot={...result.pivot,x:1,y:7,scale:.8};
  }
  return result;
}
interface HudState{
  items:HudItems;editing:boolean;selected:HudId;globalOpacity:number;preset:HudPreset;
  setEditing:(enabled:boolean)=>void;select:(id:HudId)=>void;
  update:(id:HudId,changes:Partial<HudItem>)=>void;
  setGlobalOpacity:(value:number)=>void;
  resetItem:(id:HudId)=>void;applyPreset:(preset:Exclude<HudPreset,'custom'>)=>void;
}
export const useHudLayout=create<HudState>()(persist((set)=>({
  items:hudPreset('default'),editing:false,selected:'tools',globalOpacity:1,preset:'default',
  setEditing:editing=>set({editing}),select:selected=>set({selected}),
  update:(id,changes)=>set(s=>({items:{...s.items,[id]:normalizeHudItem({...s.items[id],...changes},DEFAULT_HUD[id])},preset:'custom'})),
  setGlobalOpacity:value=>set({globalOpacity:clamp(value,.25,1)}),
  resetItem:id=>set(s=>({items:{...s.items,[id]:{...DEFAULT_HUD[id]}},preset:'custom'})),
  applyPreset:preset=>set({items:hudPreset(preset),preset})
}),{
  name:'svenstudio:viewport-hud-0898',version:1,
  partialize:s=>({items:s.items,globalOpacity:s.globalOpacity,preset:s.preset,selected:s.selected}),
  merge:(persisted,current)=>{
    const old=persisted as Partial<HudState>|undefined;
    const items=Object.fromEntries(HUD_IDS.map(id=>[id,normalizeHudItem(old?.items?.[id],DEFAULT_HUD[id])])) as HudItems;
    return {...current,items,editing:false,globalOpacity:typeof old?.globalOpacity==='number'?clamp(old.globalOpacity,.25,1):1,
      selected:HUD_IDS.includes(old?.selected as HudId)?old!.selected!:'tools',
      preset:['default','compact','minimal','custom'].includes(old?.preset||'')?old!.preset!:'custom'};
  }
}));
