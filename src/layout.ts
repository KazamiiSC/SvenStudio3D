/** Browser-only workspace arrangement. No map data or compiler settings are modified. */
import {isViewportThemeId} from './engine/viewportThemes';
import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {DEFAULT_INTERFACE_THEME,normalizeInterfaceTheme,type InterfaceTheme} from './engine/interfaceThemes.ts';
export type DockSide = 'left'|'right'|'top'|'bottom';
export type DockPanelId = 'assets'|'explorer'|'properties'|'console';
export const TOOLBAR_GROUPS = ['transform','view','geometry','tools','grid','edit','studios','modeling','textures'] as const;
export type ToolbarGroup = typeof TOOLBAR_GROUPS[number];
/** English UI keys (translated with t()) for the Workspace → Toolbar groups menu. */
export const TOOLBAR_GROUP_LABELS:Record<ToolbarGroup,string>={transform:'Transform · Selection',edit:'Edit',view:'View',geometry:'Geometry editing',modeling:'Modeling',textures:'Textures',tools:'Tools',grid:'Grid',studios:'Studios'};
export function normalizeToolbarGroups(value:unknown):ToolbarGroup[]{
 const existing=[...new Set(Array.isArray(value)?value.filter((id):id is ToolbarGroup=>typeof id==='string'&&TOOLBAR_GROUPS.includes(id as ToolbarGroup)):[])];
 // Groups added in later versions go next to their neighbour in the default order, not at the end.
 // v2.4: Modeling goes right after Geometry and Textures after Modeling, when those are present.
 for(const [id,after] of [['modeling','geometry'],['textures','modeling']] as const){
   if(existing.length&&!existing.includes(id)&&existing.includes(after))existing.splice(existing.indexOf(after)+1,0,id);
 }
 return [...new Set([...existing,...TOOLBAR_GROUPS])];
}
export function moveToolbarGroup(groups:readonly ToolbarGroup[],from:ToolbarGroup,to:ToolbarGroup):ToolbarGroup[]{
  const normalized=normalizeToolbarGroups(groups);
  if(from===to||!normalized.includes(from)||!normalized.includes(to))return normalized;
  const next=normalized.filter(id=>id!==from);next.splice(next.indexOf(to),0,from);return next;
}

export type Accent = 'nebula'|'ice'|'ember'|'mint'|'orchid'|'gold';
export type AppearanceMode = 'dark';
/** New visual order, while the canonical group IDs remain backward compatible. */
/** v2.3 HF8: one home per action. Grid/snap live in the viewport bar and studios in the Studios
 * menu, so these ribbon groups start hidden (Workspace menu → Toolbar groups shows them again). */
export const DEFAULT_HIDDEN_TOOLBAR_GROUPS:ToolbarGroup[]=['grid','studios'];
export const REDESIGNED_TOOLBAR_ORDER: ToolbarGroup[] = ['transform','edit','view','geometry','modeling','textures','tools','grid','studios'];
export type PerformancePreset = 'quality'|'balanced'|'large';
export type WorkspaceSnapshot = {
  sides:Record<DockPanelId,DockSide>;order:DockPanelId[];visible:Record<DockPanelId,boolean>;
  toolbarDock:DockSide;compactTools:boolean;toolbarGroups:ToolbarGroup[];
  widths:{left:number;right:number};heights:{top:number;bottom:number};weights:Record<DockPanelId,number>;
};
export function validateWorkspaceName(value:string):string{
  return value.trim().replace(/[<>\\/:*?"|]/g,'').slice(0,48);
}
const cloneSnapshot=(s:WorkspaceSnapshot):WorkspaceSnapshot=>({
 sides:{...s.sides},order:[...s.order],visible:{...s.visible},toolbarDock:s.toolbarDock,
 compactTools:s.compactTools,toolbarGroups:[...s.toolbarGroups],widths:{...s.widths},
 heights:{...s.heights},weights:{...s.weights}
});

type LayoutState = {
  sides: Record<DockPanelId,DockSide>;
  order: DockPanelId[];
  visible: Record<DockPanelId,boolean>;
  toolbarDock: DockSide;
  compactTools:boolean;
  toolbarGroups:ToolbarGroup[];
  entityStampMode:boolean;
  setEntityStampMode:(value:boolean)=>void;
  pinnedToolbarGroups:ToolbarGroup[];
  togglePinnedToolbarGroup:(id:ToolbarGroup)=>void;
  hiddenToolbarGroups:ToolbarGroup[];
  toggleToolbarGroupHidden:(id:ToolbarGroup)=>void;
  savedWorkspaces:Record<string,WorkspaceSnapshot>;
  saveCurrentWorkspace:(name:string)=>void;
  restoreSavedWorkspace:(name:string)=>void;
  deleteSavedWorkspace:(name:string)=>void;
  reorderToolbarGroup:(from:ToolbarGroup,to:ToolbarGroup)=>void;
  stepToolbarGroup:(id:ToolbarGroup,direction:-1|1)=>void;
  floatRailSide:'left'|'right';
  widths: {left:number;right:number};
  heights: {top:number;bottom:number};
  weights: Record<DockPanelId,number>;
  uiScale:number;
  autoLayout:boolean;
  setAutoLayout:(value:boolean)=>void;
  accent:Accent;
  interfaceTheme:InterfaceTheme;
  appearance:AppearanceMode;
  fontScale:number;
  performancePreset:PerformancePreset;
  opaqueBrushBatching:boolean;
  /** v2.4: maximum 3D viewport pixel ratio; 0 = automatic from the performance preset. */
  viewportPixelRatio:number;
  /** v2.4: 3D entity models. 'all' shows every model; 'near' only within modelDistance. */
  modelDisplay:'all'|'near';modelDistance:number;
  /** v2.6: 3D viewport display style (background + grid colours). */
  viewportTheme:import('./engine/viewportThemes').ViewportThemeId;
  movePanel:(id:DockPanelId,side:DockSide,before?:DockPanelId)=>void;
  setToolbarDock:(side:DockSide)=>void;
  setCompactTools:(value:boolean)=>void;setFloatRailSide:(side:'left'|'right')=>void;
  setVisible:(id:DockPanelId,visible:boolean)=>void;
  setSideSize:(side:DockSide,value:number)=>void;
  setWeights:(id:DockPanelId,a:number,other:DockPanelId,b:number)=>void;
  setScale:(scale:number)=>void;
  setAccent:(accent:Accent)=>void;
  setInterfaceTheme:(theme:InterfaceTheme)=>void;
  setAppearance:(mode:AppearanceMode)=>void;
  setFontScale:(value:number)=>void;
  setPerformancePreset:(value:PerformancePreset)=>void;
  setOpaqueBrushBatching:(value:boolean)=>void;setViewportPixelRatio:(value:number)=>void;setModelDisplay:(value:'all'|'near')=>void;setModelDistance:(value:number)=>void;setViewportTheme:(value:import('./engine/viewportThemes').ViewportThemeId)=>void;
  resetLayout:()=>void;
  usePreset:(preset:'organized'|'classic'|'focus'|'creative'|'wide'|'minimal'|'construction'|'entities'|'bsp')=>void;
};
const defaults = () => ({
  sides:{assets:'left',explorer:'right',properties:'right',console:'bottom'} as Record<DockPanelId,DockSide>,
  order:['assets','properties','explorer','console'] as DockPanelId[],
  visible:{assets:true,explorer:true,properties:true,console:false} as Record<DockPanelId,boolean>,
  toolbarDock:'top' as DockSide,
  toolbarGroups:[...REDESIGNED_TOOLBAR_ORDER],pinnedToolbarGroups:[] as ToolbarGroup[],hiddenToolbarGroups:[...DEFAULT_HIDDEN_TOOLBAR_GROUPS],entityStampMode:false,savedWorkspaces:{} as Record<string,WorkspaceSnapshot>,
  compactTools:false,floatRailSide:'left' as 'left'|'right',
  widths:{left:254,right:302},heights:{top:192,bottom:168},
  weights:{assets:1,explorer:1,properties:1,console:1},
  uiScale:1,autoLayout:true,accent:'nebula' as Accent,interfaceTheme:DEFAULT_INTERFACE_THEME,appearance:'dark' as AppearanceMode,fontScale:1,performancePreset:'balanced' as PerformancePreset,opaqueBrushBatching:true,viewportPixelRatio:0,modelDisplay:'all' as 'all'|'near',modelDistance:4000,viewportTheme:'classic' as import('./engine/viewportThemes').ViewportThemeId
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
    entityStampMode:data.entityStampMode===true,
    // Layouts saved before HF8 have no list: they get the new tidy default.
    hiddenToolbarGroups:Array.isArray(data.hiddenToolbarGroups)?normalizeToolbarGroups(data.hiddenToolbarGroups).filter(id=>(data.hiddenToolbarGroups as unknown[]).includes(id)):[...DEFAULT_HIDDEN_TOOLBAR_GROUPS],
    pinnedToolbarGroups:Array.isArray(data.pinnedToolbarGroups)?normalizeToolbarGroups(data.pinnedToolbarGroups).filter(id=>(data.pinnedToolbarGroups as unknown[]).includes(id)):[],
    savedWorkspaces:Object.fromEntries(Object.entries(recordOrEmpty(data.savedWorkspaces)).filter(([name,item])=>name.length<=48&&item&&typeof item==='object').slice(0,12).map(([name,item])=>{
      const source=recordOrEmpty(item);
      const layout=mergeWorkspaceSnapshot(source,base);
      return [name,layout];
    })),
    toolbarGroups:(Array.isArray(data.toolbarGroups)&&data.toolbarGroups.length===TOOLBAR_GROUPS.length&&data.toolbarGroups.every((id,index)=>id===TOOLBAR_GROUPS[index]))?[...REDESIGNED_TOOLBAR_ORDER]:normalizeToolbarGroups(data.toolbarGroups??REDESIGNED_TOOLBAR_ORDER),
    uiScale:finiteOr(data.uiScale,base.uiScale,.8,1.2),
    autoLayout:typeof data.autoLayout==='boolean'?data.autoLayout:true,
    fontScale:finiteOr(data.fontScale,base.fontScale,.9,1.2),
    accent:accents.includes(data.accent as Accent)?data.accent as Accent:base.accent,
    interfaceTheme:normalizeInterfaceTheme(data.interfaceTheme),
    appearance:'dark',
    performancePreset:performancePresets.includes(data.performancePreset as PerformancePreset)?data.performancePreset as PerformancePreset:base.performancePreset,
    opaqueBrushBatching:typeof data.opaqueBrushBatching==='boolean'?data.opaqueBrushBatching:true,
    viewportPixelRatio:[0,.75,1,1.25,1.5,2].includes(Number(data.viewportPixelRatio))?Number(data.viewportPixelRatio):0,
    modelDisplay:data.modelDisplay==='near'?'near':'all',
    modelDistance:typeof data.modelDistance==='number'&&Number.isFinite(data.modelDistance)?Math.max(500,Math.min(32000,Math.round(data.modelDistance))):4000,
    viewportTheme:isViewportThemeId(data.viewportTheme)?data.viewportTheme:'classic'
  };
}
/** Sanitize a saved profile before it can change a live workspace. */
function mergeWorkspaceSnapshot(data:Record<string,unknown>,base:ReturnType<typeof defaults>):WorkspaceSnapshot{
 const sides={...base.sides},visible={...base.visible},weights={...base.weights};
 const rawSides=recordOrEmpty(data.sides),rawVisible=recordOrEmpty(data.visible),rawWeights=recordOrEmpty(data.weights);
 for(const id of panelIds){
   if(dockSides.includes(rawSides[id] as DockSide))sides[id]=rawSides[id] as DockSide;
   if(typeof rawVisible[id]==='boolean')visible[id]=rawVisible[id] as boolean;
   weights[id]=finiteOr(rawWeights[id],1,.12,16);
 }
 const widths=recordOrEmpty(data.widths),heights=recordOrEmpty(data.heights);
 return {sides,visible,weights,order:[...new Set([...(Array.isArray(data.order)?data.order.filter((id):id is DockPanelId=>panelIds.includes(id as DockPanelId)):[]),...base.order])],
   toolbarDock:dockSides.includes(data.toolbarDock as DockSide)?data.toolbarDock as DockSide:'top',
   compactTools:typeof data.compactTools==='boolean'?data.compactTools:false,
   toolbarGroups:normalizeToolbarGroups(data.toolbarGroups),
   widths:{left:finiteOr(widths.left,254,190,700),right:finiteOr(widths.right,302,190,700)},
   heights:{top:finiteOr(heights.top,192,130,500),bottom:finiteOr(heights.bottom,168,130,500)}};
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
  setEntityStampMode:entityStampMode=>set({entityStampMode}),
  toggleToolbarGroupHidden:id=>set(s=>({hiddenToolbarGroups:s.hiddenToolbarGroups.includes(id)?s.hiddenToolbarGroups.filter(g=>g!==id):[...s.hiddenToolbarGroups,id]})),
  togglePinnedToolbarGroup:id=>set(s=>({pinnedToolbarGroups:s.pinnedToolbarGroups.includes(id)?s.pinnedToolbarGroups.filter(g=>g!==id):[...s.pinnedToolbarGroups,id]})),
  saveCurrentWorkspace:name=>set(s=>{
    const clean=validateWorkspaceName(name);if(!clean)return {};
    const snapshot=cloneSnapshot(s);
    const names=Object.keys(s.savedWorkspaces).filter(k=>k!==clean);
    // Cap local browser profiles. Do not touch projects or compiler settings.
    const previous=Object.fromEntries(names.slice(-11).map(k=>[k,s.savedWorkspaces[k]]));
    return {savedWorkspaces:{...previous,[clean]:snapshot}};
  }),
  restoreSavedWorkspace:name=>set(s=>{
    const profile=s.savedWorkspaces[name];if(!profile)return {};
    return {...cloneSnapshot(mergeWorkspaceSnapshot(profile as unknown as Record<string,unknown>,defaults()))};
  }),
  deleteSavedWorkspace:name=>set(s=>{const next={...s.savedWorkspaces};delete next[name];return {savedWorkspaces:next};}),

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
  setAutoLayout:autoLayout=>set({autoLayout}),
  setAccent:accent=>set({accent}),
  setInterfaceTheme:theme=>set({interfaceTheme:normalizeInterfaceTheme(theme)}),
  setAppearance:()=>set({appearance:'dark'}),
  setFontScale:fontScale=>set({fontScale:clamp(fontScale,.9,1.2)}),
  setPerformancePreset:performancePreset=>set({performancePreset}),
  setOpaqueBrushBatching:opaqueBrushBatching=>set({opaqueBrushBatching}),setViewportPixelRatio:viewportPixelRatio=>set({viewportPixelRatio}),setModelDisplay:modelDisplay=>set({modelDisplay}),setModelDistance:modelDistance=>set({modelDistance:Math.max(500,Math.min(32000,modelDistance))}),setViewportTheme:viewportTheme=>set({viewportTheme}),
  resetLayout:()=>set(s=>({...defaults(),accent:s.accent,interfaceTheme:s.interfaceTheme,appearance:s.appearance,savedWorkspaces:s.savedWorkspaces,pinnedToolbarGroups:s.pinnedToolbarGroups,hiddenToolbarGroups:s.hiddenToolbarGroups,entityStampMode:s.entityStampMode})),
  usePreset:preset=>set(s=>{
    const base={...defaults(),accent:s.accent,interfaceTheme:s.interfaceTheme,appearance:s.appearance,uiScale:s.uiScale,autoLayout:s.autoLayout,fontScale:s.fontScale,performancePreset:s.performancePreset,opaqueBrushBatching:s.opaqueBrushBatching,viewportPixelRatio:s.viewportPixelRatio,viewportTheme:s.viewportTheme,modelDisplay:s.modelDisplay,modelDistance:s.modelDistance,savedWorkspaces:s.savedWorkspaces,pinnedToolbarGroups:s.pinnedToolbarGroups,hiddenToolbarGroups:s.hiddenToolbarGroups,entityStampMode:s.entityStampMode};
    if(preset==='construction')return {...base,compactTools:false,toolbarDock:'top',visible:{assets:true,explorer:false,properties:true,console:false},widths:{left:292,right:310}};
    if(preset==='entities')return {...base,compactTools:true,toolbarDock:'top',visible:{assets:true,explorer:true,properties:true,console:false},widths:{left:316,right:294}};
    if(preset==='bsp')return {...base,compactTools:true,toolbarDock:'top',visible:{assets:false,explorer:false,properties:true,console:false},widths:{left:254,right:364}};
    if(preset==='organized')return {...base,compactTools:true,visible:{assets:true,explorer:true,properties:true,console:false},widths:{left:266,right:294}};
    if(preset==='creative')return {...base,compactTools:false,toolbarDock:'top',order:['assets','properties','explorer','console'],visible:{assets:true,explorer:false,properties:true,console:false},widths:{left:286,right:294},toolbarGroups:['geometry','transform','edit','view','tools','grid','studios']};
    if(preset==='classic')return {...base,compactTools:false,toolbarDock:'top',visible:{assets:true,explorer:true,properties:true,console:false}};
    if(preset==='focus')return {...base,toolbarDock:'left',visible:{assets:false,explorer:false,properties:true,console:false}};
    if(preset==='wide')return {...base,toolbarDock:'right',floatRailSide:'right' as const,visible:{assets:true,explorer:false,properties:true,console:false},widths:{left:310,right:310}};
    if(preset==='minimal')return {...base,toolbarDock:'left',visible:{assets:false,explorer:false,properties:false,console:false}};
    return base;
  })
}),{name:'sven-studio-ui-layout-041',version:2,migrate:(saved,version)=>{
  // One-time upgrade: make the three functional dock panels visible even if a
  // legacy layout hid them. Subsequent user hide/show choices remain persisted.
  if(version<2&&saved&&typeof saved==='object'){
    const old=saved as Record<string,unknown>;return {...old,visible:{...recordOrEmpty(old.visible),assets:true,explorer:true,properties:true}};
  }return saved;
},merge:mergeSavedLayout,partialize:s=>({sides:s.sides,order:s.order,visible:s.visible,toolbarDock:s.toolbarDock,toolbarGroups:s.toolbarGroups,pinnedToolbarGroups:s.pinnedToolbarGroups,hiddenToolbarGroups:s.hiddenToolbarGroups,savedWorkspaces:s.savedWorkspaces,entityStampMode:s.entityStampMode,compactTools:s.compactTools,floatRailSide:s.floatRailSide,widths:s.widths,heights:s.heights,weights:s.weights,uiScale:s.uiScale,autoLayout:s.autoLayout,accent:s.accent,interfaceTheme:s.interfaceTheme,fontScale:s.fontScale,performancePreset:s.performancePreset,opaqueBrushBatching:s.opaqueBrushBatching,viewportPixelRatio:s.viewportPixelRatio,viewportTheme:s.viewportTheme,modelDisplay:s.modelDisplay,modelDistance:s.modelDistance})}));
