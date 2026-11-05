import {useEffect,useRef,useState} from 'react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {useHudLayout} from '../hudLayout';
import {useStudioLayout} from '../layout';
import {activeShadingMode,shadingPieChoice,SHADING_MODES,SHADING_LABELS,type ShadingMode} from '../engine/shadingPie';

/** Hold Z over the MAP editor, point to a quadrant, release Z to apply.
 * Click a segment as an alternative. No editor geometry or Undo history changes.
 */
export function ShadingPie(){
  const t=useT();
  const [open,setOpen]=useState(false);
  const [point,setPoint]=useState({x:0,y:0});
  const [hovered,setHovered]=useState<ShadingMode|null>(null);
  const ref=useRef({open:false,center:{x:0,y:0},hovered:null as ShadingMode|null,last:{x:0,y:0}});
  const apply=(mode:ShadingMode)=>{useEditor.getState().setShadingMode(mode);ref.current.open=false;setOpen(false);setHovered(null)};
  useEffect(()=>{
    const pointer=(e:PointerEvent)=>{
      ref.current.last={x:e.clientX,y:e.clientY};
      if(!ref.current.open)return;
      const next=shadingPieChoice(e.clientX-ref.current.center.x,e.clientY-ref.current.center.y);
      ref.current.hovered=next;setHovered(next);
    };
    const allowed=(e:KeyboardEvent)=>{
      if(e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||e.repeat||e.code!=='KeyZ')return false;
      const target=e.target as HTMLElement|null;
      if(target?.closest('input,textarea,select,[contenteditable="true"]'))return false;
      const state=useEditor.getState();
      if(state.walkMode||state.flyMode||state.modalTransform||useHudLayout.getState().editing)return false;
      if(document.querySelector('.modal-backdrop,.gs-backdrop,.npc-backdrop,.bsp-workspace'))return false;
      if(document.pointerLockElement)return false;
      return true;
    };
    const down=(e:KeyboardEvent)=>{
      if(ref.current.open){if(e.code==='Escape'){e.preventDefault();e.stopPropagation();ref.current.open=false;setOpen(false);setHovered(null)}else if(e.code==='KeyZ'){e.preventDefault();e.stopPropagation()}return;}
      if(!allowed(e))return;
      // Only activate when the MAP viewport is present; never in the BSP Viewer.
      if(!document.querySelector('.viewport-frame'))return;
      e.preventDefault();e.stopPropagation();
      const center={x:Math.min(innerWidth-154,Math.max(154,ref.current.last.x||innerWidth/2)),y:Math.min(innerHeight-154,Math.max(154,ref.current.last.y||innerHeight/2))};
      ref.current.center=center;ref.current.hovered=null;ref.current.open=true;
      setPoint(center);setHovered(null);setOpen(true);
    };
    const up=(e:KeyboardEvent)=>{
      if(!ref.current.open||e.code!=='KeyZ')return;
      e.preventDefault();e.stopPropagation();
      const selected=ref.current.hovered;
      ref.current.open=false;setOpen(false);setHovered(null);
      if(selected)useEditor.getState().setShadingMode(selected);
    };
    const blur=()=>{ref.current.open=false;setOpen(false);setHovered(null)};
    window.addEventListener('pointermove',pointer,true);
    window.addEventListener('keydown',down,true);
    window.addEventListener('keyup',up,true);
    window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('pointermove',pointer,true);window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up,true);window.removeEventListener('blur',blur)};
  },[]);
  const uiScale=useStudioLayout(s=>s.uiScale||1);
  const wireframe=useEditor(s=>s.wireframe),solid=useEditor(s=>s.solidShading),light=useEditor(s=>s.environmentPreview);
  if(!open)return null;
  const current=activeShadingMode(wireframe,solid,light);
  return <div className="shading-pie-backdrop" role="presentation" onPointerDown={e=>{if(e.target===e.currentTarget){ref.current.open=false;setOpen(false)}}}>
    <div className="shading-pie" style={{left:point.x/uiScale,top:point.y/uiScale}} role="menu" aria-label={t('Shading pie menu')}>
      <div className="shading-pie-ring" aria-hidden="true"/>
      {SHADING_MODES.map(mode=>
        <button type="button" key={mode} role="menuitemradio" aria-checked={current===mode}
          className={`shading-pie-item shading-pie-${mode}${hovered===mode?' hovered':''}${current===mode?' current':''}`}
          onPointerEnter={()=>{ref.current.hovered=mode;setHovered(mode)}}
          onPointerDown={e=>{e.preventDefault();e.stopPropagation();apply(mode)}}
          onClick={()=>apply(mode)}>
          <span className="shading-pie-dot"/>{t(SHADING_LABELS[mode])}
        </button>)}
      <div className="shading-pie-center"><strong>Z</strong><small>{t('Shading')}</small></div>
      <div className="shading-pie-hint">{t('Hold Z · move mouse · release to select')}</div>
    </div>
  </div>;
}
