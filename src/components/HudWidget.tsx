import {useRef,type PointerEvent as ReactPointerEvent,type ReactNode,type CSSProperties} from 'react';
import {Grip,Scaling} from 'lucide-react';
import {useHudLayout,type HudId} from '../hudLayout';
import {useT} from '../i18n';

export function HudWidget({id,children,className='',editPlaceholder}:{id:HudId;children:ReactNode;className?:string;editPlaceholder?:boolean}){
  const t=useT();
  const config=useHudLayout(s=>s.items[id]);
  const editing=useHudLayout(s=>s.editing);
  const globalOpacity=useHudLayout(s=>s.globalOpacity);
  const selected=useHudLayout(s=>s.selected);
  const update=useHudLayout(s=>s.update),select=useHudLayout(s=>s.select);
  const root=useRef<HTMLDivElement>(null);
  const motion=useRef<{pointer:number;kind:'move'|'scale';x:number;y:number;startX:number;startY:number;startScale:number}|null>(null);
  if(!config.visible&&!editing)return null;
  const start=(event:ReactPointerEvent<HTMLButtonElement>,kind:'move'|'scale')=>{
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    select(id);
    motion.current={pointer:event.pointerId,kind,x:event.clientX,y:event.clientY,startX:config.x,startY:config.y,startScale:config.scale};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    const m=motion.current;if(!m||m.pointer!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();
    const parent=root.current?.parentElement;if(!parent)return;
    const bounds=parent.getBoundingClientRect();
    if(m.kind==='scale'){
      update(id,{scale:Math.min(1.8,Math.max(.45,m.startScale+(event.clientX-m.x+event.clientY-m.y)/210))});
    }else{
      const content=root.current?.querySelector<HTMLElement>('.hud-widget-content');
      const child=content?.getBoundingClientRect();
      const maxX=Math.max(0,100-(child?.width??0)/bounds.width*100);
      const maxY=Math.max(0,100-(child?.height??0)/bounds.height*100);
      update(id,{x:Math.min(maxX,Math.max(0,m.startX+(event.clientX-m.x)/bounds.width*100)),
        y:Math.min(maxY,Math.max(0,m.startY+(event.clientY-m.y)/bounds.height*100))});
    }
  };
  const end=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    if(motion.current?.pointer===event.pointerId){motion.current=null;event.stopPropagation()}
  };
  const style:CSSProperties={left:`${config.x}%`,top:`${config.y}%`};
  return <div ref={root} className={`hud-widget hud-${id} ${editing?'hud-editing':''} ${selected===id?'hud-selected':''} ${!config.visible?'hud-hidden':''} ${className}`} style={style} data-hud-id={id}>
    {editing&&<div className="hud-widget-bar" onPointerDown={e=>e.stopPropagation()}>
      <button type="button" className="hud-widget-drag" aria-label={`${t('Move HUD element')} ${id}`} title={t('Drag to move')}
        onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><Grip size={15}/><span>{t(HUD_NAMES[id])}</span></button>
      <button type="button" className="hud-widget-resize" title={t('Drag to resize')} aria-label={`${t('Resize HUD element')} ${id}`}
        onPointerDown={e=>start(e,'scale')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><Scaling size={15}/></button>
    </div>}
    <div className="hud-widget-content" style={{zoom:config.scale,opacity:config.opacity*globalOpacity}}>
      {editPlaceholder?<div className="hud-axis-edit-target">X · Y · Z</div>:children}
    </div>
    {editing&&!config.visible&&<div className="hud-hidden-marker">{t('Hidden')}</div>}
  </div>;
}

export const HUD_NAMES:Record<HudId,string>={
  status:'Viewport status',view:'View controls',pivot:'Scale pivot',tools:'Floating tools',
  orthographic:'Orthographic tools',help:'Mouse help',
  stats:'Scene statistics',transform:'Transform readout',alerts:'Editor messages',axes:'Axis navigator'
};
