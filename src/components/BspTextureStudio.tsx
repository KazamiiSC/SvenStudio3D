/** BSP Texture Studio — the MAP Texture Studio's screen-space UI and UV handle
 * behaviors, backed by the BSP editor's independently validated binary writes.
 * Never uses the MAP editor's project state or changes MAP brushes. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {clampFloatingPanelPosition} from './floatingPanelPosition';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {Grip,X,Copy,Save,Undo2,Redo2,FileUp,Search,Grid3x3,Trash2} from 'lucide-react';
import type {BspMap} from '../engine/bsp';
import type {TextureAsset} from '../engine/types';
import {bspOriginalFaceIndex} from '../engine/bspFaceSelection';
import {bspAllowedFaceTextureIndices,bspEditableTextureName,bspFaceIsLightmapped,type BspSurfaceOperation} from '../engine/bspSurfaceEdit';
import type {UvHandle} from '../engine/textureStudio';
import {clampUvWidgetPosition,pinUvAnchor,type ScreenPoint} from '../engine/uvOverlay';

const STR={
 es:{library:'Biblioteca de texturas BSP',faces:'caras',search:'Buscar texturas...',all:'Todos los WAD',embedded:'Texturas del BSP',import:'Importar WAD3',mode:'Modo Caras',clear:'Limpiar caras',shift:'Desplazamiento (U/V)',scale:'Escala (U/V)',rotation:'Rotación °',link:'Mantener proporciones',apply:'Aplicar a las caras',undo:'Deshacer',redo:'Rehacer',warning:'Rotación y escala reproyectan las muestras RGB del lightmap al exportar. No generan sombras nuevas; verificá el resultado en Sven Co-op.',drag:'Mover UV',close:'Cerrar',choose:'Elegí una textura en la biblioteca',alt:'Alt + clic izquierdo + arrastrar mueve la textura. La pestaña Mover UV desplaza solamente el widget.',offset:'Al exportar, se reproyectan los lightmaps de las caras modificadas.',unlit:'Escala y rotación disponibles sin lightmaps',count:'texturas',repeat:'Repeticiones',fit:'Ajustar a cara',align:'Alinear',export:'Los cambios se guardan al exportar una copia BSP.',reset:'Restablecer',copy:'Copiar UV',paste:'Pegar UV',center:'Centrar',flipU:'Invertir U',flipV:'Invertir V',preset:'Presets',presetName:'Nombre del preset',presetSave:'Guardar',presetDelete:'Eliminar',importedWads:'Quitar WAD importados',removeWad:'Quitar',removeHint:'Solo se quita de esta sesión. Si está en uso en cambios pendientes o en el historial, se bloquea.'},
 en:{library:'BSP texture library',faces:'faces',search:'Search textures...',all:'All WADs',embedded:'BSP textures',import:'Import WAD3',mode:'Face mode',clear:'Clear faces',shift:'Offset (U/V)',scale:'Scale (U/V)',rotation:'Rotation °',link:'Link scale',apply:'Apply to faces',undo:'Undo',redo:'Redo',warning:'Rotation and scaling resample baked lightmap RGB on export; they cannot calculate new shadows. Verify results in Sven Co-op.',drag:'Move UV',close:'Close',choose:'Choose a texture in the library',alt:'Alt + left mouse + drag moves the texture. The Move UV tab moves only the widget.',offset:'Export resamples the existing lightmap on edited faces.',unlit:'Scale and rotation work on unlit faces',count:'textures',repeat:'Tiles',fit:'Fit to face',align:'Align',export:'Changes persist when exporting a BSP copy.',reset:'Reset',copy:'Copy UV',paste:'Paste UV',center:'Center',flipU:'Flip U',flipV:'Flip V',preset:'Presets',presetName:'Preset name',presetSave:'Save',presetDelete:'Remove',importedWads:'Remove imported WADs',removeWad:'Remove',removeHint:'Only removes this file from the session. WADs referenced by staged edits or undo history are protected.'},
 ru:{library:'Библиотека текстур BSP',faces:'граней',search:'Поиск текстур...',all:'Все WAD',embedded:'Текстуры BSP',import:'Импорт WAD3',mode:'Режим граней',clear:'Сбросить',shift:'Смещение (U/V)',scale:'Масштаб (U/V)',rotation:'Поворот °',link:'Связать масштаб',apply:'Применить',undo:'Отменить',redo:'Повторить',warning:'Поворот и масштабирование пересчитывают существующий lightmap RGB, но не создают новые тени.',drag:'Переместить UV',close:'Закрыть',choose:'Выберите текстуру',alt:'Alt + левая кнопка мыши перемещает текстуру. Заголовок перемещает виджет.',offset:'При экспорте образцы света пересчитываются для изменённых граней.',unlit:'Поворот и масштаб без lightmap',count:'текстур',repeat:'Повторения',fit:'Подогнать',align:'Выровнять',export:'Изменения записываются в копию BSP.',reset:'Сбросить',copy:'Копировать UV',paste:'Вставить UV',center:'Центр',flipU:'Отразить U',flipV:'Отразить V',preset:'Шаблоны',presetName:'Имя шаблона',presetSave:'Сохранить',presetDelete:'Удалить',importedWads:'Убрать импортированные WAD',removeWad:'Убрать',removeHint:'Удаление только из текущей сессии; WAD с несохранёнными изменениями защищены.'},
 ko:{library:'BSP 텍스처 라이브러리',faces:'면',search:'텍스처 검색...',all:'전체 WAD',embedded:'BSP 텍스처',import:'WAD3 가져오기',mode:'면 모드',clear:'선택 해제',shift:'이동 (U/V)',scale:'크기 (U/V)',rotation:'회전 °',link:'비율 유지',apply:'면에 적용',undo:'실행 취소',redo:'다시 실행',warning:'회전·크기 변경 시 기존 라이트맵 RGB를 재샘플링합니다. 새로운 그림자는 계산하지 않습니다.',drag:'UV 이동',close:'닫기',choose:'라이브러리에서 텍스처 선택',alt:'Alt + 왼쪽 드래그로 텍스처를 이동합니다. 탭은 위젯만 이동합니다.',offset:'내보낼 때 편집한 면의 라이트맵을 재샘플링합니다.',unlit:'라이트맵이 없는 면에서 회전 및 크기',count:'텍스처',repeat:'반복',fit:'면에 맞춤',align:'정렬',export:'BSP 사본 내보내기에 저장됩니다.',reset:'초기화',copy:'UV 복사',paste:'UV 붙여넣기',center:'중앙',flipU:'U 반전',flipV:'V 반전',preset:'프리셋',presetName:'프리셋 이름',presetSave:'저장',presetDelete:'삭제',importedWads:'가져온 WAD 제거',removeWad:'제거',removeHint:'이 편집 세션에서만 제거됩니다. 사용 중인 텍스처는 보호됩니다.'},
 zh:{library:'BSP 纹理库',faces:'个面',search:'搜索纹理...',all:'所有 WAD',embedded:'BSP 纹理',import:'导入 WAD3',mode:'面模式',clear:'清除选择',shift:'偏移 (U/V)',scale:'缩放 (U/V)',rotation:'旋转 °',link:'保持比例',apply:'应用于面',undo:'撤销',redo:'重做',warning:'旋转和缩放会重新采样原有光照贴图 RGB，不会计算新阴影。',drag:'移动 UV',close:'关闭',choose:'在库中选择纹理',alt:'Alt + 左键拖动纹理；移动 UV 标签只移动小部件。',offset:'导出时重新采样已修改面的光照贴图。',unlit:'无光照贴图表面可旋转和缩放',count:'纹理',repeat:'重复',fit:'适应面',align:'对齐',export:'导出 BSP 副本时保存改动。',reset:'重置',copy:'复制 UV',paste:'粘贴 UV',center:'居中',flipU:'翻转 U',flipV:'翻转 V',preset:'预设',presetName:'预设名称',presetSave:'保存',presetDelete:'删除',importedWads:'移除已导入 WAD',removeWad:'移除',removeHint:'仅从当前会话移除；未导出或历史编辑使用中的 WAD 会受保护。'},
 pt:{library:'Biblioteca de texturas BSP',faces:'faces',search:'Buscar texturas...',all:'Todos os WAD',embedded:'Texturas BSP',import:'Importar WAD3',mode:'Modo faces',clear:'Limpar faces',shift:'Deslocamento (U/V)',scale:'Escala (U/V)',rotation:'Rotação °',link:'Manter proporção',apply:'Aplicar às faces',undo:'Desfazer',redo:'Refazer',warning:'Rotação e escala reamostram a luz RGB existente; não recalculam sombras novas.',drag:'Mover UV',close:'Fechar',choose:'Escolha uma textura na biblioteca',alt:'Alt + botão esquerdo + arrastar move a textura. A aba move só o widget.',offset:'Na exportação, reamostra-se a luz das faces editadas.',unlit:'Escala e rotação em faces sem lightmap',count:'texturas',repeat:'Repetições',fit:'Ajustar à face',align:'Alinhar',export:'As alterações são salvas em uma cópia BSP.',reset:'Restaurar',copy:'Copiar UV',paste:'Colar UV',center:'Centralizar',flipU:'Inverter U',flipV:'Inverter V',preset:'Predefinições',presetName:'Nome da predefinição',presetSave:'Salvar',presetDelete:'Excluir',importedWads:'Remover WAD importados',removeWad:'Remover',removeHint:'Remove apenas desta sessão. WAD usados em edições pendentes ou no histórico ficam protegidos.'}
} as const;
export type BspStudioStrings=typeof STR[keyof typeof STR];
type BspUvPreset={name:string;textureName:string;op:BspSurfaceOperation};
const BSP_PRESET_KEY='svenstudio:bsp-uv-presets-v1';
function readBspPresets():BspUvPreset[]{
 try{const entries:unknown=JSON.parse(localStorage.getItem(BSP_PRESET_KEY)||'[]');
  if(!Array.isArray(entries))return [];
  return entries.filter((item):item is BspUvPreset=>item&&typeof item.name==='string'&&typeof item.textureName==='string'&&item.op&&
     ['offsetU','offsetV','rotation','scaleU','scaleV'].every(key=>Number.isFinite(item.op[key]))).slice(0,30);
 }catch{return []}
}

function useFloating(key:string,initial:{x:number;y:number}){
 const clamp=(p:{x:number;y:number})=>clampFloatingPanelPosition(p,{width:window.innerWidth,height:window.innerHeight},320);
 const [pos,setPos]=useState(()=>{
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');return clamp(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?saved:initial)}catch{return clamp(initial)}
 });
 useEffect(()=>{const adjust=()=>setPos((p:{x:number;y:number})=>clamp(p));window.addEventListener('resize',adjust);return()=>window.removeEventListener('resize',adjust)},[]);
 const drag=useRef<{pointer:number;x:number;y:number;left:number;top:number}|null>(null);
 const start=(e:ReactPointerEvent)=>{if(e.button!==0||(e.target as HTMLElement).closest('button,input,select'))return;e.stopPropagation();e.preventDefault();drag.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,left:pos.x,top:pos.y};e.currentTarget.setPointerCapture(e.pointerId)};
 const move=(e:ReactPointerEvent)=>{const d=drag.current;if(!d||d.pointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();setPos(clamp({x:d.left+e.clientX-d.x,y:d.top+e.clientY-d.y}))};
 const end=(e:ReactPointerEvent)=>{if(!drag.current||drag.current.pointer!==e.pointerId)return;e.stopPropagation();drag.current=null;try{localStorage.setItem(key,JSON.stringify(pos))}catch{}if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)};
 return {pos,start,move,end};
}
const previewCache=new WeakMap<Uint8Array,string>();
function imageForBspTex(rgba:Uint8Array|undefined,width:number,height:number){
 if(!rgba||typeof document==='undefined')return '';
 const previous=previewCache.get(rgba);if(previous)return previous;
 const canvas=document.createElement('canvas'),max=128,scale=Math.min(1,max/Math.max(width,height));
 canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
 const c=canvas.getContext('2d');if(!c)return '';
 const img=c.createImageData(canvas.width,canvas.height);
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
  const source=(Math.min(height-1,Math.floor(y*height/canvas.height))*width+Math.min(width-1,Math.floor(x*width/canvas.width)))*4;
  img.data.set(rgba.subarray(source,source+4),(y*canvas.width+x)*4);
 }
 c.putImageData(img,0,0);const url=canvas.toDataURL('image/png');previewCache.set(rgba,url);return url;
}
export interface BspTextureStudioProps {
 map:BspMap; assets:TextureAsset[]; selectedFaces:number[]; visible:boolean; locale:'es'|'en'|'ru'|'ko'|'zh'|'pt';
 textureIndex:number;setTextureIndex:(index:number)=>void;onApply:(op:BspSurfaceOperation)=>boolean;
 onClear:()=>void;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;
 onImportWad:()=>void;importedWads:readonly string[];onRemoveImportedWad:(filename:string)=>void;importing:boolean;notice:string;error:string;
 onGestureBegin:()=>void;onGestureUpdate:(handle:UvHandle,dx:number,dy:number,keepRatio:boolean)=>void;onGestureFinish:(commit:boolean)=>void;
}
export function BspTextureStudio({map,assets,selectedFaces,visible,locale,textureIndex,setTextureIndex,onApply,onClear,onUndo,onRedo,canUndo,canRedo,onImportWad,importedWads,onRemoveImportedWad,importing,notice,error,onGestureBegin,onGestureUpdate,onGestureFinish}:BspTextureStudioProps){
 const t=STR[locale]||STR.en,panel=useFloating('svenstudio:bsp-texture-panel-v1',{x:Math.max(10,window.innerWidth-690),y:155}),library=useFloating('svenstudio:bsp-wad-library-v1',{x:28,y:155});
 const [panelOpen,setPanelOpen]=useState(true),[libraryOpen,setLibraryOpen]=useState(true),[query,setQuery]=useState(''),[wadFilter,setWadFilter]=useState('');
 const [offsetU,setOffsetU]=useState(0),[offsetV,setOffsetV]=useState(0),[scaleU,setScaleU]=useState(1),[scaleV,setScaleV]=useState(1),[rotation,setRotation]=useState(0),[linked,setLinked]=useState(false);
 const [clipboard,setClipboard]=useState<BspSurfaceOperation|null>(null),[tilesU,setTilesU]=useState(1),[tilesV,setTilesV]=useState(1);
 const [presets,setPresets]=useState<BspUvPreset[]>(readBspPresets),[presetName,setPresetName]=useState(''),[presetSelection,setPresetSelection]=useState('');
 const commitPresets=(next:BspUvPreset[])=>{const limited=next.slice(0,30);setPresets(limited);try{localStorage.setItem(BSP_PRESET_KEY,JSON.stringify(limited))}catch{}};
 const [portal,setPortal]=useState<HTMLElement>(()=>(document.fullscreenElement as HTMLElement|null)||document.body);
 useEffect(()=>{const refresh=()=>setPortal((document.fullscreenElement as HTMLElement|null)||document.body);document.addEventListener('fullscreenchange',refresh);return()=>document.removeEventListener('fullscreenchange',refresh)},[]);
 const current=selectedFaces.length?map.faces.find((face,i)=>bspOriginalFaceIndex(face,i)===selectedFaces[selectedFaces.length-1]):undefined;
 const lit=selectedFaces.some(id=>{const face=map.faces.find((entry,i)=>bspOriginalFaceIndex(entry,i)===id);return !!face&&bspFaceIsLightmapped(face)});
 const eligible=useMemo(()=>{
   // Browsing WADs never requires first selecting a face, matching the MAP library.
   if(!selectedFaces.length)return new Set(map.textures.flatMap((tex,index)=>bspEditableTextureName(tex.name)&&tex.width>=16&&tex.height>=16&&tex.width<=4096&&tex.height<=4096?[index]:[]));
   try{return new Set(bspAllowedFaceTextureIndices(map,selectedFaces))}catch{return new Set<number>()}
 },[map.textures,selectedFaces]);
 const assetByName=useMemo(()=>new Map(assets.map(asset=>[asset.name.toUpperCase(),asset])),[assets]);
 const options=useMemo(()=>map.textures.map((texture,index)=>({texture,index,asset:assetByName.get(texture.name.toUpperCase())})),[map.textures,assetByName]);
 const wads=useMemo(()=>[...new Set(options.filter(item=>eligible.has(item.index)&&item.asset).map(item=>item.asset!.wad))].sort(),[options,eligible]);
 useEffect(()=>{if(wadFilter&&wadFilter!=='BSP'&&!wads.includes(wadFilter))setWadFilter('')},[wadFilter,wads]);
 const matches=options.filter(item=>eligible.has(item.index)&&item.texture.name.toLowerCase().includes(query.toLowerCase())&&(!wadFilter||(wadFilter==='BSP'?!item.asset:item.asset?.wad===wadFilter))).slice(0,96);
 const chosen=textureIndex>=0?map.textures[textureIndex]:current?map.textures[current.texture]:undefined;
 const chosenAsset=chosen?assets.find(a=>a.name.toUpperCase()===chosen.name.toUpperCase()):undefined;
 const numeric=(text:string,value:number,change:(v:number)=>void,step:number,disabled=false)=><label className="texture-studio-number"><span>{text}</span><input type="number" step={step} disabled={!selectedFaces.length||disabled} value={value} onChange={e=>change(Number(e.target.value))}/></label>;
 const currentOp=():BspSurfaceOperation=>({texture:textureIndex,offsetU,offsetV,rotation,scaleU,scaleV});
 const reset=()=>{setOffsetU(0);setOffsetV(0);setRotation(0);setScaleU(1);setScaleV(1);setTextureIndex(-1)};
 const apply=(op:BspSurfaceOperation)=>{if(onApply(op))reset()};
 const activeSelection=selectedFaces.length>0;
 return visible?<>
 {panelOpen&&createPortal(<div className="texture-studio-panel texture-studio-floating bsp-texture-studio-panel" style={{left:panel.pos.x,top:panel.pos.y,maxHeight:`calc(100dvh - ${Math.max(0,panel.pos.y+10)}px)`}} onPointerDown={e=>e.stopPropagation()}>
  <div className="texture-studio-head" onPointerDown={panel.start} onPointerMove={panel.move} onPointerUp={panel.end} onPointerCancel={panel.end} onLostPointerCapture={panel.end}><Grip size={14}/><strong>Texture Studio</strong><small>BSP 6D</small><button type="button" onClick={()=>setPanelOpen(false)} title={t.close}><X size={15}/></button></div>
  <div className="texture-studio-body">
   <div className="texture-studio-subtitle"><span>{selectedFaces.length} {t.faces}</span><span>{current?`BSP #${bspOriginalFaceIndex(current,map.faces.indexOf(current))}`:'—'}</span></div>
   <div className="texture-studio-preview"><div className="texture-studio-thumbnail">{chosen&&(chosenAsset?.thumbUrl||chosenAsset?.dataUrl||chosen.rgba)?<img src={chosenAsset?.thumbUrl||chosenAsset?.dataUrl||imageForBspTex(chosen.rgba,chosen.width,chosen.height)} alt={chosen.name}/>:null}</div><div><b>{chosen?.name||'—'}</b><small>{chosen?`${chosen.width} × ${chosen.height} px · ${chosenAsset?.wad||'BSP'}`:t.choose}</small><button onClick={()=>setLibraryOpen(true)}><Grid3x3 size={13}/>{t.library}</button></div></div>
   <div className="texture-studio-toolbar"><span className="bsp-texture-mode-label">{t.mode}</span><button onClick={()=>setLibraryOpen(true)}>{t.library}</button><button onClick={onClear}>{t.clear}</button></div>
   <div className="texture-studio-fields"><b>{t.shift}</b><div className="texture-studio-pair">{numeric('U',offsetU,setOffsetU,1)}{numeric('V',offsetV,setOffsetV,1)}</div><b>{t.scale}</b><div className="texture-studio-pair">{numeric('U',scaleU,v=>{setScaleU(v);if(linked)setScaleV(v)},.01)}{numeric('V',scaleV,v=>{setScaleV(v);if(linked)setScaleU(v)},.01)}</div><label className="texture-studio-check"><input type="checkbox" checked={linked} onChange={e=>setLinked(e.target.checked)}/>{t.link}</label>{numeric(t.rotation,rotation,setRotation,1)}</div>
   <div className="texture-studio-row"><button disabled={!activeSelection||selectedFaces.length!==1} onClick={()=>{
     if(!current||!chosen)return;
     const minU=Math.min(...current.texels.map(uv=>uv[0])),maxU=Math.max(...current.texels.map(uv=>uv[0]));
     const minV=Math.min(...current.texels.map(uv=>uv[1])),maxV=Math.max(...current.texels.map(uv=>uv[1]));
     apply({...currentOp(),offsetU:chosen.width/2-(minU+maxU)/2,offsetV:chosen.height/2-(minV+maxV)/2});
   }}>{t.center}</button><button disabled={!activeSelection} onClick={()=>apply({...currentOp(),scaleU:-1})}>{t.flipU}</button><button disabled={!activeSelection} onClick={()=>apply({...currentOp(),scaleV:-1})}>{t.flipV}</button></div>
   <div className="texture-studio-rule"/><b>{t.repeat}</b>
   <div className="texture-studio-pair"><label>U<input type="number" min="0.125" max="32" value={tilesU} step=".125" onChange={event=>setTilesU(Number(event.target.value))}/></label><label>V<input type="number" min="0.125" max="32" value={tilesV} step=".125" onChange={event=>setTilesV(Number(event.target.value))}/></label></div>
   <div className="texture-studio-row"><button className="texture-primary" disabled={!activeSelection||selectedFaces.length!==1||!chosen} onClick={()=>{
      if(!current||!chosen||!tilesU||!tilesV)return;
      const us=current.texels.map(uv=>uv[0]),vs=current.texels.map(uv=>uv[1]);
      const width=Math.max(...us)-Math.min(...us),height=Math.max(...vs)-Math.min(...vs);
      if(width>0&&height>0)apply({...currentOp(),scaleU:width/(chosen.width*tilesU),scaleV:height/(chosen.height*tilesV)});
   }}>{t.fit}</button></div>
   <div className="texture-studio-row"><button disabled={!activeSelection} onClick={reset}>{t.reset}</button><button disabled={!activeSelection} onClick={()=>setClipboard(currentOp())}><Copy size={13}/>{t.copy}</button><button disabled={!clipboard||!activeSelection} onClick={()=>clipboard&&apply(clipboard)}>{t.paste}</button></div>
   <div className="texture-studio-row"><button disabled={!canUndo} onClick={onUndo}><Undo2 size={13}/>{t.undo}</button><button disabled={!canRedo} onClick={onRedo}><Redo2 size={13}/>{t.redo}</button></div>
   <div className="texture-studio-rule"/><b>{t.preset}</b>
   <div className="texture-studio-row"><input aria-label={t.presetName} maxLength={45} value={presetName} placeholder={t.presetName} onChange={event=>setPresetName(event.target.value)}/><button disabled={!activeSelection||!presetName.trim()} title={t.presetSave} onClick={()=>{
    const name=presetName.trim();if(!name)return;
    commitPresets([{name,textureName:textureIndex>=0?(chosen?.name||''):'',op:currentOp()},...presets.filter(p=>p.name!==name)]);setPresetSelection(name);setPresetName('');
   }}><Save size={13}/>{t.presetSave}</button></div>
   <div className="texture-studio-row"><select aria-label={t.preset} value={presetSelection} onChange={event=>setPresetSelection(event.target.value)}><option value="">{t.preset} ({presets.length})</option>{presets.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select>
    <button disabled={!activeSelection||!presetSelection} onClick={()=>{
      const preset=presets.find(p=>p.name===presetSelection);if(!preset)return;
      const index=preset.textureName?map.textures.findIndex(tex=>tex.name.toUpperCase()===preset.textureName.toUpperCase()):-1;
      // A preset cannot silently replace a material with a different texture.
      if(preset.textureName&&index<0)return;
      apply({...preset.op,texture:index});
    }}>{t.apply}</button>
    <button disabled={!presetSelection} title={t.presetDelete} onClick={()=>{commitPresets(presets.filter(p=>p.name!==presetSelection));setPresetSelection('')}}><Trash2 size={13}/></button></div>

   <div className="texture-studio-row"><button className="texture-primary" disabled={!activeSelection} onClick={()=>apply(currentOp())}><Save size={13}/>{t.apply}</button></div>
   <p className="texture-studio-hint">{lit?t.offset:t.unlit}</p><p className="texture-studio-hint">{t.alt}</p><p className="texture-studio-hint">{t.warning}</p><p className="texture-studio-hint">{t.export}</p>
   {error&&<div className="texture-studio-error" role="alert">{error}</div>}{notice&&<div className="bsp-edit-notice" role="status">{notice}</div>}
  </div></div>,portal)}
 {libraryOpen&&createPortal(<div className="texture-studio-panel texture-studio-floating bsp-wad-library-panel" style={{left:library.pos.x,top:library.pos.y,maxHeight:`calc(100dvh - ${Math.max(0,library.pos.y+10)}px)`}} onPointerDown={e=>e.stopPropagation()}>
  <div className="texture-studio-head" onPointerDown={library.start} onPointerMove={library.move} onPointerUp={library.end} onPointerCancel={library.end} onLostPointerCapture={library.end}><Grip size={14}/><strong>{t.library}</strong><small>{eligible.size} {t.count}</small><button type="button" title={t.close} onClick={()=>setLibraryOpen(false)}><X size={15}/></button></div>
  <div className="texture-studio-body"><div className="texture-studio-row"><Search size={14}/><input aria-label={t.search} value={query} placeholder={t.search} onChange={e=>setQuery(e.target.value)}/></div>
   <div className="texture-studio-row"><select aria-label="WAD" value={wadFilter} onChange={e=>setWadFilter(e.target.value)}><option value="">{t.all}</option><option value="BSP">{t.embedded}</option>{wads.map(wad=><option key={wad} value={wad}>{wad}</option>)}</select></div>
   <div className="texture-studio-row"><button disabled={importing} onClick={onImportWad}><FileUp size={14}/>{t.import}</button></div>
   {importedWads.length>0&&<details className="bsp-imported-wads"><summary>{t.importedWads} ({importedWads.length})</summary>
    <small className="texture-studio-hint">{t.removeHint}</small>
    {importedWads.map(wad=><div className="bsp-imported-wad-row" key={wad}>
      <span title={wad}>{wad}</span>
      <button type="button" disabled={importing} title={`${t.removeWad}: ${wad}`} aria-label={`${t.removeWad}: ${wad}`} onClick={()=>onRemoveImportedWad(wad)}><Trash2 size={13}/>{t.removeWad}</button>
    </div>)}
   </details>}
   {error&&<div className="texture-studio-error" role="alert">{error}</div>}
   <div className="bsp-texture-library-grid">{matches.map(({texture,index,asset})=><button type="button" key={index} className={textureIndex===index?'selected':''} onClick={()=>{setTextureIndex(index);setPanelOpen(true)}} title={`${texture.name} · ${texture.width}×${texture.height}`}>
     <span className="bsp-texture-library-thumb">{asset?.thumbUrl||asset?.dataUrl||texture.rgba?<img loading="lazy" src={asset?.thumbUrl||asset?.dataUrl||imageForBspTex(texture.rgba,texture.width,texture.height)} alt=""/>:null}</span><span>{texture.name}</span>
    </button>)}</div>
   <small className="texture-studio-hint">{matches.length} / {eligible.size} {t.count}</small>
  </div></div>,portal)}
 {!panelOpen&&<button className="bsp-studio-reopen" type="button" onClick={()=>setPanelOpen(true)}>Texture Studio</button>}
 </>:null;
}
/** Same native 120px fixed-screen widget as MAP Studio: drag tab moves its
 * screen coordinates; handles edit UV. No camera or face selection can reposition it. */
export function BspTextureUVWidget({visible,lit,locale,onBegin,onMove,onFinish}:{visible:boolean;lit:boolean;locale:keyof typeof STR;onBegin:()=>void;onMove:(handle:UvHandle,dx:number,dy:number,keepRatio:boolean)=>void;onFinish:(commit:boolean)=>void}){
 const t=STR[locale]||STR.en,root=useRef<HTMLDivElement>(null),savedKey='svenstudio:bsp-uv-widget-position-v1';
 const [position,setPosition]=useState<ScreenPoint|null>(()=>{try{const p=JSON.parse(localStorage.getItem(savedKey)||'null');return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?p:null}catch{return null}});
 const pinned=useRef<ScreenPoint|null>(position),widgetDrag=useRef<{id:number;x:number;y:number;left:number;top:number}|null>(null),gesture=useRef<{id:number;x:number;y:number;handle:UvHandle}|null>(null);
 const setPinned=(p:ScreenPoint)=>{pinned.current=p;setPosition(p)};
 const save=()=>{if(pinned.current)try{localStorage.setItem(savedKey,JSON.stringify(pinned.current))}catch{}};
 const finishRef=useRef(onFinish);finishRef.current=onFinish;
 useEffect(()=>{
   const stop=(event:PointerEvent)=>{
     if(widgetDrag.current?.id===event.pointerId){widgetDrag.current=null;
       if(pinned.current)try{localStorage.setItem(savedKey,JSON.stringify(pinned.current))}catch{}}
     if(gesture.current?.id===event.pointerId){gesture.current=null;finishRef.current(event.type==='pointerup')}
   };
   const blur=()=>{widgetDrag.current=null;
     if(gesture.current){gesture.current=null;finishRef.current(false)}};
   window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);
   window.addEventListener('blur',blur);
   return ()=>{window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);window.removeEventListener('blur',blur)};
 },[]);
 useEffect(()=>{const onPin=(event:Event)=>{const detail=(event as CustomEvent<ScreenPoint>).detail;if(!detail||pinned.current||!root.current)return;const rect=root.current.getBoundingClientRect(),next=pinUvAnchor(detail,rect,root.current.clientWidth,root.current.clientHeight);if(next)setPinned(clampUvWidgetPosition(next,root.current.clientWidth,root.current.clientHeight))};document.addEventListener('svenstudio:bsp-uv-pin',onPin);return()=>document.removeEventListener('svenstudio:bsp-uv-pin',onPin)},[]);
 useEffect(()=>{const element=root.current;if(!element)return;const update=()=>{if(!pinned.current&&visible)setPinned(clampUvWidgetPosition({x:element.clientWidth/2,y:element.clientHeight/2},element.clientWidth,element.clientHeight));else if(pinned.current&&!widgetDrag.current){const next=clampUvWidgetPosition(pinned.current,element.clientWidth,element.clientHeight);if(next.x!==pinned.current.x||next.y!==pinned.current.y){setPinned(next);save()}}};update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect()},[visible]);
 useEffect(()=>{const esc=(event:KeyboardEvent)=>{if(event.key==='Escape'&&gesture.current){gesture.current=null;onFinish(false)}};window.addEventListener('keydown',esc,true);return()=>window.removeEventListener('keydown',esc,true)},[onFinish]);
 const beginWidget=(event:ReactPointerEvent<HTMLDivElement>)=>{if(event.button!==0||!root.current)return;event.preventDefault();event.stopPropagation();const p=pinned.current||{x:root.current.clientWidth/2,y:root.current.clientHeight/2};widgetDrag.current={id:event.pointerId,x:event.clientX,y:event.clientY,left:p.x,top:p.y};event.currentTarget.setPointerCapture(event.pointerId)};
 const moveWidget=(event:ReactPointerEvent<HTMLDivElement>)=>{const d=widgetDrag.current;if(!d||d.id!==event.pointerId||!root.current)return;event.preventDefault();event.stopPropagation();const rect=root.current.getBoundingClientRect();setPinned(clampUvWidgetPosition({x:d.left+(event.clientX-d.x)*root.current.clientWidth/Math.max(rect.width,1),y:d.top+(event.clientY-d.y)*root.current.clientHeight/Math.max(rect.height,1)},root.current.clientWidth,root.current.clientHeight))};
 const endWidget=(event:ReactPointerEvent<HTMLDivElement>)=>{if(!widgetDrag.current||widgetDrag.current.id!==event.pointerId)return;event.stopPropagation();widgetDrag.current=null;save();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)};
 const down=(event:ReactPointerEvent<HTMLButtonElement>,handle:UvHandle)=>{if(event.button!==0||lit&&handle!=='move')return;event.stopPropagation();event.preventDefault();gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,handle};onBegin();event.currentTarget.setPointerCapture(event.pointerId)};
 const move=(event:ReactPointerEvent<HTMLButtonElement>)=>{const d=gesture.current;if(!d||d.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();onMove(d.handle,event.clientX-d.x,event.clientY-d.y,event.shiftKey)};
 const end=(event:ReactPointerEvent<HTMLButtonElement>,commit:boolean)=>{const d=gesture.current;if(!d||d.id!==event.pointerId)return;event.stopPropagation();gesture.current=null;onFinish(commit);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)};
 const handles:UvHandle[]=['nw','n','ne','e','se','s','sw','w','move','rotate'];
 return <div ref={root} className="bsp-texture-uv-screen-overlay texture-uv-screen-overlay" data-screen-fixed="true" aria-label="BSP UV screen overlay">
  {visible&&position&&<div className="texture-uv-handles" style={{display:'block',left:position.x,top:position.y}} aria-label="BSP UV controls">
   <span className="texture-uv-guide"/><span className="texture-uv-tag">UV</span>
   <div className="texture-uv-drag-header" role="button" tabIndex={0} title={t.drag} onPointerDown={beginWidget} onPointerMove={moveWidget} onPointerUp={endWidget} onPointerCancel={endWidget} onLostPointerCapture={endWidget}>↕ {t.drag}</div>
   {handles.map(handle=><button key={handle} type="button" className={`texture-uv-handle texture-uv-${handle}`} aria-label={`UV ${handle}`} title={lit&&handle!=='move'?t.warning:`UV ${handle}`} disabled={lit&&handle!=='move'} onPointerDown={event=>down(event,handle)} onPointerMove={move} onPointerUp={event=>end(event,true)} onPointerCancel={event=>end(event,false)} onLostPointerCapture={event=>end(event,false)}/>)}
  </div>}
 </div>;
}
