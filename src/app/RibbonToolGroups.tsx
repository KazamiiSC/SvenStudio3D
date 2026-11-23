/** Tools ribbon groups "Modeling" and "Textures" (v2.4).
 * They expose EXISTING, undoable editor actions that were only reachable from the floating rail,
 * the Properties panel or the Texture Studio. Nothing new happens to the map: every button calls
 * the same store action as before. Errors (e.g. "select two brushes") show as a short notice
 * instead of a blocking alert.
 */
import type {ReactNode} from 'react';
import {Slice,PackageOpen,Scissors,SquareMinus,Combine,Merge,ArrowUpFromLine,Grid2x2Check,PaintBucket,Expand,AlignHorizontalJustifyCenter,Replace,SwatchBook} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {ToolButton} from './AppMenuButtons';
import {transformedVertices} from '../engine/geometry';
import type {Brush} from '../engine/types';

export function showToast(message:string,kind:'info'|'error'='info'){
  document.dispatchEvent(new CustomEvent('svenstudio:toast',{detail:{message,kind}}));
}

function useRun(){
  const t=useT();
  return (label:string,action:()=>void)=>{
    try{action();showToast(`${t(label)}: ${t('Done')}`);}
    catch(error){const message=String(error instanceof Error?error.message:error);useEditor.getState().appendLogs([`${label}: ${message}`]);showToast(t(message),'error');}
  };
}

type GroupProps={groupProps:Record<string,unknown>;caption:ReactNode};

export function ModelingRibbonGroup({groupProps,caption}:GroupProps){
  const t=useT();
  const run=useRun();
  const selectedIds=useEditor(s=>s.selectedIds);
  const objects=useEditor(s=>s.project.objects);
  const geometryMode=useEditor(s=>s.geometryMode),selectedFace=useEditor(s=>s.selectedFace);
  const snap=useEditor(s=>s.snapping?s.snap:0);
  const brushes=objects.filter((o):o is Brush=>o.kind==='brush'&&selectedIds.includes(o.id)&&!o.locked);
  const one=brushes.length===1&&selectedIds.length===1?brushes[0]:null;
  const two=brushes.length===2&&selectedIds.length===2;
  const step=Math.max(snap||16,4);
  const freeClip=useEditor(s=>s.freeClipMode);
  // Split in half across the longest horizontal side, at the centre snapped to the grid.
  const split=()=>{
    if(!one)return;
    const pts=transformedVertices(one);
    const span=(i:0|1)=>Math.max(...pts.map(p=>p[i]))-Math.min(...pts.map(p=>p[i]));
    const axis:0|1=span(0)>=span(1)?0:1;
    const centre=(Math.max(...pts.map(p=>p[axis]))+Math.min(...pts.map(p=>p[axis])))/2;
    const at=snap>0?Math.round(centre/snap)*snap:Math.round(centre);
    useEditor.getState().clipSelected(axis,at,'both');
  };
  return <div className="ribbon-group" {...groupProps}><div className="ribbon-tools">
    <ToolButton disabled={!one} title={`${t('Hollow')}: ${t('turn the selected brush into walls')} (${step}u)`} onClick={()=>run('Hollow',()=>useEditor.getState().hollowSelected(step))}><PackageOpen size={19}/><small>{t('Hollow')}</small></ToolButton>
    <ToolButton disabled={!one} title={t('Split the selected brush in half (longest side, on the grid)')} onClick={()=>run('Split',split)}><Scissors size={19}/><small>{t('Split')}</small></ToolButton>
    <ToolButton active={freeClip} title={t('Free clip: drag a line across the selected brushes in any 2D view, then choose what to keep. Esc ends.')} onClick={()=>useEditor.getState().setFreeClipMode(!useEditor.getState().freeClipMode)}><Slice size={19}/><small>{t('Free clip')}</small></ToolButton>
    <ToolButton disabled={!two} title={t('Subtract: select the target, then the cutter (Ctrl/Shift + click)')} onClick={()=>run('Subtract',()=>useEditor.getState().booleanSelected('subtract'))}><SquareMinus size={19}/><small>{t('Subtract')}</small></ToolButton>
    <ToolButton disabled={!two} title={t('Union: join two brushes of the same entity into one convex brush')} onClick={()=>run('Union',()=>useEditor.getState().booleanSelected('union'))}><Combine size={19}/><small>{t('Union')}</small></ToolButton>
    <ToolButton disabled={brushes.length<2} title={t('Fuse the selected brushes (Smart Brush Fusion)')} onClick={()=>run('Fuse',()=>useEditor.getState().fuseSelection('auto'))}><Merge size={19}/><small>{t('Fuse')}</small></ToolButton>
    <ToolButton disabled={!(geometryMode==='face'&&selectedFace!==null&&one)} title={`${t('Extrude the selected face')} (${step}u) · ${t('Face mode: select a face first')}`} onClick={()=>run('Extrude',()=>useEditor.getState().extrudeSelected(step))}><ArrowUpFromLine size={19}/><small>{t('Extrude')}</small></ToolButton>
    <ToolButton disabled={!selectedIds.length} title={t('Snap selection to grid')} onClick={()=>run('Snap selection to grid',()=>useEditor.getState().snapSelectionToGrid())}><Grid2x2Check size={19}/><small>{t('To grid')}</small></ToolButton>
  </div><small className="ribbon-caption">{caption}</small></div>;
}

export function TexturesRibbonGroup({groupProps,caption}:GroupProps){
  const t=useT();
  const run=useRun();
  const selectedIds=useEditor(s=>s.selectedIds);
  const currentTexture=useEditor(s=>s.currentTexture);
  const studioOpen=useEditor(s=>s.textureStudioOpen);
  const hasBrush=useEditor(s=>s.project.objects.some(o=>o.kind==='brush'&&s.selectedIds.includes(o.id)));
  return <div className="ribbon-group" {...groupProps}><div className="ribbon-tools">
    <ToolButton disabled={!hasBrush||!currentTexture} title={`${t('Apply the current texture')}: ${currentTexture||'—'}`} onClick={()=>run('Apply texture',()=>useEditor.getState().paintSelected(currentTexture))}><PaintBucket size={19}/><small>{t('Apply')}</small></ToolButton>
    <ToolButton disabled={!hasBrush} title={t('Fit the texture once across each selected face')} onClick={()=>run('Fit texture',()=>useEditor.getState().fitTextureStudio(1,1))}><Expand size={19}/><small>{t('Fit')}</small></ToolButton>
    <ToolButton disabled={!hasBrush} title={t('Align the texture to the world grid')} onClick={()=>run('Align texture',()=>useEditor.getState().alignTextureStudio())}><AlignHorizontalJustifyCenter size={19}/><small>{t('Align')}</small></ToolButton>
    <ToolButton title={`${t('Find and replace texture')} [Shift + T]`} onClick={()=>document.dispatchEvent(new CustomEvent('svenstudio:open-texture-replace',{detail:{}}))}><Replace size={19}/><small>{t('Replace')}</small></ToolButton>
    <ToolButton active={studioOpen} title={t('Texture Studio · UV (face mode)')} onClick={()=>{const s=useEditor.getState();s.setTextureStudioOpen(!s.textureStudioOpen);if(s.geometryMode!=='face')s.setGeometryMode('face');}}><SwatchBook size={19}/><small>UV</small></ToolButton>
  </div><small className="ribbon-caption">{caption}</small></div>;
}
