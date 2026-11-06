import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {Html} from '@react-three/drei';
import {useFrame,useThree} from '@react-three/fiber';
import {Grip, X, Link2, Copy, Save, Trash2, Crosshair, Pipette, FlipHorizontal2, FlipVertical2} from 'lucide-react';
import {useEditor,textureStudioTargets} from '../store';
import {gameToThree} from '../engine/geometry';
import {brushWorldVertices,type UvHandle} from '../engine/textureStudio';
import type {Brush} from '../engine/types';

const translations={
  es:{title:'Texture Studio',face:'Cara',faces:'caras',none:'Seleccioná una cara o uno o varios brushes.',mode:'Modo Caras',all:'Todas las caras',clear:'Limpiar caras',texture:'Textura',offset:'Desplazamiento',scale:'Escala',rotate:'Rotación',linked:'Mantener proporciones',fit:'Ajustar a cara',align:'Alinear con primera',repeat:'Repeticiones',repeatU:'Horizontal',repeatV:'Vertical',copy:'Copiar material',paste:'Pegar material',picker:'Cuentagotas',center:'Centrar',reset:'Restablecer UV',flipU:'Invertir U',flipV:'Invertir V',preset:'Presets',name:'Nombre del preset',save:'Guardar',apply:'Aplicar',delete:'Eliminar',hint:'Doble clic en una cara para abrir · Shift + clic agrega caras · Arrastrá los ocho controles sobre la superficie.', warning:'El MAP usa los ejes UV de Valve 220. Modificar UV no cambia los brushes.',preview:'Vista previa WAD',unavailable:'Textura sin imagen cargada',close:'Cerrar',error:'Error',total:'Superficies seleccionadas',single:'Cara activa',small:'Pequeño',large:'Grande'},
  en:{title:'Texture Studio',face:'Face',faces:'faces',none:'Select a face or one or more brushes.',mode:'Face mode',all:'All faces',clear:'Clear faces',texture:'Texture',offset:'Offset',scale:'Scale',rotate:'Rotation',linked:'Link scale',fit:'Fit to face',align:'Align to first',repeat:'Tiles',repeatU:'Horizontal',repeatV:'Vertical',copy:'Copy material',paste:'Paste material',picker:'Eyedropper',center:'Center',reset:'Reset UV',flipU:'Flip U',flipV:'Flip V',preset:'Presets',name:'Preset name',save:'Save',apply:'Apply',delete:'Remove',hint:'Double-click a face to open · Shift-click adds faces · Drag the eight handles on the surface.',warning:'MAP uses Valve 220 UV axes. UV edits never change brush geometry.',preview:'WAD preview',unavailable:'No loaded texture image',close:'Close',error:'Error',total:'Selected surfaces',single:'Active face',small:'Small',large:'Large'},
  ru:{title:'Texture Studio',face:'Грань',faces:'граней',none:'Выберите грань или несколько брашей.',mode:'Режим граней',all:'Все грани',clear:'Сбросить',texture:'Текстура',offset:'Смещение',scale:'Масштаб',rotate:'Поворот',linked:'Связать масштаб',fit:'Подогнать',align:'Выровнять по первой',repeat:'Повторения',repeatU:'По горизонтали',repeatV:'По вертикали',copy:'Копировать',paste:'Вставить',picker:'Пипетка',center:'Центрировать',reset:'Сбросить UV',flipU:'Отразить U',flipV:'Отразить V',preset:'Шаблоны',name:'Имя шаблона',save:'Сохранить',apply:'Применить',delete:'Удалить',hint:'Двойной клик по грани · Shift+клик — несколько граней · 8 маркеров для UV.',warning:'UV соответствует Valve 220; геометрия не меняется.',preview:'Просмотр WAD',unavailable:'Изображение не загружено',close:'Закрыть',error:'Ошибка',total:'Выбранные грани',single:'Активная грань',small:'Малое',large:'Большое'},
  ko:{title:'Texture Studio',face:'면',faces:'면',none:'면이나 브러시를 선택하세요.',mode:'면 모드',all:'모든 면',clear:'선택 해제',texture:'텍스처',offset:'이동',scale:'크기',rotate:'회전',linked:'비율 유지',fit:'면에 맞춤',align:'첫 면에 정렬',repeat:'반복',repeatU:'가로',repeatV:'세로',copy:'복사',paste:'붙여넣기',picker:'스포이트',center:'중앙',reset:'UV 초기화',flipU:'U 뒤집기',flipV:'V 뒤집기',preset:'프리셋',name:'프리셋 이름',save:'저장',apply:'적용',delete:'삭제',hint:'면 더블 클릭 · Shift+클릭 다중 선택 · 표면의 8개 핸들을 드래그하세요.',warning:'Valve 220 UV만 수정하며 브러시 형상은 유지됩니다.',preview:'WAD 미리보기',unavailable:'텍스처 이미지 없음',close:'닫기',error:'오류',total:'선택한 면',single:'활성 면',small:'작게',large:'크게'},
  zh:{title:'Texture Studio',face:'面',faces:'个面',none:'请选择一个面或多个笔刷。',mode:'面模式',all:'所有面',clear:'清除选择',texture:'纹理',offset:'偏移',scale:'缩放',rotate:'旋转',linked:'保持比例',fit:'适应面',align:'对齐第一个面',repeat:'重复',repeatU:'水平',repeatV:'垂直',copy:'复制材质',paste:'粘贴材质',picker:'吸管',center:'居中',reset:'重置 UV',flipU:'翻转 U',flipV:'翻转 V',preset:'预设',name:'预设名称',save:'保存',apply:'应用',delete:'删除',hint:'双击面打开 · Shift+单击多选 · 拖动表面的八个控制点。',warning:'仅修改 Valve 220 UV，不修改笔刷几何。',preview:'WAD 预览',unavailable:'未加载纹理图像',close:'关闭',error:'错误',total:'选中的面',single:'当前面',small:'小',large:'大'},
  pt:{title:'Texture Studio',face:'Face',faces:'faces',none:'Selecione uma face ou um ou mais brushes.',mode:'Modo de faces',all:'Todas as faces',clear:'Limpar seleção',texture:'Textura',offset:'Deslocamento',scale:'Escala',rotate:'Rotação',linked:'Manter proporção',fit:'Ajustar à face',align:'Alinhar pela primeira',repeat:'Repetições',repeatU:'Horizontal',repeatV:'Vertical',copy:'Copiar material',paste:'Colar material',picker:'Conta-gotas',center:'Centralizar',reset:'Redefinir UV',flipU:'Inverter U',flipV:'Inverter V',preset:'Predefinições',name:'Nome da predefinição',save:'Salvar',apply:'Aplicar',delete:'Excluir',hint:'Clique duplo na face · Shift+clique para várias faces · Arraste oito controles na superfície.',warning:'Ajustes UV Valve 220 não alteram a geometria.',preview:'Prévia WAD',unavailable:'Imagem não carregada',close:'Fechar',error:'Erro',total:'Faces selecionadas',single:'Face ativa',small:'Pequeno',large:'Grande'},
} as const;
function useStrings(){const locale=useEditor(s=>s.locale);return translations[locale]||translations.en}
const num=(v:number)=>Number.isFinite(v)?Number(v.toFixed(4)):0;
const DEFAULT_POSITION={x:20,y:155};
function readPosition(){try{const p=JSON.parse(localStorage.getItem('svenstudio:texture-panel-pos')||'{}');return {x:Number.isFinite(p.x)?p.x:DEFAULT_POSITION.x,y:Number.isFinite(p.y)?p.y:DEFAULT_POSITION.y}}catch{return DEFAULT_POSITION}}

export function TextureStudioPanel(){
  const t=useStrings();
  const open=useEditor(s=>s.textureStudioOpen),setOpen=useEditor(s=>s.setTextureStudioOpen);
  const objects=useEditor(s=>s.project.objects),selected=useEditor(s=>s.selected),selectedIds=useEditor(s=>s.selectedIds),selectedFace=useEditor(s=>s.selectedFace),faceMode=useEditor(s=>s.faceMode),selectedFaces=useEditor(s=>s.textureFaceSelection);
  const setGeometryMode=useEditor(s=>s.setGeometryMode),selectAll=useEditor(s=>s.selectAllTextureFaces),clear=useEditor(s=>s.clearTextureFaces);
  const patch=useEditor(s=>s.applyTextureStudioPatch),fit=useEditor(s=>s.fitTextureStudio),align=useEditor(s=>s.alignTextureStudio),center=useEditor(s=>s.centerTextureStudio),flip=useEditor(s=>s.flipTextureStudio);
  const copy=useEditor(s=>s.copyFaceSettings),clipboard=useEditor(s=>s.faceClipboard);
  const picker=useEditor(s=>s.texturePickerActive),setPicker=useEditor(s=>s.setTexturePickerActive);
  const presets=useEditor(s=>s.texturePresets),savePreset=useEditor(s=>s.saveTexturePreset),removePreset=useEditor(s=>s.removeTexturePreset),applyPreset=useEditor(s=>s.applyTexturePreset);
  const assets=useEditor(s=>s.textureAssets),targets=useMemo(()=>textureStudioTargets({project:{objects} as never,selected,selectedIds,selectedFace,faceMode,textureFaceSelection:selectedFaces}),[objects,selected,selectedIds,selectedFace,faceMode,selectedFaces]);
  const first=targets[0],brush=objects.find(o=>o.id===first?.id) as Brush|undefined,face=brush&&first?brush.faces[first.face]:undefined;
  const asset=face?assets.find(a=>a.name.toUpperCase()===face.texture.toUpperCase()):undefined;
  const [tilesU,setTilesU]=useState(1),[tilesV,setTilesV]=useState(1),[linked,setLinked]=useState(false),[name,setName]=useState(''),[chosen,setChosen]=useState(''),[error,setError]=useState('');
  const [pos,setPos]=useState(readPosition);const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);const panelRef=useRef<HTMLDivElement>(null);const pendingOpen=useRef<{x:number;y:number}|null>(null);
  const run=(fn:()=>void)=>{try{fn();setError('')}catch(e){setError(`${t.error}: ${String(e)}`)}};
  useEffect(()=>{const handle=(e:Event)=>{
    const detail=(e as CustomEvent<{x:number;y:number}>).detail;const frame=panelRef.current?.parentElement?.getBoundingClientRect();if(!detail)return;if(!frame){pendingOpen.current=detail;return;}
    setPos({x:Math.min(Math.max(8,detail.x-frame.left+15),Math.max(8,frame.width-345)),y:Math.min(Math.max(8,detail.y-frame.top+15),Math.max(8,frame.height-400))});
  };document.addEventListener('svenstudio:texture-open',handle);return()=>document.removeEventListener('svenstudio:texture-open',handle)},[]);
  useEffect(()=>{
    if(!open||!pendingOpen.current)return;
    const detail=pendingOpen.current;pendingOpen.current=null;
    const frame=panelRef.current?.parentElement?.getBoundingClientRect();if(!frame)return;
    setPos({x:Math.min(Math.max(8,detail.x-frame.left+15),Math.max(8,frame.width-345)),y:Math.min(Math.max(8,detail.y-frame.top+15),Math.max(8,frame.height-400))});
  },[open]);
  const startDrag=(e:ReactPointerEvent)=>{if((e.target as HTMLElement).closest('button'))return;e.stopPropagation();drag.current={x:e.clientX,y:e.clientY,left:pos.x,top:pos.y};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)};
  const moveDrag=(e:ReactPointerEvent)=>{if(!drag.current)return;e.stopPropagation();const frame=panelRef.current?.parentElement?.getBoundingClientRect();const x=drag.current.left+e.clientX-drag.current.x,y=drag.current.top+e.clientY-drag.current.y;setPos({x:Math.max(0,Math.min(x,(frame?.width||1200)-120)),y:Math.max(0,Math.min(y,(frame?.height||800)-50))})};
  const stopDrag=()=>{if(!drag.current)return;drag.current=null;try{localStorage.setItem('svenstudio:texture-panel-pos',JSON.stringify(pos))}catch{}};
  const numeric=(key:'uShift'|'vShift'|'uScale'|'vScale'|'rotation',label:string,step:number)=>
    <label className="texture-studio-number"><span>{label}</span><input type="number" step={step} value={num(face?.[key]??(key.includes('Scale')?1:0))} disabled={!face} onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value))run(()=>patch(linked&&face&&(key==='uScale'||key==='vScale')?{uScale:key==='uScale'?value:(face.uScale??1)*(value/(face.vScale??1)),vScale:key==='vScale'?value:(face.vScale??1)*(value/(face.uScale??1))}:{[key]:value}))}} /></label>;
  return open?<div ref={panelRef} className="texture-studio-panel" style={{left:pos.x,top:pos.y}} onPointerDown={e=>e.stopPropagation()}>
    <div className="texture-studio-head" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}><Grip size={14}/><strong>{t.title}</strong><small>v1.4</small><button type="button" aria-label={t.close} onClick={()=>setOpen(false)}><X size={15}/></button></div>
    <div className="texture-studio-body">
      <div className="texture-studio-subtitle"><span>{targets.length} {t.faces}</span><span>{face?`${brush?.name} #${first.face+1}`:t.none}</span></div>
      <div className="texture-studio-preview"><div className="texture-studio-thumbnail">{asset?.dataUrl?<img src={asset.thumbUrl||asset.dataUrl} alt={face?.texture}/>:<span>{t.unavailable}</span>}</div><div><b>{face?.texture||'—'}</b><small>{asset?`${asset.width} × ${asset.height} px · ${asset.wad}`:t.preview}</small><input aria-label={t.texture} disabled={!face} value={face?.texture||''} onChange={e=>run(()=>patch({texture:e.target.value||'NULL'}))}/></div></div>
      <div className="texture-studio-toolbar"><button onClick={()=>setGeometryMode('face')}>{t.mode}</button><button onClick={selectAll} disabled={!selectedIds.length}>{t.all}</button><button onClick={clear}>{t.clear}</button></div>
      <div className="texture-studio-fields"><b>{t.offset} (U/V)</b><div className="texture-studio-pair">{numeric('uShift','U',1)}{numeric('vShift','V',1)}</div><b>{t.scale} (U/V)</b><div className="texture-studio-pair">{numeric('uScale','U',.01)}{numeric('vScale','V',.01)}</div><label className="texture-studio-check"><input type="checkbox" checked={linked} onChange={e=>setLinked(e.target.checked)}/>{t.linked}</label>{numeric('rotation',`${t.rotate} °`,1)}</div>
      <div className="texture-studio-row"><button disabled={!face} onClick={()=>run(center)}>{t.center}</button><button disabled={!face} onClick={()=>run(()=>patch({uShift:0,vShift:0,uScale:1,vScale:1,rotation:0,uAxis:undefined,vAxis:undefined}))}>{t.reset}</button><button disabled={!face} onClick={()=>run(()=>flip('u'))}><FlipHorizontal2 size={13}/>{t.flipU}</button><button disabled={!face} onClick={()=>run(()=>flip('v'))}><FlipVertical2 size={13}/>{t.flipV}</button></div>
      <div className="texture-studio-rule"/>
      <b>{t.repeat}</b><div className="texture-studio-pair"><label>{t.repeatU}<input type="number" min="0.05" max="4096" step="1" value={tilesU} onChange={e=>setTilesU(Number(e.target.value))}/></label><label>{t.repeatV}<input type="number" min="0.05" max="4096" step="1" value={tilesV} onChange={e=>setTilesV(Number(e.target.value))}/></label></div>
      <div className="texture-studio-row"><button className="texture-primary" disabled={!face} onClick={()=>run(()=>fit(tilesU,tilesV))}><Crosshair size={13}/>{t.fit}</button><button disabled={targets.length<2} onClick={()=>run(align)}><Link2 size={13}/>{t.align}</button></div>
      <div className="texture-studio-row"><button disabled={!face} onClick={()=>run(()=>copy(first.id,first.face))}><Copy size={13}/>{t.copy}</button><button disabled={!face||!clipboard} onClick={()=>run(()=>patch(clipboard||{}))}>{t.paste}</button><button className={picker?'texture-primary':''} disabled={!face} onClick={()=>setPicker(!picker)} title={t.picker}><Pipette size={13}/>{t.picker}</button></div>
      <div className="texture-studio-rule"/><b>{t.preset}</b>
      <div className="texture-studio-row"><input placeholder={t.name} value={name} onChange={e=>setName(e.target.value)}/><button disabled={!face||!name.trim()} onClick={()=>run(()=>{savePreset(name);setName('')})}><Save size={14}/>{t.save}</button></div>
      <div className="texture-studio-row"><select aria-label={t.preset} value={chosen} onChange={e=>setChosen(e.target.value)}><option value="">{t.preset} ({presets.length})</option>{presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button disabled={!chosen||!face} onClick={()=>run(()=>applyPreset(chosen))}>{t.apply}</button><button disabled={!chosen} title={t.delete} onClick={()=>run(()=>{removePreset(chosen);setChosen('')})}><Trash2 size={14}/></button></div>
      {linked&&face&&<button className="texture-studio-link-scale" onClick={()=>run(()=>patch({vScale:face.uScale??1}))}>{t.linked}: U → V</button>}
      {error&&<div className="texture-studio-error" role="alert">{error}</div>}
      <p className="texture-studio-hint">{t.hint}</p><p className="texture-studio-hint">{t.warning}</p>
    </div>
  </div>:null;
}

/** One HTML overlay for the active face, not one per brush. Only updates while visible. */
export function TextureUVHandles(){
  const open=useEditor(s=>s.textureStudioOpen),walk=useEditor(s=>s.walkMode),faceMode=useEditor(s=>s.faceMode);
  const objects=useEditor(s=>s.project.objects),selected=useEditor(s=>s.selected),selectedFace=useEditor(s=>s.selectedFace),multi=useEditor(s=>s.textureFaceSelection);
  const begin=useEditor(s=>s.beginTextureStudioGesture),update=useEditor(s=>s.updateTextureStudioGesture),finish=useEditor(s=>s.finishTextureDrag);
  const {camera,size}=useThree();const frame=useRef<HTMLDivElement>(null),poly=useRef<SVGPolygonElement>(null),last=useRef('');
  const active=multi.at(-1)||((selected&&selectedFace!==null)?{id:selected,face:selectedFace}:null);
  const brush=objects.find(o=>o.id===active?.id),face=brush?.kind==='brush'?brush.faces[active!.face]:null;
  const points=useMemo(()=>{if(brush?.kind!=='brush'||!face)return [];const world=brushWorldVertices(brush);return face.indices.map(i=>gameToThree(world[i]))},[brush,face]);
  const drag=useRef<{x:number;y:number;handle:UvHandle}|null>(null);
  useFrame(()=>{
    const box=frame.current;if(!box||!poly.current||!points.length)return;
    const projected=points.map(p=>p.clone().project(camera));
    if(projected.every(p=>p.z>1)||projected.every(p=>p.z< -1)){box.style.display='none';last.current='';return}
    const xs=projected.map(p=>(p.x+1)*size.width/2),ys=projected.map(p=>(1-p.y)*size.height/2);
    const rawLeft=Math.min(...xs),rawTop=Math.min(...ys),rawWidth=Math.max(...xs)-rawLeft,rawHeight=Math.max(...ys)-rawTop;
    const width=Math.max(36,rawWidth),height=Math.max(36,rawHeight);
    const left=rawLeft-(width-rawWidth)/2,top=rawTop-(height-rawHeight)/2;
    if(![left,top,width,height].every(Number.isFinite)||left>size.width||top>size.height||left+width<0||top+height<0){box.style.display='none';last.current='';return}
    const signature=[left,top,width,height,...xs,...ys].map(n=>Math.round(n*2)/2).join(':');if(signature===last.current)return;last.current=signature;
    box.style.display='block';box.style.left=`${left}px`;box.style.top=`${top}px`;box.style.width=`${width}px`;box.style.height=`${height}px`;
    if(poly.current)poly.current.setAttribute('points',xs.map((x,i)=>`${x-left},${ys[i]-top}`).join(' '));
  });
  useEffect(()=>{if(!drag.current)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){finish(false);drag.current=null}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true)},[finish]);
  if(!open||walk||!faceMode||!face||brush?.kind!=='brush')return null;
  const down=(e:ReactPointerEvent<HTMLButtonElement>,handle:UvHandle)=>{e.stopPropagation();e.preventDefault();if(e.button!==0)return;begin();drag.current={x:e.clientX,y:e.clientY,handle};e.currentTarget.setPointerCapture(e.pointerId)};
  const move=(e:ReactPointerEvent<HTMLButtonElement>)=>{if(!drag.current)return;e.stopPropagation();const d=drag.current;update(d.handle,e.clientX-d.x,e.clientY-d.y,e.shiftKey)};
  const up=(e:ReactPointerEvent<HTMLButtonElement>)=>{if(!drag.current)return;e.stopPropagation();drag.current=null;finish(true)};
  const handles:UvHandle[]=['nw','n','ne','e','se','s','sw','w','move','rotate'];
  return <Html fullscreen zIndexRange={[30,30]} style={{pointerEvents:'none'}}><div ref={frame} className="texture-uv-handles"><svg aria-hidden="true" className="texture-uv-polygon"><polygon ref={poly} points=""/></svg>{handles.map(h=><button type="button" aria-label={`UV ${h}`} title={`UV ${h}`} className={`texture-uv-handle texture-uv-${h}`} key={h} onPointerDown={e=>down(e,h)} onPointerMove={move} onPointerUp={up} onPointerCancel={e=>{e.stopPropagation();drag.current=null;finish(false)}}/>)}</div></Html>;
}
