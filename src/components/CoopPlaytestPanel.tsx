import {useMemo} from 'react';
import {Eye,EyeOff,Focus,Users,AlertTriangle,Info} from 'lucide-react';
import {useEditor} from '../store';
import {transformedVertices} from '../engine/geometry';
import type {Vec3} from '../engine/types';
import {useCoopPlaytestState} from '../coopPlaytestState';
import {analyzeCoopPlaytest,COOP_HULL,type CoopFinding} from '../engine/coopPlaytest';

const copy={
 es:{title:'Co-op Playtest Validator',intro:'Comprobación estática del MAP, sin editar objetos ni compilar. Los jugadores fantasma representan espacio, no una simulación del juego.',spawns:'Apariciones',active:'Candidatos iniciales',ghosts:'Jugadores fantasma',at:'Punto de referencia',display:'Mostrar en el visor',hide:'Ocultar del visor',select:'Enfocar',issues:'Avisos',blocked:'Intersecciones',floor:'Sin suelo cercano',clear:'Sin problemas de espacio detectados para este grupo.',none:'No hay spawns. Agregá un punto de aparición para probar un grupo.',warning:'Las puertas móviles, triggers, escaleras, hulls personalizados y las condiciones de activación requieren probar el BSP en Sven Co-op.',note:'El grupo se coloca alrededor del spawn elegido con 40 unidades entre centros; no equivale a ocho spawns ni garantiza cabida dinámica.',option:'Aparición',testSelected:'Probar sobre selección',backSpawn:'Volver al spawn',manual:'Punto manual',
  COOP_NO_SPAWNS:'No hay puntos de aparición compatibles.',COOP_DISABLED_SPAWNS:'Todos los spawns tienen Start Off; su activación depende del juego.',COOP_SINGLE_SPAWN:'Un único spawn puede reutilizarse, pero podría provocar esperas.',COOP_SPAWN_BLOCKED:'Volumen del jugador posiblemente intersecta geometría sólida.',COOP_NO_FLOOR:'No se detectó suelo cercano (aproximación).',COOP_SPAWN_OVERLAP:'Dos spawns tienen volúmenes superpuestos.',COOP_GROUP_BLOCKED:'Uno o más jugadores fantasma intersectan geometría sólida.',COOP_GROUP_NO_FLOOR:'Algunos jugadores fantasma no tienen suelo cercano (aproximación).'},
 en:{title:'Co-op Playtest Validator',intro:'Read-only MAP geometry check. Ghost players show space requirements, not actual gameplay.',spawns:'Spawn points',active:'Initial candidates',ghosts:'Ghost players',at:'Reference spawn',display:'Show in viewport',hide:'Hide from viewport',select:'Focus',issues:'Findings',blocked:'Blocked',floor:'No nearby floor',clear:'No spacing issues found for this group.',none:'No spawns found. Add a player spawn to check group space.',warning:'Moving doors, triggers, stairs, custom hulls and activation rules must be verified in Sven Co-op using a compiled BSP.',note:'Players are 40 units apart around the selected spawn; this is not eight separate spawn points or a runtime occupancy guarantee.',option:'Spawn',testSelected:'Probe selected object',backSpawn:'Back to spawn',manual:'Manual location',
  COOP_NO_SPAWNS:'No compatible player spawn points.',COOP_DISABLED_SPAWNS:'All spawns use Start Off; runtime activation is unknown.',COOP_SINGLE_SPAWN:'One spawn can be reused but may cause waiting.',COOP_SPAWN_BLOCKED:'Player standing hull might intersect solid geometry.',COOP_NO_FLOOR:'No nearby floor detected (approximation).',COOP_SPAWN_OVERLAP:'Two spawn hulls overlap.',COOP_GROUP_BLOCKED:'One or more ghost players overlap solid geometry.',COOP_GROUP_NO_FLOOR:'Some ghost positions have no nearby floor (approximation).'},
 ru:{title:'Co-op Playtest Validator',intro:'Статическая проверка MAP без изменения карты. Силуэты показывают место, но не симулируют игру.',spawns:'Точки появления',active:'Начальные кандидаты',ghosts:'Силуэты игроков',at:'Точка проверки',display:'Показать в 3D',hide:'Скрыть в 3D',select:'Перейти',issues:'Замечания',blocked:'Пересечения',floor:'Нет пола рядом',clear:'Проблемы размещения группы не обнаружены.',none:'Нет точек появления. Добавьте точку игрока.',warning:'Движущиеся двери, триггеры, лестницы, особые hull и активацию нужно проверять в Sven Co-op.',note:'Шаг между силуэтами — 40 единиц. Это не отдельные спавны и не гарантия работы в игре.',option:'Появление',testSelected:'Проверить выбранный объект',backSpawn:'Вернуться к спавну',manual:'Выбранная позиция',COOP_NO_SPAWNS:'Нет подходящих точек появления.',COOP_DISABLED_SPAWNS:'Все точки отключены при запуске.',COOP_SINGLE_SPAWN:'Одна точка может использоваться повторно, но создавать ожидание.',COOP_SPAWN_BLOCKED:'Возможно пересечение с твёрдой геометрией.',COOP_NO_FLOOR:'Пол рядом не найден (приблизительно).',COOP_SPAWN_OVERLAP:'Точки появления перекрываются.',COOP_GROUP_BLOCKED:'Силуэты пересекают твёрдую геометрию.',COOP_GROUP_NO_FLOOR:'Под некоторыми силуэтами нет пола (приблизительно).'},
 ko:{title:'Co-op Playtest Validator',intro:'MAP의 정적 공간 검사입니다. 유령 플레이어는 실제 게임 동작을 시뮬레이션하지 않습니다.',spawns:'스폰 지점',active:'초기 후보',ghosts:'유령 플레이어',at:'기준 스폰',display:'뷰포트에 표시',hide:'뷰포트에서 숨기기',select:'위치 보기',issues:'진단',blocked:'충돌',floor:'근처 바닥 없음',clear:'선택한 그룹의 공간 문제가 발견되지 않았습니다.',none:'스폰 지점이 없습니다. 플레이어 스폰을 추가하세요.',warning:'움직이는 문, 트리거, 계단, 사용자 정의 충돌 및 활성화는 게임 BSP에서 확인해야 합니다.',note:'40유닛 간격의 공간 미리보기입니다. 실제 스폰 배치나 동작을 보장하지 않습니다.',option:'스폰',testSelected:'선택한 개체 검사',backSpawn:'스폰으로 돌아가기',manual:'수동 위치',COOP_NO_SPAWNS:'호환되는 스폰 지점이 없습니다.',COOP_DISABLED_SPAWNS:'모든 스폰이 시작 시 비활성 상태입니다.',COOP_SINGLE_SPAWN:'단일 스폰은 재사용되지만 대기가 발생할 수 있습니다.',COOP_SPAWN_BLOCKED:'플레이어 공간이 구조물과 겹칠 수 있습니다.',COOP_NO_FLOOR:'가까운 바닥을 찾지 못했습니다(근사치).',COOP_SPAWN_OVERLAP:'스폰 영역이 겹칩니다.',COOP_GROUP_BLOCKED:'유령 플레이어가 구조물과 겹칩니다.',COOP_GROUP_NO_FLOOR:'일부 위치에서 바닥이 감지되지 않았습니다(근사치).'},
 zh:{title:'Co-op Playtest Validator',intro:'仅检查 MAP 静态空间，不修改地图。幽灵玩家不代表真实游戏模拟。',spawns:'出生点',active:'初始候选',ghosts:'幽灵玩家',at:'参考出生点',display:'在视口显示',hide:'在视口隐藏',select:'定位',issues:'检查结果',blocked:'碰撞',floor:'附近无地面',clear:'未发现当前队伍的空间问题。',none:'没有出生点。请添加玩家出生点。',warning:'移动门、触发器、楼梯、自定义碰撞体和激活规则必须在游戏 BSP 中验证。',note:'幽灵玩家间隔40单位；不代表多个真实出生点，也不保证游戏运行结果。',option:'出生点',testSelected:'检查所选对象',backSpawn:'返回出生点',manual:'手动位置',COOP_NO_SPAWNS:'没有兼容的出生点。',COOP_DISABLED_SPAWNS:'所有出生点启动时均关闭。',COOP_SINGLE_SPAWN:'单个出生点可重复使用，但可能造成等待。',COOP_SPAWN_BLOCKED:'玩家占用空间可能与实体几何体重叠。',COOP_NO_FLOOR:'未检测到附近地面（近似）。',COOP_SPAWN_OVERLAP:'出生点空间重叠。',COOP_GROUP_BLOCKED:'部分幽灵玩家与实体几何体重叠。',COOP_GROUP_NO_FLOOR:'部分位置没有检测到地面（近似）。'},
 pt:{title:'Co-op Playtest Validator',intro:'Verificação estática do MAP sem alterar objetos. Jogadores fantasmas mostram espaço, não simulam o jogo.',spawns:'Pontos de spawn',active:'Candidatos iniciais',ghosts:'Jogadores fantasmas',at:'Spawn de referência',display:'Mostrar na vista',hide:'Ocultar da vista',select:'Focar',issues:'Avisos',blocked:'Interseções',floor:'Sem chão próximo',clear:'Nenhum problema de espaço encontrado para o grupo.',none:'Nenhum spawn encontrado. Adicione um spawn para testar.',warning:'Portas móveis, gatilhos, escadas, hulls personalizados e ativação precisam ser testados no Sven Co-op.',note:'Os fantasmas ficam a 40 unidades de distância; não são novos spawns e não garantem o comportamento no jogo.',option:'Spawn',testSelected:'Testar sobre a seleção',backSpawn:'Voltar ao spawn',manual:'Posição manual',COOP_NO_SPAWNS:'Não há pontos de spawn compatíveis.',COOP_DISABLED_SPAWNS:'Todos os spawns começam desativados.',COOP_SINGLE_SPAWN:'Um spawn pode ser reutilizado, mas pode causar espera.',COOP_SPAWN_BLOCKED:'O volume do jogador pode intersectar geometria sólida.',COOP_NO_FLOOR:'Nenhum chão próximo encontrado (aproximação).',COOP_SPAWN_OVERLAP:'Os volumes de spawn se sobrepõem.',COOP_GROUP_BLOCKED:'Um ou mais fantasmas intersectam geometria sólida.',COOP_GROUP_NO_FLOOR:'Algumas posições não têm chão próximo (aproximação).'}
} as const;
type Lang=keyof typeof copy;
export function CoopPlaytestPanel({onClose}:{onClose:()=>void}){
 const objects=useEditor(s=>s.project.objects),project=useEditor(s=>s.project),selected=useEditor(s=>s.selected);
 const setSelected=useEditor(s=>s.setSelected),frame=useEditor(s=>s.issueCameraCommand);
 const locale=useEditor(s=>s.locale) as Lang;
 const text:Record<string,string>=copy[locale]||copy.en;
 const visible=useCoopPlaytestState(s=>s.visible),setVisible=useCoopPlaytestState(s=>s.setVisible);
 const count=useCoopPlaytestState(s=>s.count),setCount=useCoopPlaytestState(s=>s.setCount);
 const anchorId=useCoopPlaytestState(s=>s.anchorId),setAnchor=useCoopPlaytestState(s=>s.setAnchor);
 const manualAnchor=useCoopPlaytestState(s=>s.manualAnchor),setManualAnchor=useCoopPlaytestState(s=>s.setManualAnchor);
 const report=useMemo(()=>analyzeCoopPlaytest(project,count,anchorId,manualAnchor),[project,count,anchorId,manualAnchor]);
 const selectedObject=objects.find(o=>o.id===selected);
 const testSelected=()=>{
  if(!selectedObject)return;
  if(selectedObject.kind==='entity'){setManualAnchor([...selectedObject.position]);return}
  const vertices=transformedVertices(selectedObject);if(!vertices.length)return;
  const center:Vec3=[vertices.reduce((n,v)=>n+v[0],0)/vertices.length,vertices.reduce((n,v)=>n+v[1],0)/vertices.length,Math.max(...vertices.map(v=>v[2]))+COOP_HULL.standingHeight/2];
  setManualAnchor(center);
 };
 const blocked=report.ghosts.filter(g=>g.blocked).length;
 const unsupported=report.ghosts.filter(g=>!g.support).length;
 const focus=(id:string)=>{if(!objects.some(o=>o.id===id))return;setSelected(id);frame('frame');onClose()};
 return <section className="doctor-coop-panel" aria-label={text.title}>
   <strong><Users size={17}/>{text.title}</strong>
   <p>{text.intro}</p>
   <div className="map-doctor-stats"><span>{report.spawnCount} {text.spawns}</span><span>{report.activeCandidates} {text.active}</span><span>{COOP_HULL.width}×{COOP_HULL.width}×{COOP_HULL.standingHeight} u</span>{manualAnchor&&<span>{text.manual}</span>}</div>
   <div className="doctor-coop-controls">
     <label>{text.ghosts}<select value={count} onChange={e=>setCount(Number(e.target.value) as 2|4|8)}><option value={2}>2</option><option value={4}>4</option><option value={8}>8</option></select></label>
     <label>{text.at}<select value={report.anchorId||''} onChange={e=>setAnchor(e.target.value||null)} disabled={!report.spawns.length}>{!report.spawns.length&&<option value="">—</option>}{report.spawns.map((s,i)=><option key={s.id} value={s.id}>{text.option} {i+1} · {s.classname}</option>)}</select></label>
     <button onClick={testSelected} disabled={!selectedObject}>{text.testSelected}</button>
     {manualAnchor&&<button onClick={()=>setManualAnchor(null)}>{text.backSpawn}</button>}
     <button onClick={()=>setVisible(!visible)} disabled={!report.ghosts.length}>{visible?<EyeOff size={15}/>:<Eye size={15}/>} {visible?text.hide:text.display}</button>
     <button onClick={()=>{if(report.anchorId)focus(report.anchorId)}} disabled={!report.anchorId||!!manualAnchor}><Focus size={15}/>{text.select}</button>
   </div>
   {!!report.ghosts.length&&<div className="map-doctor-stats"><span>{blocked} {text.blocked}</span><span>{unsupported} {text.floor}</span></div>}
   <small>{text.note}</small>
   <strong className="doctor-section-title">{text.issues} ({report.findings.length})</strong>
   <div className="doctor-coop-findings">{report.findings.map((item:CoopFinding,index)=><button key={`${item.code}:${item.objectId||index}`} className={`map-doctor-issue ${item.severity}`} disabled={!item.objectId} onClick={()=>item.objectId&&focus(item.objectId)}>{item.severity==='warning'?<AlertTriangle size={15}/>:<Info size={15}/>}<span><strong>{item.code}</strong><small>{text[item.code]||item.message}{item.objectId?' · '+(report.spawns.find(s=>s.id===item.objectId)?.classname||''):''}</small></span></button>)}
    {!report.findings.length&&<p>{text.clear}</p>}
    {!report.spawns.length&&<p>{text.none}</p>}
   </div>
   <small>{text.warning}</small>
 </section>;
}
