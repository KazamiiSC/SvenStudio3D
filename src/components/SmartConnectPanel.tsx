import {useEffect,useMemo,useRef,useState,type PointerEvent} from 'react';
import {Canvas,useThree,type ThreeEvent} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {Check,CornerDownRight,Plus,Trash2,Undo2,Redo2,X,Route,MousePointer2,Layers3,Sparkles} from 'lucide-react';
import * as THREE from 'three';
import {useEditor} from '../store';
import {gameToThree,threeToGame,transformedVertices} from '../engine/geometry';
import {workshopFrame} from '../engine/brushWorkshop';
import type {Brush,Vec3} from '../engine/types';
import {connectionCanRegenerate,defaultConnectionFace,faceCenter,generateSmartConnection,makeConnectionRecord,newConnectionId,obstacleBoxes,suggestConnectionAlternatives,planConnectionOpenings,protectedOpeningIds,type SmartConnectOptions,type ConnectionObstacle,type ConnectionCutDraft} from '../engine/smartConnect';
import {createSmartConnectHistory,recordSmartConnectChange,undoSmartConnectChange,redoSmartConnectChange,type SmartConnectDraft,type SmartConnectHistory} from '../engine/smartConnectHistory';
import './smartConnect.css';

type Locale='es'|'en'|'ru'|'ko'|'zh'|'pt';
// HF20 HF1: the full-screen dialog cannot receive clicks on the MAP viewport.
// Temporarily swap it for a compact, nonblocking endpoint-selection guide.
const PICK_TEXT={
 es:{pick:'Elegir extremos en MAP',help:'Clic izquierdo: primer brush. Shift + clic izquierdo: segundo brush. Podés quitar uno con otro Shift + clic.',ready:'Usar estos dos brushes',cancel:'Volver sin cambiar',count:'Brushes seleccionados',first:'Origen',second:'Destino',hint:'Seleccioná exactamente dos brushes visibles y desbloqueados en el visor 3D.'},
 en:{pick:'Pick endpoints in MAP',help:'Left click: first brush. Shift + left click: second brush. Shift + click again to remove one.',ready:'Use these two brushes',cancel:'Return without changes',count:'Selected brushes',first:'Source',second:'Destination',hint:'Choose exactly two visible, unlocked brushes in the 3D viewport.'},
 ru:{pick:'Выбрать концы на карте',help:'ЛКМ: первый браш. Shift + ЛКМ: второй. Повторное Shift + ЛКМ снимает выбор.',ready:'Использовать эти браши',cancel:'Назад без изменений',count:'Выбрано брашей',first:'Начало',second:'Конец',hint:'Выберите ровно два видимых незаблокированных браша в 3D.'},
 ko:{pick:'MAP에서 끝점 선택',help:'왼쪽 클릭: 첫 브러시. Shift + 클릭: 두 번째. 다시 Shift + 클릭하면 선택 해제.',ready:'이 두 브러시 사용',cancel:'변경 없이 돌아가기',count:'선택된 브러시',first:'시작',second:'끝',hint:'3D 뷰에서 보이는 잠금 해제 브러시 두 개를 선택하세요.'},
 zh:{pick:'在 MAP 中选取端点',help:'左键单击：第一个笔刷。Shift + 左键：第二个；再次点击可取消。',ready:'使用这两个笔刷',cancel:'不更改并返回',count:'已选择的笔刷',first:'起点',second:'终点',hint:'请在 3D 视图中选择两个可见、未锁定的笔刷。'},
 pt:{pick:'Escolher extremos no MAP',help:'Clique esquerdo: primeiro brush. Shift + clique: segundo. Repita para remover.',ready:'Usar estes dois brushes',cancel:'Voltar sem alterações',count:'Brushes selecionados',first:'Origem',second:'Destino',hint:'Selecione exatamente dois brushes visíveis e desbloqueados na vista 3D.'},
} satisfies Record<Locale,{pick:string;help:string;ready:string;cancel:string;count:string;first:string;second:string;hint:string}>;
const TEXT={
 es:{title:'Smart Connect · Conexión universal',help:'Seleccioná dos brushes en el MAP y elegí sus caras en la lista o haciendo clic en la vista 3D. Arrastrá los puntos en Planta (XY) y Alzado (XZ); girá la vista 3D para comprobar.',from:'Origen',to:'Destino',face:'Cara',mode:'Recorrido',angular:'Con esquinas',smooth:'Curva suave',quality:'Calidad',clearance:'Separación (u)',auto:'Proponer ruta',straight:'Directa',add:'Añadir punto',remove:'Quitar punto',reset:'Restablecer',plan:'Planta · XY',elev:'Alzado · XZ',preview:'Vista previa 3D',texture:'Textura',create:'Crear conexión',update:'Regenerar conexión',cancel:'Cancelar',collision:'Posible colisión',confirm:'Permitir cruces',edit:'Estás editando una conexión existente. Si modificaste manualmente sus brushes, se bloqueará la regeneración.',broken:'La conexión cambió manualmente o perdió brushes. Por seguridad no se sobrescribirá; conservá los objetos originales.',none:'Elegí dos brushes visibles y desbloqueados.',detail:'Los extremos originales nunca se cortan ni se reemplazan. Las comprobaciones con cajas de colisión son aproximadas.',point:'Punto intermedio',undo:'Deshacer ajuste',empty:'No se encontraron dos extremos compatibles.',alert:'No se puede crear',apply:'Se crearon brushes GoldSrc reales en una sola operación deshacible.'},
 en:{title:'Smart Connect · Universal geometry',help:'Select two MAP brushes and choose faces in the lists or by clicking in the 3D preview. Drag waypoints in Plan (XY) and Elevation (XZ); orbit the 3D view to inspect.',from:'Source',to:'Destination',face:'Face',mode:'Route',angular:'Sharp corners',smooth:'Smooth curve',quality:'Quality',clearance:'Clearance (u)',auto:'Suggest route',straight:'Direct',add:'Add point',remove:'Remove point',reset:'Reset',plan:'Plan · XY',elev:'Elevation · XZ',preview:'3D preview',texture:'Texture',create:'Create connection',update:'Regenerate connection',cancel:'Cancel',collision:'Possible collision',confirm:'Allow intersections',edit:'Editing an existing connection. Regeneration is blocked when generated brushes were edited manually.',broken:'Generated brushes were changed or deleted. For safety the connection cannot overwrite them.',none:'Choose two unlocked, visible brushes.',detail:'Original endpoint brushes are never cut or replaced. Box collision tests are approximate.',point:'Waypoint',undo:'Undo adjustment',empty:'No compatible endpoints found.',alert:'Cannot create',apply:'Created real GoldSrc brushes in one undoable operation.'},
 ru:{title:'Smart Connect · Соединение геометрии',help:'Выберите два браша через Shift+клик, затем грани. Точки перемещаются на планах XY и XZ; проверяйте вид 3D.',from:'Начало',to:'Конец',face:'Грань',mode:'Маршрут',angular:'Углы',smooth:'Плавная кривая',quality:'Качество',clearance:'Зазор (u)',auto:'Предложить путь',straight:'Прямая',add:'Добавить точку',remove:'Убрать точку',reset:'Сбросить',plan:'План · XY',elev:'Высота · XZ',preview:'Предпросмотр 3D',texture:'Текстура',create:'Создать',update:'Перестроить',cancel:'Отмена',collision:'Возможное пересечение',confirm:'Разрешить пересечения',edit:'Редактирование связи: изменённые вручную браши не перезаписываются.',broken:'Связанные браши изменены или удалены. Перестроение заблокировано.',none:'Выберите два видимых незаблокированных браша.',detail:'Исходные браши не изменяются. Проверка препятствий приближённая.',point:'Промежуточная точка',undo:'Отменить настройку',empty:'Нет подходящих объектов.',alert:'Нельзя создать',apply:'Браши GoldSrc созданы; действие можно отменить.'},
 ko:{title:'Smart Connect · 범용 연결',help:'Shift+클릭으로 브러시 두 개와 면을 선택하세요. XY/XZ 2D에서 경로점을 끌고 3D에서 확인하세요.',from:'시작',to:'끝',face:'면',mode:'경로',angular:'각진 경로',smooth:'부드러운 곡선',quality:'품질',clearance:'여유 거리',auto:'경로 추천',straight:'직선',add:'점 추가',remove:'점 삭제',reset:'초기화',plan:'평면 · XY',elev:'측면 · XZ',preview:'3D 미리보기',texture:'텍스처',create:'연결 생성',update:'연결 재생성',cancel:'취소',collision:'충돌 가능',confirm:'교차 허용',edit:'기존 연결을 편집합니다. 수동으로 바꾼 브러시는 덮어쓰지 않습니다.',broken:'연결된 브러시가 변경/삭제되었습니다. 안전을 위해 재생성을 막았습니다.',none:'보이는 잠금 해제 브러시 두 개를 선택하세요.',detail:'원래 브러시는 변경하지 않습니다. 충돌 판정은 근사치입니다.',point:'경로점',undo:'수정 취소',empty:'호환되는 끝점이 없습니다.',alert:'생성 불가',apply:'GoldSrc 브러시가 한 번의 실행 취소 작업으로 생성되었습니다.'},
 zh:{title:'Smart Connect · 通用几何连接',help:'按住 Shift 选两个画刷，再选择端面。可在 XY/XZ 视图拖动控制点，使用 3D 视图查看。',from:'起点',to:'终点',face:'面',mode:'路径',angular:'折线',smooth:'平滑曲线',quality:'质量',clearance:'避障间距',auto:'推荐路径',straight:'直线',add:'添加点',remove:'删除点',reset:'重置',plan:'俯视 · XY',elev:'侧视 · XZ',preview:'3D 预览',texture:'纹理',create:'创建连接',update:'重新生成',cancel:'取消',collision:'可能碰撞',confirm:'允许相交',edit:'正在编辑现有连接。手动修改的画刷不会被覆盖。',broken:'关联的画刷已修改或删除，无法安全重新生成。',none:'请选择两个可见且未锁定的画刷。',detail:'不会修改原始画刷；碰撞检测为近似结果。',point:'控制点',undo:'撤销调整',empty:'没有兼容的端面。',alert:'无法创建',apply:'已创建可撤销的 GoldSrc 画刷。'},
 pt:{title:'Smart Connect · Geometria universal',help:'Selecione dois brushes com Shift+clique e escolha as faces. Arraste os pontos nas vistas XY/XZ e confira em 3D.',from:'Origem',to:'Destino',face:'Face',mode:'Rota',angular:'Com cantos',smooth:'Curva suave',quality:'Qualidade',clearance:'Distância (u)',auto:'Sugerir rota',straight:'Direta',add:'Adicionar ponto',remove:'Remover ponto',reset:'Redefinir',plan:'Planta · XY',elev:'Elevação · XZ',preview:'Prévia 3D',texture:'Textura',create:'Criar conexão',update:'Regenerar conexão',cancel:'Cancelar',collision:'Possível colisão',confirm:'Permitir cruzamentos',edit:'Editando conexão existente. Brushes alterados manualmente não serão sobrescritos.',broken:'Brushes da conexão foram alterados ou excluídos. Não será possível substituir.',none:'Escolha dois brushes visíveis e desbloqueados.',detail:'Brushes originais não são alterados. Detecção de colisão é aproximada.',point:'Ponto intermediário',undo:'Desfazer ajuste',empty:'Sem extremidades compatíveis.',alert:'Não foi possível criar',apply:'Brushes GoldSrc criados em uma operação reversível.'}
} as const;
function shapeGeometry(brush:Brush,center:THREE.Vector3):THREE.BufferGeometry{
 const vertices=transformedVertices(brush);const data:number[]=[],triangleFaces:number[]=[];
 for(const [faceIndex,face] of brush.faces.entries())for(let j=1;j<face.indices.length-1;j++){
  for(const index of [face.indices[0],face.indices[j],face.indices[j+1]]){
   const p=gameToThree(vertices[index]).sub(center);data.push(p.x,p.y,p.z);
  }
  triangleFaces.push(faceIndex);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data,3));
 geo.userData.triangleFaces=triangleFaces;geo.computeVertexNormals();return geo;
}
function Solid({brush,center,color,opacity,onFaceClick}:{brush:Brush;center:THREE.Vector3;color:string;opacity:number;onFaceClick?:(index:number)=>void}){
 const geo=useMemo(()=>shapeGeometry(brush,center),[brush,center]);
 const edges=useMemo(()=>new THREE.EdgesGeometry(geo,20),[geo]);
 useEffect(()=>()=>{geo.dispose();edges.dispose()},[geo,edges]);
 return <group><mesh geometry={geo} onClick={onFaceClick?(e:ThreeEvent<MouseEvent>)=>{
  e.stopPropagation();const index=geo.userData.triangleFaces?.[e.faceIndex??-1];
  if(Number.isInteger(index))onFaceClick(index);
 }:undefined}><meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={opacity} depthWrite={opacity>=0.99} metalness={0.04} roughness={0.78}/></mesh><lineSegments geometry={edges}><lineBasicMaterial color={color} transparent opacity={.65}/></lineSegments></group>;
}
function CameraFocus({radius,changeKey,enableRotate}:{radius:number;changeKey:string;enableRotate:boolean}){
 const {camera}=useThree();
 // Do not reset an orbiting camera every time a user drags a waypoint.
 useEffect(()=>{camera.position.set(radius*1.8,radius*1.35,radius*1.85);camera.lookAt(0,0,0);camera.updateProjectionMatrix()},[camera,changeKey]);
 return <OrbitControls makeDefault enableDamping enabled={enableRotate} minDistance={8} maxDistance={Math.max(radius*25,1000)}/>;
}
/** Camera-facing drag plane: lets users move any intermediate control in 3D.
 * Dragging in XY/XZ remains available for axis-precise editing. */
function Waypoint3D({position,center,index,last,selected,radius,onSelect,onStart,onMove,onDrag}:{position:THREE.Vector3;center:THREE.Vector3;index:number;last:number;selected:boolean;radius:number;onSelect:(i:number)=>void;onStart:()=>void;onMove:(i:number,p:Vec3)=>void;onDrag:(active:boolean)=>void}){
 const {camera}=useThree();
 const plane=useRef<THREE.Plane|null>(null);
 const size=Math.max(2,Math.min(radius*.017,12));
 const move=(e:ThreeEvent<globalThis.PointerEvent>)=>{
  if(!plane.current)return;
  const point=new THREE.Vector3();
  if(e.ray.intersectPlane(plane.current,point)){
   const game=threeToGame(point.add(center)).map(v=>Math.round(v*4)/4) as Vec3;
   if(game.every(Number.isFinite))onMove(index,game);
  }
 };
 return <mesh position={position} onPointerDown={e=>{
  e.stopPropagation();onSelect(index);
  if(index===0||index===last)return;
  onStart();plane.current=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),position);
  (e.target as unknown as {setPointerCapture:(id:number)=>void}).setPointerCapture(e.pointerId);onDrag(true);
 }} onPointerMove={e=>{if(plane.current){e.stopPropagation();move(e)}}}
 onPointerUp={e=>{if(plane.current){e.stopPropagation();plane.current=null;onDrag(false);(e.target as unknown as {releasePointerCapture:(id:number)=>void}).releasePointerCapture(e.pointerId)}}}
 onPointerCancel={()=>{plane.current=null;onDrag(false)}}>
  <sphereGeometry args={[size,12,12]}/><meshBasicMaterial color={selected?'#fff6c1':index===0?'#77b2ff':index===last?'#ffbf76':'#74e9d8'} depthTest={false}/>
 </mesh>;
}
function Preview3D({from,to,brushes,points,obstacles,openings,onFromFace,onToFace,selectedPoint,onSelectPoint,onMovePoint,onBeginMove,onInsertPoint,collidingIds,selectedObstacleId,onObstacleClick}:{from:Brush;to:Brush;brushes:Brush[];points:Vec3[];obstacles:ConnectionObstacle[];openings?:ConnectionCutDraft[];onFromFace:(index:number)=>void;onToFace:(index:number)=>void;selectedPoint:number;onSelectPoint:(index:number)=>void;onMovePoint:(index:number,point:Vec3)=>void;onBeginMove:()=>void;onInsertPoint:(index:number,point:Vec3)=>void;collidingIds:string[];selectedObstacleId:string|null;onObstacleClick:(id:string)=>void}){
 const [dragging,setDragging]=useState(false);
 const center=useMemo(()=>{
  const a=gameToThree(points[0]),b=gameToThree(points[points.length-1]);return a.add(b).multiplyScalar(.5);
 },[points[0]?.[0],points[0]?.[1],points[0]?.[2],points[points.length-1]?.[0],points[points.length-1]?.[1],points[points.length-1]?.[2]]);
 const radius=useMemo(()=>Math.max(90,...points.map(p=>gameToThree(p).distanceTo(center)))*1.45,[points,center]);
 const path=useMemo(()=>points.map(p=>gameToThree(p).sub(center)),[points,center]);
 const nearby=useMemo(()=>{
  const xBounds=points.map(p=>p[0]),yBounds=points.map(p=>p[1]),zBounds=points.map(p=>p[2]);
  const low=[Math.min(...xBounds),Math.min(...yBounds),Math.min(...zBounds)];
  const high=[Math.max(...xBounds),Math.max(...yBounds),Math.max(...zBounds)];
  return obstacles.filter(o=>[0,1,2].every(i=>o.max[i]>=low[i]-180&&o.min[i]<=high[i]+180)).slice(0,28);
 },[obstacles,points]);
 const key=`${from.id}:${to.id}`;
 return <div className="sc-3d" onContextMenu={e=>e.preventDefault()}>
  <Canvas camera={{position:[180,130,190],fov:52,near:.1,far:250000}} dpr={[1,1.35]} gl={{antialias:true}}>
   <color attach="background" args={['#101c2b']}/><ambientLight intensity={1.15}/><directionalLight position={[80,180,100]} intensity={1.7}/>
   {nearby.filter(box=>!openings?.some(c=>c.original.id===box.id)).map(box=>{const min=gameToThree(box.min),max=gameToThree(box.max);
    const position=min.clone().add(max).multiplyScalar(.5).sub(center);
    const size=max.clone().sub(min).toArray().map(Math.abs);
    const selected=box.id===selectedObstacleId,hit=collidingIds.includes(box.id);
    return <group key={box.id} position={position} onClick={e=>{e.stopPropagation();onObstacleClick(box.id)}}><mesh><boxGeometry args={size as [number,number,number]}/><meshBasicMaterial color={selected?'#ffcb72':hit?'#f07181':'#bb687a'} transparent opacity={selected?.13:.045} depthWrite={false}/></mesh><mesh><boxGeometry args={size as [number,number,number]}/><meshBasicMaterial color={selected?'#ffcb72':hit?'#f07181':'#bb687a'} transparent opacity={selected?.9:hit?.6:.27} wireframe depthWrite={false}/></mesh></group>;
   })}
   <Solid brush={from} center={center} color="#6999cd" opacity={0.32} onFaceClick={onFromFace}/><Solid brush={to} center={center} color="#e8ab62" opacity={0.32} onFaceClick={onToFace}/>
   {openings?.flatMap(c=>c.fragments).map(b=><Solid key={b.id} brush={b} center={center} color="#b8b9df" opacity={0.28}/>)}
   {brushes.map(b=><Solid key={b.id} brush={b} center={center} color="#5ed4c3" opacity={0.85}/>)}
   {path.map((p,i)=><Waypoint3D key={i} position={p} center={center} index={i} last={path.length-1} selected={selectedPoint===i} radius={radius} onSelect={onSelectPoint} onStart={onBeginMove} onMove={onMovePoint} onDrag={setDragging}/>)}
   {path.slice(0,-1).map((point,i)=><lineSegments key={`segment-${i}`} onDoubleClick={e=>{e.stopPropagation();if(points.length<24)onInsertPoint(i+1,threeToGame(e.point.clone().add(center)))}}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([...point.toArray(),...path[i+1].toArray()]),3]}/></bufferGeometry>
    <lineBasicMaterial color="#ffeb9a" depthTest={false}/></lineSegments>)}
   <CameraFocus radius={radius} changeKey={key} enableRotate={!dragging}/>
  </Canvas><span className="sc-3d-hint">Arrastrar puntos: editar · Doble clic en línea: añadir · Clic en obstáculo: seleccionar · Arrastrar fondo: orbitar</span>
 </div>;
}
const ROUTE_TEXT={
 es:{way:'Ruta calculada con obstáculos',blocked:'No se encontró un recorrido libre: ajustá los puntos o elegí una abertura.',openings:'Abrir huecos en obstáculos (opcional)',choose:'Seleccioná individualmente los brushes que se pueden cortar',unsupported:'No se pueden perforar brushes bloqueados, vinculados o pertenecientes a entidades.',cutPreview:'Vista previa de aberturas',cutConfirm:'Se reemplazarán los brushes marcados por piezas CSG. Se puede deshacer todo. Los originales quedan almacenados para regeneración segura.',cutError:'Abertura no válida',left:'Intersecciones sin resolver',found:'Puntos de ruta',jump:'Elegir brushes para abrir huecos'},
 en:{way:'Obstacle-aware route',blocked:'No clear route found: edit the waypoints or choose an opening.',openings:'Cut openings in obstacles (optional)',choose:'Individually select the world brushes to cut',unsupported:'Locked, linked or entity brushes cannot be perforated.',cutPreview:'Opening preview',cutConfirm:'Selected brushes will be replaced with CSG pieces in a single undoable operation. Originals are retained for safe regeneration.',cutError:'Invalid opening',left:'Unresolved intersections',found:'Route points',jump:'Choose brushes for openings'},
 ru:{way:'Маршрут с учётом препятствий',blocked:'Свободный маршрут не найден. Измените точки или вырежьте отверстие.',openings:'Вырезать отверстия (необязательно)',choose:'Выберите отдельные браши для разреза',unsupported:'Заблокированные, связанные и entity-браши недоступны.',cutPreview:'Просмотр отверстий',cutConfirm:'Выбранные браши будут заменены частями CSG с одним действием отмены.',cutError:'Неверное отверстие',left:'Оставшиеся пересечения',found:'Точки маршрута',jump:'Выбрать браши для отверстий'},
 ko:{way:'장애물 회피 경로',blocked:'충돌 없는 경로가 없습니다. 점을 수정하거나 구멍을 선택하세요.',openings:'장애물에 구멍 만들기 (선택)',choose:'절단할 월드 브러시를 선택',unsupported:'잠금/연결/엔티티 브러시는 절단할 수 없습니다.',cutPreview:'구멍 미리보기',cutConfirm:'선택한 브러시는 CSG 조각으로 대체되며 한 번에 실행 취소할 수 있습니다.',cutError:'유효하지 않은 구멍',left:'남은 충돌',found:'경로 점',jump:'구멍을 만들 브러시 선택'},
 zh:{way:'避障路线',blocked:'没有找到无碰撞路线。调整控制点或选择开孔。',openings:'在障碍中开孔（可选）',choose:'单独选择要切割的世界笔刷',unsupported:'无法切割锁定、关联或实体笔刷。',cutPreview:'开孔预览',cutConfirm:'选中笔刷将替换为 CSG 片段，可一次撤销。',cutError:'无效开孔',left:'未解决碰撞',found:'路径点',jump:'选择需要开孔的笔刷'},
 pt:{way:'Rota que evita obstáculos',blocked:'Nenhuma rota livre encontrada: ajuste os pontos ou escolha uma abertura.',openings:'Criar aberturas em obstáculos (opcional)',choose:'Selecione cada brush de mundo a cortar',unsupported:'Brushes bloqueados, vinculados ou de entidades não podem ser cortados.',cutPreview:'Prévia das aberturas',cutConfirm:'Os brushes escolhidos serão substituídos por peças CSG em uma única operação reversível.',cutError:'Abertura inválida',left:'Interseções restantes',found:'Pontos da rota',jump:'Escolher brushes para aberturas'},
} satisfies Record<Locale,{way:string;blocked:string;openings:string;choose:string;unsupported:string;cutPreview:string;cutConfirm:string;cutError:string;left:string;found:string;jump:string}>;
const PLUS_TEXT={
 es:{title:'Rutas inteligentes',undo:'Deshacer',redo:'Rehacer',alts:'Alternativas calculadas',empty:'No hay rutas geométricamente válidas todavía.',shortest:'Más corta',fewest:'Menos brushes',over:'Por arriba',under:'Por abajo',left:'Lateral izquierdo',right:'Lateral derecho',hits:'intersecciones',step:'Elegir recorrido',transition:'Transición del perfil',linear:'Lineal',ease:'Suave',holdStart:'Conservar inicio',holdEnd:'Conservar final',focus:'Obstáculo seleccionado',select:'Seleccionar para abertura',tip:'Seleccioná los puntos en 3D, arrastralos o ajustalos en XY/XZ. Ctrl+Z / Ctrl+Y funcionan mientras Smart Connect está abierto.'},
 en:{title:'Smart routes',undo:'Undo',redo:'Redo',alts:'Calculated alternatives',empty:'No geometrically valid routes yet.',shortest:'Shortest',fewest:'Fewest brushes',over:'Above',under:'Below',left:'Left side',right:'Right side',hits:'intersections',step:'Choose route',transition:'Profile transition',linear:'Linear',ease:'Smooth',holdStart:'Hold start',holdEnd:'Hold end',focus:'Selected obstacle',select:'Select for opening',tip:'Drag 3D waypoints or refine in XY/XZ. Ctrl+Z / Ctrl+Y work while Smart Connect is open.'},
 ru:{title:'Умные маршруты',undo:'Отменить',redo:'Повторить',alts:'Варианты маршрута',empty:'Нет подходящих маршрутов.',shortest:'Кратчайший',fewest:'Меньше брашей',over:'Сверху',under:'Снизу',left:'Слева',right:'Справа',hits:'пересечений',step:'Выбор пути',transition:'Переход профиля',linear:'Линейный',ease:'Плавный',holdStart:'Сохранить начало',holdEnd:'Сохранить конец',focus:'Выбранное препятствие',select:'Выбрать для отверстия',tip:'Перетаскивайте 3D-точки или используйте XY/XZ. Ctrl+Z / Ctrl+Y.'},
 ko:{title:'스마트 경로',undo:'실행 취소',redo:'다시 실행',alts:'경로 대안',empty:'유효한 경로가 없습니다.',shortest:'최단',fewest:'최소 브러시',over:'위',under:'아래',left:'왼쪽',right:'오른쪽',hits:'충돌',step:'경로 선택',transition:'프로필 전환',linear:'선형',ease:'부드럽게',holdStart:'시작 유지',holdEnd:'끝 유지',focus:'선택한 장애물',select:'구멍에 추가',tip:'3D 점을 끌거나 XY/XZ에서 조정하세요. Ctrl+Z / Ctrl+Y.'},
 zh:{title:'智能路线',undo:'撤销',redo:'重做',alts:'可选路线',empty:'目前没有有效路线。',shortest:'最短',fewest:'最少笔刷',over:'上方',under:'下方',left:'左侧',right:'右侧',hits:'碰撞',step:'选择路线',transition:'轮廓过渡',linear:'线性',ease:'平滑',holdStart:'保持起点',holdEnd:'保持终点',focus:'已选障碍物',select:'选择开孔',tip:'拖动3D控制点或在XY/XZ调整。Ctrl+Z / Ctrl+Y。'},
 pt:{title:'Rotas inteligentes',undo:'Desfazer',redo:'Refazer',alts:'Rotas alternativas',empty:'Nenhuma rota válida ainda.',shortest:'Mais curta',fewest:'Menos brushes',over:'Por cima',under:'Por baixo',left:'Esquerda',right:'Direita',hits:'colisões',step:'Escolher rota',transition:'Transição do perfil',linear:'Linear',ease:'Suave',holdStart:'Manter início',holdEnd:'Manter final',focus:'Obstáculo selecionado',select:'Selecionar abertura',tip:'Arraste pontos 3D ou ajuste em XY/XZ. Ctrl+Z / Ctrl+Y.'},
} satisfies Record<Locale,Record<string,string>>;
const VIEW_W=560,VIEW_H=270;
function PlanView({points,view,selected,onSelect,onMove,onStartDrag,label,limit,obstacles}:{points:Vec3[];view:'xy'|'xz';selected:number;onSelect:(index:number)=>void;onMove:(index:number,point:Vec3)=>void;onStartDrag:()=>void;label:string;limit:number;obstacles:ConnectionObstacle[]}){
 const [drag,setDrag]=useState<number|null>(null);
 const [dragBounds,setDragBounds]=useState<{mx:number;my:number;scale:number}|null>(null);
 const xAxis=0,yAxis=view==='xy'?1:2;
 const bounds=useMemo(()=>{
  // Fit the whole route, not just endpoints. Otherwise obstacle detours
  // disappear outside the 2D plan and cannot be dragged back.
  const minX=Math.min(...points.map(p=>p[xAxis])),maxCoordX=Math.max(...points.map(p=>p[xAxis]));
  const minY=Math.min(...points.map(p=>p[yAxis])),maxCoordY=Math.max(...points.map(p=>p[yAxis]));
  const mx=(minX+maxCoordX)/2,my=(minY+maxCoordY)/2;
  const maxX=Math.max(128,(maxCoordX-minX)*1.18,limit);
  const maxY=Math.max(128,(maxCoordY-minY)*1.18,limit);
  const scale=Math.min((VIEW_W-78)/maxX,(VIEW_H-74)/maxY);
  return {mx,my,scale};
 },[points,xAxis,yAxis,limit]);
 const viewBounds=dragBounds??bounds;
 const project=(p:Vec3)=>[VIEW_W/2+(p[xAxis]-viewBounds.mx)*viewBounds.scale,VIEW_H/2-(p[yAxis]-viewBounds.my)*viewBounds.scale] as const;
 const projected=points.map(project);
 const move=(event:PointerEvent<SVGSVGElement>)=>{
  if(drag===null||drag===0||drag===points.length-1)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width*VIEW_W,y=(event.clientY-rect.top)/rect.height*VIEW_H;
  const value=[...points[drag]] as Vec3;
  value[xAxis]=Math.round((viewBounds.mx+(x-VIEW_W/2)/viewBounds.scale)*4)/4;
  value[yAxis]=Math.round((viewBounds.my-(y-VIEW_H/2)/viewBounds.scale)*4)/4;
  onMove(drag,value);
 };
 return <div className="sc-plan"><div className="sc-plan-head">{label}<small>{view==='xy'?'X →  Y ↑':'X →  Z ↑'}</small></div>
  <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" role="img" aria-label={label} onPointerMove={move} onPointerUp={e=>{if(drag!==null){if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);setDrag(null);setDragBounds(null)}}} onPointerCancel={()=>{setDrag(null);setDragBounds(null)}}>
   <defs><pattern id={`sc-grid-${view}`} width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#2a3e52" strokeWidth=".7"/></pattern></defs>
   <rect width={VIEW_W} height={VIEW_H} fill="#101d2c"/><rect width={VIEW_W} height={VIEW_H} fill={`url(#sc-grid-${view})`}/>
   <path d={`M ${VIEW_W/2} 0 V ${VIEW_H} M 0 ${VIEW_H/2} H ${VIEW_W}`} fill="none" stroke="#446179" strokeWidth=".8"/>
   {obstacles.filter(box=>[0,1,2].every(i=>box.max[i]>=Math.min(...points.map(p=>p[i]))-180&&box.min[i]<=Math.max(...points.map(p=>p[i]))+180)).slice(0,40).map(box=>{
    const [x1,y1]=project(box.min),[x2,y2]=project(box.max);
    return <rect key={box.id} x={Math.min(x1,x2)} y={Math.min(y1,y2)} width={Math.abs(x2-x1)} height={Math.abs(y2-y1)} fill="#b95f72" fillOpacity={0.13} stroke="#dd7b86" strokeOpacity={0.68} strokeWidth={1.2} pointerEvents="none"/>;
   })}
   <polyline points={projected.map(p=>p.join(',')).join(' ')} fill="none" stroke="#70d9d2" strokeWidth="3" strokeLinejoin="round"/>
   {projected.map(([x,y],i)=><g key={i}>
    <circle cx={x} cy={y} r={i===selected?11:8} stroke={i===selected?'#fff0bb':'#133046'} strokeWidth="2.5" fill={i===0?'#729dec':i===points.length-1?'#f1a868':'#7ee0d1'} style={{cursor:i>0&&i<points.length-1?'grab':'pointer',touchAction:'none'}} onPointerDown={e=>{e.preventDefault();e.stopPropagation();onSelect(i);if(i>0&&i<points.length-1){onStartDrag();setDragBounds(bounds);setDrag(i);e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId)}}}/>
    <text x={x+12} y={y-12} fill="#eef4fa" fontSize="12" style={{pointerEvents:'none'}}>{i===0?'A':i===points.length-1?'B':i}</text>
   </g>)}
  </svg>
 </div>;
}
export function SmartConnectPanel({onClose}:{onClose:()=>void}){
 const locale=useEditor(s=>s.locale) as Locale;
 const l=TEXT[locale]??TEXT.en;
 const pickText=PICK_TEXT[locale]??PICK_TEXT.en;
 const routeText=ROUTE_TEXT[locale]??ROUTE_TEXT.en;
 const plus=PLUS_TEXT[locale]??PLUS_TEXT.en;
 const objects=useEditor(s=>s.project.objects),selected=useEditor(s=>s.selectedIds),records=useEditor(s=>s.project.smartConnections);
 const currentTexture=useEditor(s=>s.currentTexture);
 const protectedIds=useMemo(()=>protectedOpeningIds(useEditor.getState().project),[objects]);
 const available=useMemo(()=>objects.filter((o):o is Brush=>o.kind==='brush'&&!o.hidden&&!o.locked),[objects]);
 const activeRecord=useMemo(()=>records?.find(r=>r.brushIds.some(id=>selected.includes(id)))??null,[]); // snapshot on opening
 const [fromId,setFromId]=useState(()=>activeRecord?.from.brushId??selected.find(id=>available.some(b=>b.id===id))??'');
 const [toId,setToId]=useState(()=>activeRecord?.to.brushId??selected.find(id=>id!==fromId&&available.some(b=>b.id===id))??'');
 const from=available.find(b=>b.id===fromId),to=available.find(b=>b.id===toId);
 const [fromFace,setFromFace]=useState(()=>activeRecord?.from.faceIndex??(from&&to?defaultConnectionFace(from,to):0));
 const [toFace,setToFace]=useState(()=>activeRecord?.to.faceIndex??(from&&to?defaultConnectionFace(to,from):0));
 const [options,setOptions]=useState<SmartConnectOptions>(()=>activeRecord?.options??{points:from&&to?[faceCenter(from,fromFace),faceCenter(to,toFace)]:[[0,0,0],[160,0,0]],quality:4,mode:'angular',texture:from?.faces[fromFace]?.texture||currentTexture||'SV_BRICK01',clearance:16});
 const [selectedPoint,setSelectedPoint]=useState(1),[allowCollisions,setAllowCollisions]=useState(false),[error,setError]=useState('');
 const [history,setHistory]=useState<SmartConnectHistory>(()=>createSmartConnectHistory());
 const [routeAlternatives,setRouteAlternatives]=useState<{id:string;points:Vec3[];hits:number;brushes:number;length:number}[]>([]);
 const [selectedObstacleId,setSelectedObstacleId]=useState<string|null>(null);
 const [cutIds,setCutIds]=useState<string[]>(()=>activeRecord?.cuts?.map(c=>c.original.id)??[]);
 const [routeFeedback,setRouteFeedback]=useState('');
 const [picking,setPicking]=useState(false);
 const openingSection=useRef<HTMLFieldSetElement>(null);
 const savedSelection=useRef<string[]>([]);
 const pickedBrushes=selected.filter(id=>available.some(brush=>brush.id===id));
 const currentDraft:SmartConnectDraft={fromId,toId,fromFace,toFace,options,selectedPoint,allowCollisions,cutIds,routeFeedback};
 const recordStep=()=>{setHistory(old=>recordSmartConnectChange(old,currentDraft));};
 const applyDraft=(draft:SmartConnectDraft)=>{
  setFromId(draft.fromId);setToId(draft.toId);setFromFace(draft.fromFace);setToFace(draft.toFace);
  setOptions({...draft.options,points:draft.options.points.map(p=>[...p] as Vec3)});
  setSelectedPoint(draft.selectedPoint);setAllowCollisions(draft.allowCollisions);
  setCutIds([...draft.cutIds]);setRouteFeedback(draft.routeFeedback);setError('');
 };
 const undoEdit=()=>{const next=undoSmartConnectChange(history,currentDraft);if(next){setHistory(next.history);applyDraft(next.draft)}};
 const redoEdit=()=>{const next=redoSmartConnectChange(history,currentDraft);if(next){setHistory(next.history);applyDraft(next.draft)}};
 const historyActions=useRef({undo:undoEdit,redo:redoEdit});
 historyActions.current={undo:undoEdit,redo:redoEdit};
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
   if(event.code!=='KeyZ'&&event.code!=='KeyY')return;
   event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
   if(event.code==='KeyY'||event.shiftKey)historyActions.current.redo();else historyActions.current.undo();
  };
  window.addEventListener('keydown',onKey,true);
  return()=>window.removeEventListener('keydown',onKey,true);
 },[]);

 const startPick=()=>{
  if(activeRecord)return; // Regenerating a linked connection must retain its original endpoints.
  savedSelection.current=[...selected];
  const editor=useEditor.getState();
  editor.setGeometryMode('object'); // Shift+click must select objects, not UV faces.
  editor.setSelected(null);
  setPicking(true);
 };
 const cancelPick=()=>{
  const editor=useEditor.getState();
  editor.setSelected(null);
  for(const id of savedSelection.current){
   if(editor.project.objects.some(object=>object.id===id))editor.selectObject(id,true);
  }
  setPicking(false);
 };
 const usePicked=()=>{
  if(pickedBrushes.length!==2)return;
  const a=available.find(brush=>brush.id===pickedBrushes[0]);
  const b=available.find(brush=>brush.id===pickedBrushes[1]);
  if(!a||!b||a.id===b.id)return;
  const af=defaultConnectionFace(a,b),bf=defaultConnectionFace(b,a);
  recordStep();setFromId(a.id);setToId(b.id);setFromFace(af);setToFace(bf);
  setOptions(previous=>({...previous,points:[faceCenter(a,af),faceCenter(b,bf)],texture:a.faces[af]?.texture||previous.texture}));
  setSelectedPoint(1);setAllowCollisions(false);setError('');
  setPicking(false);
 };
 useEffect(()=>{
  if(!picking)return;
  const escape=(event:KeyboardEvent)=>{
   if(event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancelPick();}
  };
  window.addEventListener('keydown',escape,true);
  return()=>window.removeEventListener('keydown',escape,true);
 },[picking,selected]);
 const invalidOriginal=!!activeRecord&&!connectionCanRegenerate(activeRecord,objects);
 const obstacles=useMemo(()=>{
  if(!from||!to)return [];
  // Existing connection members must not count as obstacles during regeneration.
  const oldPieceIds=new Set(activeRecord?.cuts?.flatMap(c=>c.pieces.map(p=>p.id))??[]);
  const reduced=activeRecord?objects.filter(o=>!activeRecord.brushIds.includes(o.id)&&!oldPieceIds.has(o.id)):objects;
  const originals=activeRecord?.cuts?.map(c=>c.original)??[];
  return obstacleBoxes([...reduced,...originals],from.id,to.id);
 },[objects,from,to,activeRecord]);
 const safeOptions=useMemo(()=>{
  if(!from||!to)return options;
  try{return {...options,points:[faceCenter(from,fromFace),...options.points.slice(1,-1),faceCenter(to,toFace)]};}
  catch{return options;}
 },[options,from,to,fromFace,toFace]);
 const preview=useMemo(()=>{
  if(!from||!to||from.id===to.id)return {error:l.none,result:null};
  try{return {error:'',result:generateSmartConnection(from,to,fromFace,toFace,safeOptions,
   activeRecord?objects.filter(o=>!activeRecord.brushIds.includes(o.id)):objects,activeRecord?.id??'preview',obstacles)};}
  catch(e){return {error:String(e instanceof Error?e.message:e),result:null};}
 },[from,to,fromFace,toFace,safeOptions,objects,activeRecord,obstacles,l.none]);
 const cuttingCandidates=useMemo(()=>{
  const ids=new Set([...(preview.result?.collisions??[]),...(activeRecord?.cuts??[]).map(c=>c.original.id)]);
  return [...ids].map(id=>activeRecord?.cuts?.find(c=>c.original.id===id)?.original??objects.find(o=>o.id===id))
   .filter((item):item is Brush=>item?.kind==='brush');
 },[preview.result?.collisions,activeRecord,objects]);
 const cutPreview=useMemo(()=>{
  if(!preview.result||!cutIds.length)return {error:'',cuts:[] as ConnectionCutDraft[]};
  try{
   const targets=cutIds.map(id=>cuttingCandidates.find(b=>b.id===id));
   if(targets.some(b=>!b))throw Error('An opening obstacle is no longer available.');
   return {error:'',cuts:planConnectionOpenings(preview.result,targets as Brush[])};
  }catch(error){return {error:String(error instanceof Error?error.message:error),cuts:[] as ConnectionCutDraft[]};}
 },[preview.result,cutIds,cuttingCandidates]);
 const clearedIds=new Set(cutPreview.error?[]:cutPreview.cuts.map(c=>c.original.id));
 const remainingCollisions=preview.result?.collisions.filter(id=>!clearedIds.has(id))??[];
 const updatePoints=(next:Vec3[],remember=true)=>{if(remember)recordStep();setRouteAlternatives([]);setRouteFeedback('');setOptions(v=>({...v,points:next}));setAllowCollisions(false)};
 const movePoint=(i:number,p:Vec3)=>{setRouteFeedback('');if(i<1||i>=safeOptions.points.length-1)return;setRouteAlternatives([]);setOptions(v=>({...v,points:v.points.map((point,j)=>i===j?p:point)}));setAllowCollisions(false)};
 const autoRoute=()=>{if(!from||!to)return;
  try{
   const a=faceCenter(from,fromFace),b=faceCenter(to,toFace);
   const nA=workshopFrame(from,fromFace).normal,nB=workshopFrame(to,toFace).normal;
   const radius=Math.max(...[from,to].map((brush,i)=>{
    const center=new THREE.Vector3(...(i===0?a:b)),world=transformedVertices(brush),face=brush.faces[i===0?fromFace:toFace];
    return Math.max(...face.indices.map(index=>new THREE.Vector3(...world[index]).distanceTo(center)));
   }));
   const all=suggestConnectionAlternatives(a,b,nA,nB,obstacles,safeOptions.clearance+radius);
   const validated=all.map(alt=>{
    try{
     const test=generateSmartConnection(from,to,fromFace,toFace,{...safeOptions,points:alt.points,mode:'angular'},objects,activeRecord?.id??'preview',obstacles);
     return {id:alt.id,points:alt.points,hits:test.collisions.length,brushes:test.brushes.length,length:alt.length};
    }catch{return null;}
   }).filter((item):item is NonNullable<typeof item>=>item!==null);
   validated.sort((a,b)=>a.hits-b.hits||a.length-b.length||a.brushes-b.brushes);
   // Offer a real brush-count objective only when it differs from the shortest
   // viable choice. This uses the generated GoldSrc brush count, not point count.
   const cleanHits=validated[0]?.hits??Infinity;
   const smallest=[...validated].filter(r=>r.hits===cleanHits).sort((a,b)=>a.brushes-b.brushes||a.length-b.length)[0];
   const fewer=smallest&&validated[0]&&smallest.brushes<validated[0].brushes?{...smallest,id:'fewest'}:null;
   const routes=fewer?[validated[0],fewer,...validated.slice(1)]:validated;
   setRouteAlternatives(routes);
   if(!validated.length){setRouteFeedback(routeText.blocked);return;}
   recordStep();setOptions(o=>({...o,points:validated[0].points,mode:'angular'}));setSelectedPoint(1);setAllowCollisions(false);
   setRouteFeedback(validated[0].hits>0?routeText.blocked:`${routeText.way}: ${validated[0].points.length} ${routeText.found.toLowerCase()}`);
   setError('');
  }catch(e){setError(String(e))}
 };
 const selectRoute=(alt:{points:Vec3[];hits:number})=>{
  recordStep();setOptions(o=>({...o,points:alt.points.map(p=>[...p] as Vec3),mode:'angular'}));
  setSelectedPoint(1);setAllowCollisions(false);setRouteFeedback(alt.hits>0?routeText.blocked:'');
 };
 const addAt=(index:number,point:Vec3)=>{
  if(safeOptions.points.length>=24||index<=0||index>=safeOptions.points.length)return;
  recordStep();setOptions(o=>({...o,points:[...safeOptions.points.slice(0,index),point,...safeOptions.points.slice(index)]}));
  setSelectedPoint(index);setAllowCollisions(false);setRouteAlternatives([]);
 };
 const selectObstacle=(id:string)=>{
  setSelectedObstacleId(id);openingSection.current?.scrollIntoView({behavior:'smooth',block:'nearest'});
 };
 const canCut=(brush:Brush)=>{
  const busy=(records??[]).some(r=>r.id!==activeRecord?.id&&(r.from.brushId===brush.id||r.to.brushId===brush.id||r.brushIds.includes(brush.id)||(r.cuts??[]).some(c=>c.original.id===brush.id)));
  return !brush.hidden&&!brush.locked&&!brush.entityId&&!protectedIds.has(brush.id)&&!busy;
 };
 const changeCut=(id:string,on:boolean)=>{
  const brush=cuttingCandidates.find(b=>b.id===id);
  if(on&&(!brush||!canCut(brush)||cutIds.length>=4))return;
  recordStep();setCutIds(ids=>on?[...ids,id]:ids.filter(item=>item!==id));setAllowCollisions(false);
 };

 const commit=()=>{
  if(!from||!to||!preview.result||invalidOriginal||cutPreview.error||(remainingCollisions.length&&!allowCollisions))return;
  try{
   const id=activeRecord?.id??newConnectionId();
   const brushes=preview.result.brushes.map(b=>({...b,group:`Smart Connect · ${id}`}));
   const record=makeConnectionRecord(id,{brushId:from.id,faceIndex:fromFace},{brushId:to.id,faceIndex:toFace},safeOptions,brushes,cutPreview.cuts);
   useEditor.getState().saveSmartConnection(record,brushes,cutPreview.cuts);
   onClose();
  }catch(e){setError(`${l.alert}: ${String(e instanceof Error?e.message:e)}`)}
 };
 const coordinate=(axis:number,value:number)=>{
  if(!Number.isFinite(value))return;
  recordStep();movePoint(selectedPoint,safeOptions.points[selectedPoint].map((n,i)=>i===axis?Math.max(-131000,Math.min(131000,value)):n) as Vec3);
 };
 const limit=Math.max(128,safeOptions.clearance*6);
 if(picking)return <div className="sc-picking-dock" role="region" aria-label={pickText.pick}>
  <strong>{pickText.pick}</strong>
  <p>{pickText.help}</p>
  <span>{pickText.count}: <b>{pickedBrushes.length}/2</b></span>
  {pickedBrushes.slice(0,2).map((id,i)=><small key={id}>{i===0?pickText.first:pickText.second}: {available.find(b=>b.id===id)?.editorAlias||available.find(b=>b.id===id)?.name||id}</small>)}
  {pickedBrushes.length!==2&&<small>{pickText.hint}</small>}
  <div className="sc-pick-actions"><button onClick={cancelPick}>{pickText.cancel}</button><button className="sc-primary" disabled={pickedBrushes.length!==2} onClick={usePicked}>{pickText.ready}</button></div>
 </div>;
 return <div className="modal-backdrop sc-backdrop" onMouseDown={onClose}>
  <section className="sc-modal" role="dialog" aria-modal="true" aria-label={l.title} onMouseDown={e=>e.stopPropagation()}>
   <header className="sc-title"><div className="sc-brand-icon"><Route size={22}/></div><div className="sc-brand-copy"><strong>{l.title}</strong><small>{plus.title} · 2D + 3D</small></div><div className="sc-history" role="group" aria-label="Smart Connect history"><button title={`${plus.undo} · Ctrl+Z`} aria-label={`${plus.undo} · Ctrl+Z`} onClick={undoEdit} disabled={!history.past.length}><Undo2 size={17}/><span>{plus.undo}</span></button><button title={`${plus.redo} · Ctrl+Y / Ctrl+Shift+Z`} aria-label={`${plus.redo} · Ctrl+Y`} onClick={redoEdit} disabled={!history.future.length}><Redo2 size={17}/><span>{plus.redo}</span></button></div><button className="sc-close" onClick={onClose} aria-label={l.cancel}><X size={19}/></button></header>
   <p className="sc-help"><MousePointer2 size={14}/>{plus.tip}</p>
   {!activeRecord&&<div className="sc-pick-strip"><span>{pickText.hint}</span><button type="button" onClick={startPick}>{pickText.pick}</button></div>}
   <div className="sc-layout"><div className="sc-options">
    {([['from',fromId,from,setFromId,fromFace,setFromFace],['to',toId,to,setToId,toFace,setToFace]] as const).map(([key,id,brush,setId,face,setFace])=><fieldset key={key}><legend>{key==='from'?l.from:l.to}</legend>
     <select aria-label={key==='from'?l.from:l.to} value={id} onChange={e=>{recordStep();const next=available.find(b=>b.id===e.target.value);setId(e.target.value);if(next){const other=key==='from'?to:from;setFace(other?defaultConnectionFace(next,other):0)}}}>
      <option value="">— {key==='from'?l.from:l.to} —</option>{available.map(b=><option key={b.id} value={b.id}>{b.editorAlias||b.name} · {b.id.slice(0,7)}</option>)}
     </select>
     <label>{l.face}<select value={face} onChange={e=>{recordStep();setFace(Number(e.target.value))}}>{brush?.faces.map((f,i)=><option key={i} value={i}>{i+1} · {f.texture}</option>)}</select></label>
    </fieldset>)}
    <label>{l.mode}<select value={options.mode} onChange={e=>{recordStep();setOptions(v=>({...v,mode:e.target.value as SmartConnectOptions['mode']}))}}><option value="angular">{l.angular}</option><option value="smooth">{l.smooth}</option></select></label>
    <label>{l.quality}<select value={options.quality} onChange={e=>{recordStep();setOptions(v=>({...v,quality:Number(e.target.value) as SmartConnectOptions['quality']}))}}><option value={4}>Low · 4</option><option value={8}>Normal · 8</option><option value={12}>High · 12</option></select></label>
    <label>{l.clearance}<input type="number" min="0" max="512" step="4" value={options.clearance} onChange={e=>{recordStep();setOptions(v=>({...v,clearance:Number(e.target.value)}))}}/></label>
    <label>{l.texture}<input value={options.texture} maxLength={32} onChange={e=>{recordStep();setOptions(v=>({...v,texture:e.target.value}))}}/></label>
    <label>{plus.transition}<select value={options.transition??'linear'} onChange={e=>{recordStep();setOptions(v=>({...v,transition:e.target.value as SmartConnectOptions['transition']}))}}><option value="linear">{plus.linear}</option><option value="ease">{plus.ease}</option><option value="hold-start">{plus.holdStart}</option><option value="hold-end">{plus.holdEnd}</option></select></label>
    <div className="sc-button-row"><button onClick={autoRoute} disabled={!from||!to||from.id===to.id}><CornerDownRight size={15}/>{l.auto}</button><button onClick={()=>{if(from&&to)updatePoints([faceCenter(from,fromFace),faceCenter(to,toFace)])}} disabled={!from||!to}>{l.straight}</button></div>
    {!!routeAlternatives.length&&<div className="sc-route-panel"><div className="sc-route-heading"><Sparkles size={16}/><strong>{plus.alts}</strong><small>{routeAlternatives.length}</small></div><div className="sc-route-list">{routeAlternatives.map((alt,i)=><button type="button" key={`${alt.id}-${i}`} className={safeOptions.points.length===alt.points.length&&safeOptions.points.every((p,j)=>p.every((v,k)=>Math.abs(v-alt.points[j][k])<.01))?'sc-route-active':''} onClick={()=>selectRoute(alt)}><span>{plus[alt.id as keyof typeof plus]??alt.id}</span><small>{Math.round(alt.length)}u · {alt.brushes} brushes · {alt.hits} {plus.hits}</small></button>)}</div></div>}
    {!!cuttingCandidates.length&&<button type="button" className="sc-opening-shortcut" aria-controls="sc-opening-controls" onClick={()=>{
     openingSection.current?.scrollIntoView({behavior:'smooth',block:'start',inline:'nearest'});
     openingSection.current?.focus({preventScroll:true});
    }}><CornerDownRight size={15}/>{routeText.jump} ({cuttingCandidates.length})</button>}
    {routeFeedback&&<p className="sc-info" role="status">{routeFeedback}</p>}
    <fieldset><legend>{l.point} · {safeOptions.points.length-2}</legend><div className="sc-button-row">
     <button onClick={()=>{const index=Math.min(Math.max(1,selectedPoint),safeOptions.points.length-1),a=safeOptions.points[index-1],b=safeOptions.points[index];if(safeOptions.points.length>=24)return;updatePoints([...safeOptions.points.slice(0,index),a.map((n,j)=>(n+b[j])/2) as Vec3,...safeOptions.points.slice(index)]);setSelectedPoint(index)}} disabled={safeOptions.points.length>=24}><Plus size={14}/>{l.add}</button>
     <button onClick={()=>{if(selectedPoint<=0||selectedPoint>=safeOptions.points.length-1)return;updatePoints(safeOptions.points.filter((_,i)=>i!==selectedPoint));setSelectedPoint(Math.max(1,selectedPoint-1))}} disabled={selectedPoint<=0||selectedPoint>=safeOptions.points.length-1}><Trash2 size={14}/>{l.remove}</button>
    </div><div className="sc-coordinates">{(['X','Y','Z'] as const).map((axis,i)=><label key={axis}>{axis}<input type="number" step="1" disabled={selectedPoint<=0||selectedPoint>=safeOptions.points.length-1} value={Math.round((safeOptions.points[selectedPoint]?.[i]??0)*100)/100} onChange={e=>coordinate(i,Number(e.target.value))}/></label>)}</div>

    </fieldset>
    {!!cuttingCandidates.length&&<fieldset id="sc-opening-controls" ref={openingSection} tabIndex={-1} className="sc-opening-controls"><legend>{routeText.openings}</legend>
     <p className="sc-info">{routeText.choose}</p>
     {cuttingCandidates.map(brush=>{
       const disallowed=!canCut(brush);
       return <label key={brush.id} className="sc-cut-label" data-selected={selectedObstacleId===brush.id}><input type="checkbox" checked={cutIds.includes(brush.id)} disabled={disallowed||(!cutIds.includes(brush.id)&&cutIds.length>=4)} onChange={e=>changeCut(brush.id,e.target.checked)}/><span>{brush.editorAlias||brush.name} · {brush.id.slice(0,7)}{disallowed?' · ×':''}</span></label>;
     })}
     <p className="sc-info">{routeText.unsupported}</p>
     {!!cutIds.length&&<p className="sc-info">{routeText.cutConfirm}</p>}
     {!!cutPreview.cuts.length&&<strong className="sc-opening-count">{routeText.cutPreview}: {cutPreview.cuts.length} brushes → {cutPreview.cuts.reduce((n,c)=>n+c.fragments.length,0)} partes</strong>}
    </fieldset>}
    {selectedObstacleId&&<div className="sc-obstacle-focus"><strong>{plus.focus}</strong><span>{obstacles.find(box=>box.id===selectedObstacleId)?.name||selectedObstacleId}</span>{cuttingCandidates.some(b=>b.id===selectedObstacleId&&canCut(b))&&<button type="button" disabled={!cutIds.includes(selectedObstacleId)&&cutIds.length>=4} onClick={()=>changeCut(selectedObstacleId,!cutIds.includes(selectedObstacleId))}><Layers3 size={14}/>{cutIds.includes(selectedObstacleId)?plus.undo:plus.select}</button>}</div>}
    {activeRecord&&<p className="sc-info">{l.edit}</p>}
    <p className="sc-info">{l.detail}</p>
   </div><div className="sc-previews">
    <div className="sc-plans"><PlanView points={safeOptions.points} view="xy" label={l.plan} selected={selectedPoint} onSelect={setSelectedPoint} onMove={movePoint} onStartDrag={recordStep} limit={limit} obstacles={obstacles}/><PlanView points={safeOptions.points} view="xz" label={l.elev} selected={selectedPoint} onSelect={setSelectedPoint} onMove={movePoint} onStartDrag={recordStep} limit={limit} obstacles={obstacles}/></div>
    <div className="sc-preview-head">{l.preview}{preview.result&&<small>{preview.result.brushes.length} brushes · {preview.result.stations.length} stations</small>}</div>
    {from&&to?<Preview3D from={from} to={to} brushes={preview.result?.brushes??[]} points={safeOptions.points} obstacles={obstacles} openings={cutPreview.cuts} onFromFace={index=>{recordStep();setFromFace(index)}} onToFace={index=>{recordStep();setToFace(index)}} selectedPoint={selectedPoint} onSelectPoint={setSelectedPoint} onMovePoint={movePoint} onBeginMove={recordStep} onInsertPoint={addAt} collidingIds={remainingCollisions} selectedObstacleId={selectedObstacleId} onObstacleClick={selectObstacle}/>:<div className="sc-no-preview">{preview.error||l.empty}</div>}
   </div></div>
   {invalidOriginal&&<div className="sc-alert">{l.broken}</div>}
   {(error||preview.error)&&<div className="sc-alert">{error||preview.error}</div>}
   {!!cutPreview.error&&<div className="sc-alert">{routeText.cutError}: {cutPreview.error}</div>}
   {!!remainingCollisions.length&&<div className="sc-alert">{routeText.left}: {remainingCollisions.length} brush(es). <label><input type="checkbox" checked={allowCollisions} onChange={e=>{recordStep();setAllowCollisions(e.target.checked)}}/>{l.confirm}</label></div>}
   {preview.result?.warnings.filter(w=>!w.startsWith('Path possibly')).map(w=><div className="sc-info" key={w}>{w}</div>)}
   <footer className="sc-footer"><button onClick={onClose}>{l.cancel}</button><button className="sc-primary" onClick={commit} disabled={!preview.result||invalidOriginal||!!preview.error||!!cutPreview.error||remainingCollisions.length>0&&!allowCollisions}><Check size={16}/>{activeRecord?l.update:l.create}</button></footer>
  </section>
 </div>;
}
