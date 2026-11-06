/** Browser-only workspace arrangement. No map data or compiler settings are modified. */
import {create} from 'zustand';
import {persist} from 'zustand/middleware';
export type DockSide = 'left'|'right'|'top'|'bottom';
export type DockPanelId = 'assets'|'explorer'|'properties'|'console';
export const TOOLBAR_GROUPS = ['transform','view','geometry','tools','grid','edit','studios'] as const;
export type ToolbarGroup = typeof TOOLBAR_GROUPS[number];
export function normalizeToolbarGroups(value:unknown):ToolbarGroup[]{
  const existing=Array.isArray(value)?value.filter((id):id is ToolbarGroup=>typeof id==='string'&&TOOLBAR_GROUPS.includes(id as ToolbarGroup)):[];
  return [...new Set([...existing,...TOOLBAR_GROUPS])];
}
export function moveToolbarGroup(groups:readonly ToolbarGroup[],from:ToolbarGroup,to:ToolbarGroup):ToolbarGroup[]{
  const normalized=normalizeToolbarGroups(groups);
  if(from===to||!normalized.includes(from)||!normalized.includes(to))return normalized;
  const next=normalized.filter(id=>id!==from);next.splice(next.indexOf(to),0,from);return next;
}

export type Accent = 'nebula'|'ice'|'ember'|'mint'|'orchid'|'gold';
export type PerformancePreset = 'quality'|'balanced'|'large';
type LayoutState = {
  sides: Record<DockPanelId,DockSide>;
  order: DockPanelId[];
  visible: Record<DockPanelId,boolean>;
  toolbarDock: DockSide;
  compactTools:boolean;
  toolbarGroups:ToolbarGroup[];
  reorderToolbarGroup:(from:ToolbarGroup,to:ToolbarGroup)=>void;
  stepToolbarGroup:(id:ToolbarGroup,direction:-1|1)=>void;
  floatRailSide:'left'|'right';
  widths: {left:number;right:number};
  heights: {top:number;bottom:number};
  weights: Record<DockPanelId,number>;
  uiScale:number;
  accent:Accent;
  fontScale:number;
  performancePreset:PerformancePreset;
  movePanel:(id:DockPanelId,side:DockSide,before?:DockPanelId)=>void;
  setToolbarDock:(side:DockSide)=>void;
  setCompactTools:(value:boolean)=>void;setFloatRailSide:(side:'left'|'right')=>void;
  setVisible:(id:DockPanelId,visible:boolean)=>void;
  setSideSize:(side:DockSide,value:number)=>void;
  setWeights:(id:DockPanelId,a:number,other:DockPanelId,b:number)=>void;
  setScale:(scale:number)=>void;
  setAccent:(accent:Accent)=>void;
  setFontScale:(value:number)=>void;
  setPerformancePreset:(value:PerformancePreset)=>void;
  resetLayout:()=>void;
  usePreset:(preset:'organized'|'classic'|'focus'|'creative'|'wide'|'minimal')=>void;
};
const defaults = () => ({
  sides:{assets:'left',explorer:'right',properties:'right',console:'bottom'} as Record<DockPanelId,DockSide>,
  order:['assets','explorer','properties','console'] as DockPanelId[],
  visible:{assets:false,explorer:true,properties:true,console:false} as Record<DockPanelId,boolean>,
  toolbarDock:'left' as DockSide,
  toolbarGroups:[...TOOLBAR_GROUPS],
  compactTools:true,floatRailSide:'left' as 'left'|'right',
  widths:{left:254,right:302},heights:{top:192,bottom:168},
  weights:{assets:1,explorer:1,properties:1,console:1},
  uiScale:1,accent:'nebula' as Accent,fontScale:1,performancePreset:'balanced' as PerformancePreset
});
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export const useStudioLayout=create<LayoutState>()(persist((set)=>({
  ...defaults(),
  movePanel:(id,side,before)=>set(s=>{
    const others=s.order.filter(item=>item!==id);
    const index=before?others.indexOf(before):-1;
    others.splice(index<0?others.length:index,0,id);
    return {sides:{...s.sides,[id]:side},visible:{...s.visible,[id]:true},order:others};
  }),
  setToolbarDock:side=>set({toolbarDock:side}),
  reorderToolbarGroup:(from,to)=>set(s=>({toolbarGroups:moveToolbarGroup(s.toolbarGroups??TOOLBAR_GROUPS,from,to)})),
  stepToolbarGroup:(id,direction)=>set(s=>{
    const groups=normalizeToolbarGroups(s.toolbarGroups);
    const at=groups.indexOf(id),next=at+direction;
    if(at<0||next<0||next>=groups.length)return {toolbarGroups:groups};
    [groups[at],groups[next]]=[groups[next],groups[at]];return {toolbarGroups:groups};
  }),
  setCompactTools:compactTools=>set({compactTools}),setFloatRailSide:floatRailSide=>set({floatRailSide}),
  setVisible:(id,visible)=>set(s=>({visible:{...s.visible,[id]:visible}})),
  setSideSize:(side,value)=>set(s=>{
    if(side==='left'||side==='right'){
      const other=side==='left'?'right':'left';
      const toolbar=(s.toolbarDock==='left'||s.toolbarDock==='right')?124:0;
      const otherVisible=s.order.some(id=>s.visible[id]&&s.sides[id]===other);
      const space=typeof window!=='undefined'?window.innerWidth/s.uiScale:1600;
      const maximum=Math.min(700,space-(otherVisible?s.widths[other]:0)-toolbar-270);
      return {widths:{...s.widths,[side]:clamp(value,190,Math.max(190,maximum))}};
    }
    const other=side==='top'?'bottom':'top';
    const available=typeof window!=='undefined'?window.innerHeight/s.uiScale:900;
    const toolbar=(s.toolbarDock==='top'||s.toolbarDock==='bottom')?115:0;
    const otherVisible=s.order.some(id=>s.visible[id]&&s.sides[id]===other);
    const maximum=Math.min(500,available-(otherVisible?s.heights[other]:0)-toolbar-260);
    return {heights:{...s.heights,[side]:clamp(value,130,Math.max(130,maximum))}};
  }),
  setWeights:(id,a,other,b)=>set(s=>({weights:{...s.weights,[id]:Math.max(.12,a),[other]:Math.max(.12,b)}})),
  setScale:uiScale=>set({uiScale:clamp(uiScale,.8,1.2)}),
  setAccent:accent=>set({accent}),
  setFontScale:fontScale=>set({fontScale:clamp(fontScale,.9,1.2)}),
  setPerformancePreset:performancePreset=>set({performancePreset}),
  resetLayout:()=>set(defaults()),
  usePreset:preset=>set(s=>{
    const base={...defaults(),accent:s.accent,uiScale:s.uiScale,fontScale:s.fontScale,performancePreset:s.performancePreset};
    if(preset==='organized')return {...base,compactTools:true,visible:{assets:true,explorer:true,properties:true,console:false},widths:{left:266,right:294}};
    if(preset==='classic')return {...base,compactTools:false,toolbarDock:'top',visible:{assets:true,explorer:true,properties:true,console:false}};
    if(preset==='focus')return {...base,toolbarDock:'left',visible:{assets:false,explorer:false,properties:true,console:false}};
    if(preset==='wide')return {...base,toolbarDock:'right',floatRailSide:'right' as const,visible:{assets:true,explorer:false,properties:true,console:false},widths:{left:310,right:310}};
    if(preset==='minimal')return {...base,toolbarDock:'left',visible:{assets:false,explorer:false,properties:false,console:false}};
    return base;
  })
}),{name:'sven-studio-ui-layout-041',version:1,partialize:s=>({sides:s.sides,order:s.order,visible:s.visible,toolbarDock:s.toolbarDock,toolbarGroups:s.toolbarGroups,compactTools:s.compactTools,floatRailSide:s.floatRailSide,widths:s.widths,heights:s.heights,weights:s.weights,uiScale:s.uiScale,accent:s.accent,fontScale:s.fontScale,performancePreset:s.performancePreset})}));
