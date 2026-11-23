import {CheckCircle2,ShieldCheck,AlertTriangle,X} from 'lucide-react';
import {useEditor} from '../store';
import {inspectCS16Project} from '../engine/gameProfiles';

const TX:Record<string,{title:string;desc:string;ct:string;tt:string;issues:string;ok:string;foot:string;close:string}>= {
 es:{title:'Auditoría de mapa CS 1.6',desc:'Comprobación preventiva para GoldSrc clásico. No ejecuta el motor de CS ni garantiza una compilación sin errores.',ct:'Apariciones CT',tt:'Apariciones TT',issues:'Avisos de compatibilidad',ok:'No se detectaron los problemas básicos verificados.',foot:'Los FGD y la compilación ZHLT son la referencia; probá el BSP dentro de Counter-Strike 1.6.',close:'Cerrar'},
 en:{title:'CS 1.6 map audit',desc:'Preflight checks for classic GoldSrc. Does not execute the CS engine or guarantee compilation.',ct:'CT spawns',tt:'T spawns',issues:'Compatibility warnings',ok:'No basic compatibility problems detected.',foot:'FGD and ZHLT output are authoritative; test the BSP in Counter-Strike 1.6.',close:'Close'},
 ru:{title:'Проверка карты CS 1.6',desc:'Предварительная проверка GoldSrc; не эмулирует игру.',ct:'CT спавны',tt:'T спавны',issues:'Предупреждения',ok:'Основных ошибок не найдено.',foot:'Проверьте BSP в Counter-Strike 1.6 после ZHLT.',close:'Закрыть'},
 ko:{title:'CS 1.6 맵 검사',desc:'GoldSrc 사전 검사입니다. 실제 게임 동작을 보장하지 않습니다.',ct:'CT 스폰',tt:'T 스폰',issues:'호환성 경고',ok:'기본 문제가 발견되지 않았습니다.',foot:'ZHLT 빌드 후 CS 1.6 게임에서 BSP를 확인하세요.',close:'닫기'},
 zh:{title:'CS 1.6 地图检查',desc:'GoldSrc 预检查，不模拟游戏运行。',ct:'CT 出生点',tt:'T 出生点',issues:'兼容性警告',ok:'未发现基本问题。',foot:'请使用 ZHLT 编译并在 CS 1.6 中测试 BSP。',close:'关闭'},
 pt:{title:'Auditoria de mapa CS 1.6',desc:'Verificação prévia GoldSrc, sem simular o jogo.',ct:'Spawns CT',tt:'Spawns TR',issues:'Avisos de compatibilidade',ok:'Nenhum problema básico identificado.',foot:'Teste o BSP no Counter-Strike 1.6 após compilar com ZHLT.',close:'Fechar'}
};
export function CS16CompatibilityStudio({onClose}:{onClose:()=>void}){
 const locale=useEditor(s=>s.locale),project=useEditor(s=>s.project);
 const tx=TX[locale]||TX.en,issues=inspectCS16Project(project);
 const count=(classname:string)=>project.objects.filter(o=>o.kind==='entity'&&o.classname===classname).length;
 return <div className="modal-backdrop" onMouseDown={onClose}><section className="map-doctor" role="dialog" aria-modal="true" aria-label={tx.title} onMouseDown={e=>e.stopPropagation()}>
  <header><ShieldCheck size={22}/><strong>{tx.title} · GoldSrc</strong><button title={tx.close} onClick={onClose}><X size={18}/></button></header>
  <p>{tx.desc}</p>
  <div className="map-doctor-stats"><span>{count('info_player_start')} {tx.ct}</span><span>{count('info_player_deathmatch')} {tx.tt}</span><span>{count('func_bomb_target')+count('info_bomb_target')} bomb</span><span>{project.objects.filter(o=>o.kind==='brush').length} brushes</span></div>
  <strong className="doctor-section-title">{tx.issues} ({issues.length})</strong>
  <div className="map-doctor-issues">{issues.length?issues.map((issue,i)=><div className="map-doctor-issue warning" key={`${issue.code}-${i}`}><AlertTriangle size={16}/><span><strong>{issue.code}</strong><small>{issue.message}</small></span></div>):<p><CheckCircle2 size={16}/> {tx.ok}</p>}</div>
  <p>{tx.foot}</p><footer><button onClick={onClose}>{tx.close}</button></footer>
 </section></div>;
}
