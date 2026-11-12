/** Stage 7: independent floating inspector for compiled BSP30 RGB lightmaps.
 * Controls affect only the selected face samples, not the MAP editor's lighting. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {clampFloatingPanelPosition} from './floatingPanelPosition';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {Grip,Sun,Copy,ClipboardPaste,Undo2,Redo2,X} from 'lucide-react';
import type {BspMap} from '../engine/bsp';
import {bspOriginalFaceIndex} from '../engine/bspFaceSelection';
import {bspCanEditFaceLightmap,type BspLightmapAdjustment} from '../engine/bspFaceLightmapEdit';
const translations={
 es:{title:'Lightmap Studio BSP',selected:'caras seleccionadas',missing:'Seleccioná una cara con muestras de iluminación RGB.',style:'Estilos de luz',preview:'Muestras originales de la cara',gain:'Intensidad',offset:'Brillo adicional',color:'Color de la luz',apply:'Aplicar a las caras',copy:'Copiar iluminación',paste:'Pegar iluminación',undo:'Deshacer',redo:'Rehacer',close:'Cerrar',hint:'Modifica luz ya compilada; no crea sombras nuevas ni recalcula RAD. Exportá una copia BSP.',blocked:'Para pegar se requieren las mismas dimensiones y estilos de luz.',original:'Sin edición pendiente',pending:'ediciones pendientes'},
 en:{title:'BSP Lightmap Studio',selected:'selected faces',missing:'Select a face with compiled RGB lighting samples.',style:'Lightstyles',preview:'Original samples for this face',gain:'Intensity',offset:'Additional brightness',color:'Light color',apply:'Apply to faces',copy:'Copy lighting',paste:'Paste lighting',undo:'Undo',redo:'Redo',close:'Close',hint:'Edits baked lighting only; does not create new shadows or rerun RAD. Export a BSP copy.',blocked:'Paste requires matching sample size and lightstyles.',original:'No pending edit',pending:'pending edits'},
 ru:{title:'BSP Lightmap Studio',selected:'выбранных граней',missing:'Выберите грань с RGB lightmap.',style:'Стили света',preview:'Исходные образцы освещения',gain:'Интенсивность',offset:'Добавить яркость',color:'Цвет освещения',apply:'Применить',copy:'Копировать свет',paste:'Вставить свет',undo:'Отменить',redo:'Повторить',close:'Закрыть',hint:'Изменяет только запечённый свет; новые тени не создаются. Экспортируйте BSP.',blocked:'Для вставки требуются совпадающие размеры и стили.',original:'Нет изменений',pending:'изменений'},
 ko:{title:'BSP 라이트맵 스튜디오',selected:'선택한 면',missing:'RGB 라이트맵이 있는 면을 선택하세요.',style:'조명 스타일',preview:'원본 라이트맵',gain:'강도',offset:'밝기 보정',color:'조명 색상',apply:'선택 면에 적용',copy:'조명 복사',paste:'조명 붙여넣기',undo:'실행 취소',redo:'다시 실행',close:'닫기',hint:'기존 조명만 수정합니다. 새 그림자나 RAD 재계산은 없습니다.',blocked:'크기와 라이트스타일이 일치해야 합니다.',original:'변경 없음',pending:'변경 대기'},
 zh:{title:'BSP 光照贴图工作室',selected:'个选中表面',missing:'请选择含 RGB 光照贴图的表面。',style:'灯光样式',preview:'原始光照采样',gain:'亮度倍率',offset:'附加亮度',color:'灯光颜色',apply:'应用到所选面',copy:'复制光照',paste:'粘贴光照',undo:'撤销',redo:'重做',close:'关闭',hint:'仅修改已烘焙光照，不产生新阴影，不重新运行 RAD。',blocked:'粘贴需要相同尺寸和灯光样式。',original:'尚未编辑',pending:'待保存编辑'},
 pt:{title:'BSP Lightmap Studio',selected:'faces selecionadas',missing:'Selecione uma face com amostras RGB.',style:'Estilos de luz',preview:'Amostras originais',gain:'Intensidade',offset:'Brilho adicional',color:'Cor da luz',apply:'Aplicar às faces',copy:'Copiar iluminação',paste:'Colar iluminação',undo:'Desfazer',redo:'Refazer',close:'Fechar',hint:'Edita luz já compilada; não cria sombras novas nem recalcula RAD. Exporte uma cópia BSP.',blocked:'Colar exige dimensões e estilos iguais.',original:'Sem alterações',pending:'edições pendentes'},
};
type Locale=keyof typeof translations;
function rgbHex([r,g,b]:[number,number,number]){return '#'+[r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')}
function hexRgb(value:string):[number,number,number]{return [1,3,5].map(index=>parseInt(value.slice(index,index+2),16)/255) as [number,number,number]}
export function BspLightmapStudio({locale,map,selected,visible,edited,canUndo,canRedo,onClose,onApply,onUndo,onRedo,error}:{
 locale:Locale;map:BspMap;selected:number[];visible:boolean;edited:number;canUndo:boolean;canRedo:boolean;onClose:()=>void;
 onApply:(adjustment:BspLightmapAdjustment)=>void;onUndo:()=>void;onRedo:()=>void;error:string;
}){
 const t=translations[locale]||translations.en;
 const [gain,setGain]=useState(1),[add,setAdd]=useState(0),[color,setColor]=useState('#ffffff'),[copied,setCopied]=useState<number|null>(null);
 const [position,setPosition]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem('sven:bsp-lightmap-studio')||'null');return saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?saved:{x:Math.max(12,window.innerWidth-710),y:230}}catch{return {x:350,y:230}}});
 const [localError,setLocalError]=useState('');const drag=useRef<{id:number;x:number;y:number;left:number;top:number}|null>(null);
 const first=selected.length?map.faces.find((face,i)=>bspOriginalFaceIndex(face,i)===selected[selected.length-1]):null;
 const canEdit=selected.length>0&&selected.every(id=>bspCanEditFaceLightmap(map.faces.find((face,i)=>bspOriginalFaceIndex(face,i)===id)));
 const src=first&&bspCanEditFaceLightmap(first)?first:null;
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const el=canvas.current;if(!el||!src?.lightRgb)return;const ctx=el.getContext('2d');if(!ctx)return;
  const w=src.lightWidth,h=src.lightHeight;el.width=w;el.height=h;
  const image=ctx.createImageData(w,h);for(let i=0;i<w*h;i++){
    for(let c=0;c<3;c++)image.data[i*4+c]=src.lightRgb[i*3+c];image.data[i*4+3]=255;
  }ctx.putImageData(image,0,0);
 },[src,visible]);
 useEffect(()=>{
  const adjust=()=>setPosition((p:{x:number;y:number})=>clampFloatingPanelPosition(p,{width:window.innerWidth,height:window.innerHeight},310));
  if(visible)adjust();window.addEventListener('resize',adjust);return()=>window.removeEventListener('resize',adjust);
 },[visible]);
 useEffect(()=>{const stop=(event:PointerEvent)=>{if(drag.current?.id===event.pointerId){drag.current=null;try{localStorage.setItem('sven:bsp-lightmap-studio',JSON.stringify(position))}catch{}}};
  const blur=()=>{drag.current=null};window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);window.addEventListener('blur',blur);
  return()=>{window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);window.removeEventListener('blur',blur)};
 },[position]);
 const onDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{if(!drag.current||event.pointerId!==drag.current.id)return;
   const next=clampFloatingPanelPosition({x:drag.current.left+event.clientX-drag.current.x,y:drag.current.top+event.clientY-drag.current.y},{width:window.innerWidth,height:window.innerHeight},310);setPosition(next)};
 const pasteDisabled=useMemo(()=>{
   if(copied===null||!canEdit||!src)return true;
   const source=map.faces.find((f,i)=>bspOriginalFaceIndex(f,i)===copied);if(!source||!bspCanEditFaceLightmap(source))return true;
   return selected.some(id=>{const face=map.faces.find((f,i)=>bspOriginalFaceIndex(f,i)===id);return !face||face.lightWidth!==source.lightWidth||face.lightHeight!==source.lightHeight||JSON.stringify(face.lightStyles)!==JSON.stringify(source.lightStyles)})
 },[copied,selected,canEdit,map,src]);
 if(!visible)return null;
 return createPortal(<section className="bsp-lightmap-studio" aria-label={t.title} style={{left:position.x,top:position.y,maxHeight:`calc(100dvh - ${position.y+8}px)`}} onPointerDown={e=>e.stopPropagation()}>
   <div className="bsp-lightmap-studio-header" onPointerDown={e=>{if(e.button!==0)return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:position.x,top:position.y};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={onDrag} onPointerUp={()=>{drag.current=null;try{localStorage.setItem('sven:bsp-lightmap-studio',JSON.stringify(position))}catch{}}} onPointerCancel={()=>drag.current=null}>
    <Grip size={16}/><Sun size={16}/><strong>{t.title}</strong><button aria-label={t.close} title={t.close} onPointerDown={e=>e.stopPropagation()} onClick={onClose}><X size={16}/></button>
   </div>
   <div className="bsp-lightmap-studio-body">
    <small>{selected.length} {t.selected} · {edited} {t.pending}</small>
    {src?<><div className="bsp-lightmap-preview"><canvas ref={canvas} style={{imageRendering:'pixelated'}}/><span>#{src.bspFaceIndex} · {src.lightWidth} × {src.lightHeight} px</span></div>
      <small>{t.style}: {src.lightStyles?.join(', ')||'—'}</small></>:<p className="bsp-warning">{t.missing}</p>}
    <label>{t.gain} · {gain.toFixed(2)}×<input type="range" min="0" max="4" step="0.05" value={gain} onChange={e=>setGain(Number(e.target.value))}/></label>
    <label>{t.offset} · {add}<input type="range" min="-64" max="64" step="1" value={add} onChange={e=>setAdd(Number(e.target.value))}/></label>
    <label>{t.color}<input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>
    <div className="bsp-lightmap-actions"><button disabled={!canEdit} onClick={()=>{setLocalError('');onApply({gain,add,tint:hexRgb(color)})}}>{t.apply}</button>
      <button disabled={!src} onClick={()=>{if(src?.bspFaceIndex!==undefined)setCopied(src.bspFaceIndex)}}><Copy size={13}/>{t.copy}</button>
      <button disabled={pasteDisabled} title={t.blocked} onClick={()=>{if(copied!==null)onApply({gain:1,add:0,tint:[1,1,1],copyFrom:copied})}}><ClipboardPaste size={13}/>{t.paste}</button></div>
    <div className="bsp-lightmap-actions"><button disabled={!canUndo} onClick={onUndo}><Undo2 size={13}/>{t.undo}</button><button disabled={!canRedo} onClick={onRedo}><Redo2 size={13}/>{t.redo}</button></div>
    {(error||localError)&&<p className="bsp-warning" role="alert">{error||localError}</p>}
    <small>{t.hint}</small>
   </div>
 </section>,document.body);
}
