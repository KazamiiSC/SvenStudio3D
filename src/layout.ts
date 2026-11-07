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
  order:['assets','properties','explorer','console'] as DockPanelId[],
  visible:{assets:true,explorer:true,properties:true,console:false} as Record<DockPanelId,boolean>,
  toolbarDock:'top' as DockSide,
  toolbarGroups:[...TOOLBAR_GROUPS],
  compactTools:false,floatRailSide:'left' as 'left'|'right',
  widths:{left:254,right:302},heights:{top:192,bottom:168},
  weights:{assets:1,explorer:1,properties:1,console:1},
  uiScale:1,accent:'nebula' as Accent,fontScale:1,performancePreset:'balanced' as PerformancePreset
});
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const panelIds:DockPanelId[]=['assets','explorer','properties','console'];
const dockSides:DockSide[]=['left','right','top','bottom'];
const finiteOr=(value:unknown,fallback:number,min:number,max:number):number=>
  typeof value==='number'&&Number.isFinite(value)?clamp(value,min,max):fallback;
const recordOrEmpty=(value:unknown):Record<string,unknown>=>
  value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

/** Older/corrupted browser settings must never replace complete dock records or
 * leave NaN dimensions in the workspace. Keep valid user positions/preferences. */
export function mergeSavedLayout(saved:unknown,current:LayoutState):LayoutState{
  const data=recordOrEmpty(saved);
  const base=defaults();
  const originalSides=recordOrEmpty(data.sides);
  const originalVisible=recordOrEmpty(data.visible);
  const originalWeights=recordOrEmpty(data.weights);
  const originalWidths=recordOrEmpty(data.widths);
  const originalHeights=recordOrEmpty(data.heights);
  const sides={...base.sides};
  const visible={...base.visible};
  const weights={...base.weights};
  for(const id of panelIds){
    if(dockSides.includes(originalSides[id] as DockSide))sides[id]=originalSides[id] as DockSide;
    if(typeof originalVisible[id]==='boolean')visible[id]=originalVisible[id] as boolean;
    weights[id]=finiteOr(originalWeights[id],weights[id],.12,16);
  }
  const previousOrder=Array.isArray(data.order)?data.order:[];
  const order=[...new Set([...previousOrder.filter((id):id is DockPanelId=>panelIds.includes(id as DockPanelId)),...base.order])];
  const toolbarDock=dockSides.includes(data.toolbarDock as DockSide)?data.toolbarDock as DockSide:base.toolbarDock;
  const floatRailSide=data.floatRailSide==='right'?'right':'left';
  const accents:Accent[]=['nebula','ice','ember','mint','orchid','gold'];
  const performancePresets:PerformancePreset[]=['quality','balanced','large'];
  return {...current,
    sides,visible,weights,order,toolbarDock,
    widths:{left:finiteOr(originalWidths.left,base.widths.left,190,700),right:finiteOr(originalWidths.right,base.widths.right,190,700)},
    heights:{top:finiteOr(originalHeights.top,base.heights.top,130,500),bottom:finiteOr(originalHeights.bottom,base.heights.bottom,130,500)},
    compactTools:typeof data.compactTools==='boolean'?data.compactTools:base.compactTools,
    floatRailSide,
    toolbarGroups:normalizeToolbarGroups(data.toolbarGroups),
    uiScale:finiteOr(data.uiScale,base.uiScale,.8,1.2),
    fontScale:finiteOr(data.fontScale,base.fontScale,.9,1.2),
    accent:accents.includes(data.accent as Accent)?data.accent as Accent:base.accent,
    performancePreset:performancePresets.includes(data.performancePreset as PerformancePreset)?data.performancePreset as PerformancePreset:base.performancePreset
  };
}
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
}),{name:'sven-studio-ui-layout-041',version:1,merge:mergeSavedLayout,partialize:s=>({sides:s.sides,order:s.order,visible:s.visible,toolbarDock:s.toolbarDock,toolbarGroups:s.toolbarGroups,compactTools:s.compactTools,floatRailSide:s.floatRailSide,widths:s.widths,heights:s.heights,weights:s.weights,uiScale:s.uiScale,accent:s.accent,fontScale:s.fontScale,performancePreset:s.performancePreset})}));
