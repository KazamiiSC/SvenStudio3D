import {useCallback,useEffect,useState} from 'react';
import {Archive,History,RefreshCw,RotateCcw,ShieldCheck,Save,X} from 'lucide-react';
import type {Project} from '../engine/types';
import {useEditor} from '../store';
import {checkpointBeforeImport} from '../engine/sessionManager';
import {compareHistoryProjects,listProjectHistory,openHistoryCheckpoint,saveHistoryCheckpoint,type HistoryEntry,type HistoryDiff} from '../engine/projectHistory';
import './projectHistory.css';
const WORDS={
 es:{title:'Historial y recuperación del proyecto',description:'Versiones independientes guardadas en Documentos/SvenStudio3D/Projects/History. No cambia el autoguardado del navegador ni instala archivos en el juego.',name:'Nombre del punto de restauración',placeholder:'Ej.: Antes de modificar las escaleras',create:'Crear punto',refresh:'Actualizar',current:'Solo mapa actual',all:'Todos los mapas',loading:'Leyendo versiones…',empty:'Todavía no hay versiones guardadas.',manual:'Manual',auto:'Automático',safety:'Antes de restaurar',compare:'Comparar',restore:'Restaurar',close:'Cerrar',objects:'objetos',added:'Añadidos',removed:'Eliminados',modified:'Modificados',unchanged:'Sin cambios',world:'Claves del mundo modificadas',compareHint:'Diferencias entre el mapa actual y la versión elegida (por ID de objeto).',confirm:'Se restaurará esta versión y se reemplazará el mapa actual. Primero se guardará una copia de seguridad del mapa abierto. ¿Continuar?',error:'No se pudo completar la operación',saved:'Punto de restauración guardado.',restored:'Proyecto restaurado. El MAP original en Documentos no fue sobrescrito.',mustSave:'No se puede crear un respaldo anterior. La restauración fue cancelada para proteger el mapa actual.',size:'Tamaño original',note:'Los respaldos automáticos se crean después de modificaciones, aproximadamente cada 10 minutos; se conservan los últimos 20 por nombre de mapa. Los manuales y previos a restauración nunca se eliminan automáticamente.',notResources:'Los WAD, MDL y sonidos externos no se incluyen en los puntos de restauración.'},
 en:{title:'Project History & Recovery',description:'Independent versions stored in Documents/SvenStudio3D/Projects/History. Browser autosave remains unchanged; nothing is installed in the game.',name:'Checkpoint name',placeholder:'E.g. Before modifying stairs',create:'Create checkpoint',refresh:'Refresh',current:'Current map only',all:'All maps',loading:'Loading versions…',empty:'No checkpoints saved yet.',manual:'Manual',auto:'Automatic',safety:'Before restore',compare:'Compare',restore:'Restore',close:'Close',objects:'objects',added:'Added',removed:'Removed',modified:'Modified',unchanged:'Unchanged',world:'World keys changed',compareHint:'Changes between the current map and this version (using object IDs).',confirm:'Restore this version and replace the current map? A safety checkpoint of the current map will be created first.',error:'Operation failed',saved:'Checkpoint saved.',restored:'Project restored. Existing MAP files in Documents were not overwritten.',mustSave:'Unable to create a safety checkpoint. Restoration was cancelled to protect your current map.',size:'Original size',note:'Automatic checkpoints are created after editing, approximately every 10 minutes. The last 20 are kept per map name. Manual and pre-restore checkpoints are never automatically deleted.',notResources:'External WAD, MDL, and sound files are not embedded in checkpoints.'},
 ru:{title:'История и восстановление проекта',description:'Независимые версии в Documents/SvenStudio3D/Projects/History. Автосохранение браузера не меняется.',name:'Название точки восстановления',placeholder:'Например: до изменения лестницы',create:'Создать точку',refresh:'Обновить',current:'Только текущая карта',all:'Все карты',loading:'Загрузка версий…',empty:'Пока нет сохранённых версий.',manual:'Вручную',auto:'Автоматически',safety:'Перед восстановлением',compare:'Сравнить',restore:'Восстановить',close:'Закрыть',objects:'объектов',added:'Добавлено',removed:'Удалено',modified:'Изменено',unchanged:'Без изменений',world:'Изменённых ключей мира',compareHint:'Разница между текущей картой и сохранённой версией (по ID объектов).',confirm:'Заменить текущую карту этой версией? Сначала будет создана резервная копия.',error:'Ошибка операции',saved:'Точка сохранена.',restored:'Проект восстановлен. Файлы MAP не перезаписаны.',mustSave:'Не удалось создать резервную копию. Восстановление отменено.',size:'Размер',note:'Автоматические копии создаются примерно каждые 10 минут после изменений. Хранятся последние 20 на имя карты. Ручные копии не удаляются.',notResources:'Внешние WAD, MDL и звуки не включены.'},
 ko:{title:'프로젝트 기록 및 복구',description:'Documents/SvenStudio3D/Projects/History에 독립 버전을 저장합니다. 브라우저 자동 저장은 유지됩니다.',name:'복원 지점 이름',placeholder:'예: 계단 수정 전',create:'복원 지점 만들기',refresh:'새로 고침',current:'현재 맵만',all:'모든 맵',loading:'버전 불러오는 중…',empty:'저장된 복원 지점이 없습니다.',manual:'수동',auto:'자동',safety:'복원 전 백업',compare:'비교',restore:'복원',close:'닫기',objects:'오브젝트',added:'추가',removed:'삭제',modified:'수정',unchanged:'변경 없음',world:'변경된 월드 키',compareHint:'현재 맵과 이 버전의 오브젝트 ID 기준 차이입니다.',confirm:'현재 맵을 이 버전으로 바꿀까요? 먼저 안전 백업을 만듭니다.',error:'작업 실패',saved:'복원 지점을 저장했습니다.',restored:'프로젝트를 복원했습니다. 기존 MAP 파일은 덮어쓰지 않았습니다.',mustSave:'안전 백업을 만들 수 없어 복원을 취소했습니다.',size:'원본 크기',note:'변경 후 약 10분마다 자동 기록하며 맵 이름당 최근 20개를 보관합니다. 수동 복원 지점은 자동으로 삭제하지 않습니다.',notResources:'외부 WAD, MDL 및 사운드는 포함되지 않습니다.'},
 zh:{title:'项目历史与恢复',description:'独立版本保存在 Documents/SvenStudio3D/Projects/History；浏览器自动保存保持不变。',name:'还原点名称',placeholder:'例如：修改楼梯之前',create:'创建还原点',refresh:'刷新',current:'仅当前地图',all:'全部地图',loading:'正在加载版本…',empty:'尚无保存的版本。',manual:'手动',auto:'自动',safety:'恢复前备份',compare:'比较',restore:'恢复',close:'关闭',objects:'对象',added:'新增',removed:'删除',modified:'修改',unchanged:'未更改',world:'世界属性变化',compareHint:'当前地图与所选版本的对象 ID 差异。',confirm:'用此版本替换当前地图？将先保存当前地图的安全副本。',error:'操作失败',saved:'已保存还原点。',restored:'项目已恢复；没有覆盖已有 MAP 文件。',mustSave:'无法创建安全副本；已取消恢复。',size:'原始大小',note:'地图修改后大约每 10 分钟自动保存一次，每个地图名保留最近 20 个。手动及恢复前的版本不会自动删除。',notResources:'不包含外部 WAD、MDL 和声音文件。'},
 pt:{title:'Histórico e recuperação do projeto',description:'Versões independentes em Documentos/SvenStudio3D/Projects/History. O salvamento automático do navegador continua inalterado.',name:'Nome do ponto de restauração',placeholder:'Ex.: Antes de modificar escadas',create:'Criar ponto',refresh:'Atualizar',current:'Somente mapa atual',all:'Todos os mapas',loading:'Carregando versões…',empty:'Nenhum ponto salvo ainda.',manual:'Manual',auto:'Automático',safety:'Antes da restauração',compare:'Comparar',restore:'Restaurar',close:'Fechar',objects:'objetos',added:'Adicionados',removed:'Removidos',modified:'Modificados',unchanged:'Sem mudanças',world:'Chaves do mundo alteradas',compareHint:'Diferenças entre o mapa atual e a versão (por ID de objeto).',confirm:'Restaurar esta versão e substituir o mapa atual? Um backup será criado antes.',error:'Falha na operação',saved:'Ponto salvo.',restored:'Projeto restaurado. Os arquivos MAP existentes não foram sobrescritos.',mustSave:'Não foi possível criar um backup. A restauração foi cancelada.',size:'Tamanho original',note:'Backups automáticos são criados após edições, aproximadamente a cada 10 minutos. Os últimos 20 por nome do mapa são mantidos. Backups manuais não são removidos automaticamente.',notResources:'WAD, MDL e sons externos não estão incluídos.'}
} as const;
type Words=typeof WORDS['en'];
type Props={onClose:()=>void;onRestore:(project:Project)=>void};
export function ProjectHistoryModal({onClose,onRestore}:Props){
 const locale=useEditor(s=>s.locale);
 const w=WORDS[locale] as Words;
 const currentName=useEditor(s=>s.project.name);
 const [entries,setEntries]=useState<HistoryEntry[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [filterCurrent,setFilterCurrent]=useState(true);
 const [label,setLabel]=useState('');
 const [notice,setNotice]=useState('');
 const [diff,setDiff]=useState<{id:string;result:HistoryDiff}|null>(null);
 const reload=useCallback(async()=>{
  setLoading(true);try{setEntries(await listProjectHistory());setNotice('');}catch(error){setNotice(`${w.error}: ${String(error)}`);}finally{setLoading(false)}
 },[w.error]);
 useEffect(()=>{void reload()},[reload]);
 const create=async()=>{
  if(busy)return;setBusy(true);
  try{await saveHistoryCheckpoint(useEditor.getState().project,'manual',label.trim());setLabel('');await reload();setNotice(w.saved);}
  catch(error){setNotice(`${w.error}: ${String(error)}`)}finally{setBusy(false)}
 };
 const compare=async(entry:HistoryEntry)=>{
  if(busy)return;setBusy(true);
  try{const saved=await openHistoryCheckpoint(entry.id);setDiff({id:entry.id,result:compareHistoryProjects(useEditor.getState().project,saved.project)});setNotice('');}
  catch(error){setNotice(`${w.error}: ${String(error)}`)}finally{setBusy(false)}
 };
 const restore=async(entry:HistoryEntry)=>{
  if(busy)return;setBusy(true);
  try{
   const saved=await openHistoryCheckpoint(entry.id); // Fully validate before asking or changing the editor.
   if(!window.confirm(`${w.confirm}\n\n${entry.projectName} — ${new Date(entry.createdAt).toLocaleString()}`))return;
   // Both checkpoints must succeed before making destructive changes.
   try{
    await saveHistoryCheckpoint(useEditor.getState().project,'safety',`Before restore: ${entry.projectName}`);
    await checkpointBeforeImport();
   }catch(error){throw Error(`${w.mustSave} (${String(error)})`)}
   onRestore(saved.project);
   setDiff(null);await reload();setNotice(w.restored);
  }catch(error){setNotice(`${w.error}: ${String(error)}`)}finally{setBusy(false)}
 };
 const shown=filterCurrent?entries.filter(e=>e.projectName===currentName):entries;
 return <div className="modal-backdrop project-history-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="modal-card project-history-modal" role="dialog" aria-modal="true" aria-label={w.title}>
   <div className="modal-title"><History size={20}/>{w.title}<button type="button" aria-label={w.close} onClick={onClose}><X size={20}/></button></div>
   <p className="modal-subtext">{w.description}</p>
   <div className="project-history-create"><label>{w.name}<input maxLength={120} value={label} placeholder={w.placeholder} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void create()}}/></label>
    <button className="primary-action" type="button" disabled={busy} onClick={()=>void create()}><Save size={15}/>{w.create}</button></div>
   <div className="project-history-filter"><label><input type="checkbox" checked={filterCurrent} onChange={e=>{setFilterCurrent(e.target.checked);setDiff(null)}}/>{filterCurrent?w.current:w.all}</label>
    <button type="button" className="secondary-action" disabled={busy} onClick={()=>void reload()}><RefreshCw size={14}/>{w.refresh}</button></div>
   {notice&&<p className="project-history-notice" role="status">{notice}</p>}
   <div className="project-history-list" aria-live="polite">
    {loading?<p>{w.loading}</p>:shown.length===0?<p>{w.empty}</p>:shown.map(entry=><article className="project-history-entry" key={entry.id}>
     <div className="project-history-entry-main"><strong><Archive size={15}/>{entry.label||w[entry.kind]}</strong><span>{new Date(entry.createdAt).toLocaleString()} · {entry.projectName}</span>
      <small>{w[entry.kind]} · {entry.objects} {w.objects} · {w.size}: {(entry.bytes/1024).toFixed(1)} KiB</small></div>
     <div className="project-history-entry-buttons"><button type="button" disabled={busy} onClick={()=>void compare(entry)}>{w.compare}</button><button type="button" disabled={busy} onClick={()=>void restore(entry)}><RotateCcw size={14}/>{w.restore}</button></div>
     {diff?.id===entry.id&&<div className="project-history-diff"><small>{w.compareHint}</small><div>{w.added}: <strong>{diff.result.added}</strong> · {w.removed}: <strong>{diff.result.removed}</strong> · {w.modified}: <strong>{diff.result.modified}</strong> · {w.unchanged}: <strong>{diff.result.unchanged}</strong> · {w.world}: <strong>{diff.result.worldChanges}</strong></div></div>}
    </article>)}
   </div>
   <p className="project-history-footnote"><ShieldCheck size={15}/>{w.note} {w.notResources}</p>
   <div className="modal-footer"><button type="button" onClick={onClose}>{w.close}</button></div>
  </section>
 </div>;
}
