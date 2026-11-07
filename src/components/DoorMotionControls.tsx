import {useEffect,useState} from 'react';
import {ArrowDown,ArrowRight,ArrowUp,AlertTriangle} from 'lucide-react';
import {useEditor} from '../store';
import {readDoorOrientation,withDoorDirection,type DoorDirection} from '../engine/doorDirection';
import type {PointEntity} from '../engine/types';
import type {Locale} from '../i18n';

const words:Record<Locale,{heading:string;direction:string;up:string;down:string;horizontal:string;speed:string;wait:string;lip:string;tip:string;conflict:string;expert:string;stay:string;sec:string;travel:string;chosen:string}>={
 es:{heading:'Movimiento de la puerta',direction:'Dirección de apertura',up:'Subir',down:'Bajar',horizontal:'Horizontal',speed:'Velocidad (unidades/s)',wait:'Cerrar después de (segundos)',lip:'Recorte del recorrido (unidades)',tip:'Estos ajustes cambian la dirección real de func_door en el MAP (angles). Para ver la puerta moverse, activala con un botón y probá en el juego o Gameplay Test.',conflict:'Este proyecto tiene angle y angles contradictorios. Elegí una dirección para unificarlos.',expert:'Keyvalue nativo: angles',stay:'−1 = permanecer abierta',sec:'0 = cerrar inmediatamente',travel:'El valor lip reduce la distancia de desplazamiento.',chosen:'Dirección configurada:'},
 en:{heading:'Door movement',direction:'Opening direction',up:'Up',down:'Down',horizontal:'Horizontal',speed:'Speed (units/s)',wait:'Close after (seconds)',lip:'Travel inset (units)',tip:'These controls write the native func_door angles key. To see actual movement, trigger the door and test in the game or Gameplay Test.',conflict:'This project contains conflicting angle and angles values. Choose a direction to normalize them.',expert:'Native keyvalue: angles',stay:'−1 = stay open',sec:'0 = close immediately',travel:'The lip value subtracts from movement distance.',chosen:'Configured direction:'},
 ru:{heading:'Движение двери',direction:'Направление',up:'Вверх',down:'Вниз',horizontal:'Горизонтально',speed:'Скорость',wait:'Задержка закрытия',lip:'Отступ движения',tip:'Параметры сохраняются в angles. Проверьте действие двери после активации в игре.',conflict:'angle и angles противоречат друг другу. Выберите направление.',expert:'Параметр: angles',stay:'−1 = оставить открытой',sec:'0 = сразу закрыть',travel:'lip уменьшает путь.',chosen:'Выбрано:'},
 ko:{heading:'문 이동',direction:'열리는 방향',up:'위',down:'아래',horizontal:'수평',speed:'속도',wait:'닫기 지연',lip:'이동 거리 조정',tip:'angles 속성에 저장됩니다. 게임에서 버튼을 눌러 동작을 확인하세요.',conflict:'angle 과 angles 가 충돌합니다. 방향을 다시 선택하세요.',expert:'기본 속성: angles',stay:'−1 = 열린 상태 유지',sec:'0 = 즉시 닫기',travel:'lip은 이동 거리를 줄입니다.',chosen:'설정된 방향:'},
 zh:{heading:'门的移动',direction:'开启方向',up:'向上',down:'向下',horizontal:'水平',speed:'速度',wait:'关闭延时',lip:'行程缩减',tip:'这些设置写入 angles。请在游戏中触发门以测试移动。',conflict:'angle 和 angles 冲突，请重新选择方向。',expert:'原生属性: angles',stay:'−1 = 保持打开',sec:'0 = 立即关闭',travel:'lip 减少移动距离。',chosen:'当前方向：'},
 pt:{heading:'Movimento da porta',direction:'Direção de abertura',up:'Subir',down:'Descer',horizontal:'Horizontal',speed:'Velocidade',wait:'Fechar após (segundos)',lip:'Redução do percurso',tip:'Essas opções gravam o angles nativo. Ative a porta e teste no jogo.',conflict:'angle e angles entram em conflito. Escolha uma direção.',expert:'Keyvalue nativo: angles',stay:'−1 = permanecer aberta',sec:'0 = fechar imediatamente',travel:'lip reduz a distância.',chosen:'Direção definida:'},
};
function NumberField({entity,keyName,label,helper,defaultValue}:{entity:PointEntity;keyName:'speed'|'wait'|'lip';label:string;helper?:string;defaultValue:string}){
 const save=useEditor(s=>s.setObjectProp);
 const value=entity.props[keyName]??defaultValue;
 const [draft,setDraft]=useState(value);
 useEffect(()=>setDraft(value),[value,entity.id]);
 const commit=()=>{if(draft===value)return;const n=Number(draft);if(draft.trim()!==''&&Number.isFinite(n))save(entity.id,keyName,String(n));else setDraft(value)};
 return <label className="door-motion-field"><span>{label}</span><input type="number" step="any" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')e.currentTarget.blur()}} aria-label={label}/>{helper&&<small>{helper}</small>}</label>;
}
export function DoorMotionControls({entity,compact=false}:{entity:PointEntity;compact?:boolean}){
 const locale=useEditor(s=>s.locale) as Locale,tx=words[locale]||words.en;
 const update=useEditor(s=>s.updateObject);
 const orientation=readDoorOrientation(entity.props);
 const choose=(direction:DoorDirection)=>{
  const yaw=orientation.direction==='horizontal'?orientation.yaw:0;
  update(entity.id,{props:withDoorDirection(entity.props,direction,yaw)});
 };
 return <section className={`door-motion-controls${compact?' compact':''}`} aria-label={tx.heading}>
  <strong className="door-motion-heading">{tx.heading}</strong>
  <p className="door-motion-label">{tx.direction}</p>
  <div className="door-motion-directions" role="group" aria-label={tx.direction}>
   <button type="button" className={orientation.direction==='up'?'active':''} aria-pressed={orientation.direction==='up'&&!orientation.conflict} onClick={()=>choose('up')}><ArrowUp size={15}/>{tx.up}</button>
   <button type="button" className={orientation.direction==='down'?'active':''} aria-pressed={orientation.direction==='down'&&!orientation.conflict} onClick={()=>choose('down')}><ArrowDown size={15}/>{tx.down}</button>
   <button type="button" className={orientation.direction==='horizontal'?'active':''} aria-pressed={orientation.direction==='horizontal'&&!orientation.conflict} onClick={()=>choose('horizontal')}><ArrowRight size={15}/>{tx.horizontal}</button>
  </div>
  <p className="door-motion-status" role="status">{tx.chosen} <strong>{orientation.direction==='up'?tx.up:orientation.direction==='down'?tx.down:tx.horizontal}</strong> · <code>{orientation.direction==='up'?'0 -1 0':orientation.direction==='down'?'0 -2 0':`0 ${orientation.yaw} 0`}</code></p>
  {orientation.conflict&&<p className="door-motion-warning"><AlertTriangle size={14}/>{tx.conflict}</p>}
  {orientation.direction==='horizontal'&&<label className="door-motion-field"><span>Yaw °</span><select value={[0,90,180,270].includes(orientation.yaw)?String(orientation.yaw):'custom'} onChange={e=>{if(e.target.value!=='custom')update(entity.id,{props:withDoorDirection(entity.props,'horizontal',Number(e.target.value))})}}><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option>{![0,90,180,270].includes(orientation.yaw)&&<option value="custom">{orientation.yaw}°</option>}</select></label>}
  <div className="door-motion-numbers">
   <NumberField entity={entity} keyName="speed" label={tx.speed} defaultValue="100"/>
   <NumberField entity={entity} keyName="wait" label={tx.wait} defaultValue="3" helper={tx.stay}/>
   <NumberField entity={entity} keyName="lip" label={tx.lip} defaultValue="8" helper={tx.travel}/>
  </div>
  <small className="door-motion-native">{tx.expert}: <code>{orientation.conflict?`${entity.props.angles} / angle=${entity.props.angle}`:entity.props.angles||`0 ${orientation.yaw} 0`}</code></small>
  {!compact&&<p className="door-motion-note">{tx.tip}</p>}
 </section>;
}
