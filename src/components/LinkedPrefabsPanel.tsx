/** HF15: contained inside the existing Prefab Studio; no new workspace or editor mode. */
import {useMemo,useState} from 'react';
import {Boxes,Link2,Link2Off,Copy,RefreshCw} from 'lucide-react';
import {useEditor} from '../store';
import {planLinkedPrefabSync,type LinkedPrefabPreview,type LinkedPrefabRecord} from '../engine/linkedPrefabs';
import type {Locale} from '../i18n';

type Word={title:string;info:string;name:string;create:string;none:string;source:string;copies:string;place:string;copy:string;update:string;include:string;preview:string;apply:string;detach:string;detachCopy:string;selectSource:string;offset:string;rot:string;warning:string;confirm:string;done:string;move:string;objects:string;added:string;removed:string;overwritten:string;auto:string};
const W:Record<Locale,Word>={
 es:{title:'Instancias vinculadas · HF15',info:'Seleccioná brushes/entidades en MAP y convertí la selección en un original vinculado. Editá el original y sincronizá las copias cuando decidas. Se guardan dentro del proyecto.',name:'Nombre',create:'Vincular selección actual',none:'Todavía no hay instancias vinculadas.',source:'Original',copies:'Copias',place:'Crear copia',copy:'Seleccionar copia',update:'Sincronizar cambios',include:'Tomar selección actual como nuevo original (permite sumar/quitar piezas del vínculo)',preview:'Previsualizar actualización',apply:'Confirmar y actualizar copias',detach:'Desvincular todas',detachCopy:'Desvincular copia',selectSource:'Seleccionar original',offset:'Coordenadas de nueva copia',rot:'Rotación Z',warning:'Actualizar copias reemplaza sus modificaciones individuales. Las piezas descartadas del original no se borran: quedan independientes. Si falta una pieza de una copia, desvinculala primero.',confirm:'¿Desvincular sin borrar la geometría del MAP?',done:'Actualización aplicada. Podés deshacerla con Ctrl+Z.',move:'Aplicar posición a copia',objects:'objetos',added:'nuevos',removed:'retirados',overwritten:'actualizados',auto:'La sincronización no es automática durante el arrastre para evitar cambios inesperados.'},
 en:{title:'Linked instances · HF15',info:'Select MAP brushes/entities to create a linked source. Edit the source and explicitly synchronize copies. Links are stored in the project.',name:'Name',create:'Link current selection',none:'No linked instances yet.',source:'Source',copies:'Copies',place:'Create copy',copy:'Select copy',update:'Synchronize edits',include:'Use current selection as new source (add/remove linked parts)',preview:'Preview update',apply:'Confirm and update copies',detach:'Unlink all',detachCopy:'Unlink copy',selectSource:'Select source',offset:'New copy coordinates',rot:'Z rotation',warning:'Updating replaces individual changes to copies. Removed source parts remain as independent geometry. Detach incomplete copies first.',confirm:'Unlink without deleting MAP geometry?',done:'Update applied. You can undo with Ctrl+Z.',move:'Apply copy placement',objects:'objects',added:'added',removed:'removed',overwritten:'updated',auto:'Synchronization is not automatic during drag, to prevent accidental changes.'},
 ru:{title:'Связанные экземпляры · HF15',info:'Выберите объекты MAP для создания источника. Изменения копий применяются только после подтверждения.',name:'Название',create:'Связать выделение',none:'Связанных экземпляров нет.',source:'Источник',copies:'Копии',place:'Создать копию',copy:'Выбрать копию',update:'Синхронизировать',include:'Использовать текущее выделение как источник',preview:'Предпросмотр',apply:'Подтвердить обновление',detach:'Отвязать все',detachCopy:'Отвязать копию',selectSource:'Выбрать источник',offset:'Координаты копии',rot:'Вращение Z',warning:'Изменения отдельных копий будут заменены. Удалённые из источника детали останутся в MAP.',confirm:'Отвязать без удаления геометрии?',done:'Обновлено. Ctrl+Z для отмены.',move:'Изменить положение копии',objects:'объектов',added:'добавлено',removed:'убрано',overwritten:'обновлено',auto:'Автоматическая синхронизация при перемещении отключена.'},
 ko:{title:'연결된 인스턴스 · HF15',info:'MAP 오브젝트를 선택하여 원본을 만들고 변경 사항을 확인 후 복사본에 동기화합니다.',name:'이름',create:'선택 항목 연결',none:'연결된 인스턴스 없음',source:'원본',copies:'복사본',place:'복사본 만들기',copy:'복사본 선택',update:'동기화',include:'현재 선택 항목을 새 원본으로 사용',preview:'변경 미리보기',apply:'확인 후 업데이트',detach:'모두 연결 해제',detachCopy:'복사본 연결 해제',selectSource:'원본 선택',offset:'복사본 좌표',rot:'Z 회전',warning:'복사본의 개별 편집은 덮어씌워집니다. 연결 해제 시 MAP 지오메트리는 유지됩니다.',confirm:'지오메트리를 유지하고 연결을 해제할까요?',done:'업데이트됨. Ctrl+Z 실행 취소.',move:'복사본 위치 적용',objects:'오브젝트',added:'추가',removed:'제거',overwritten:'수정',auto:'드래그 중 자동 동기화는 사용하지 않습니다.'},
 zh:{title:'关联实例 · HF15',info:'选中 MAP 物体建立源，编辑源后确认同步副本，关联关系保存在项目中。',name:'名称',create:'关联当前选择',none:'暂无关联实例',source:'原始对象',copies:'副本',place:'创建副本',copy:'选择副本',update:'同步修改',include:'使用当前选择作为新源',preview:'预览更新',apply:'确认更新副本',detach:'全部取消关联',detachCopy:'取消副本关联',selectSource:'选择源',offset:'副本坐标',rot:'Z 旋转',warning:'同步将覆盖副本的单独修改，取消关联不删除 MAP 物体。',confirm:'取消关联但保留几何体？',done:'已更新，可 Ctrl+Z 撤销。',move:'应用副本位置',objects:'物体',added:'新增',removed:'移除',overwritten:'更新',auto:'拖动时不自动同步，避免误修改。'},
 pt:{title:'Instâncias vinculadas · HF15',info:'Selecione objetos MAP para criar a origem. Edite e sincronize as cópias com confirmação. Os vínculos ficam no projeto.',name:'Nome',create:'Vincular seleção',none:'Ainda não há instâncias vinculadas.',source:'Original',copies:'Cópias',place:'Criar cópia',copy:'Selecionar cópia',update:'Sincronizar',include:'Usar seleção atual como nova origem',preview:'Pré-visualizar',apply:'Confirmar atualização',detach:'Desvincular todas',detachCopy:'Desvincular cópia',selectSource:'Selecionar origem',offset:'Coordenadas da cópia',rot:'Rotação Z',warning:'Alterações individuais nas cópias serão substituídas. A geometria desvinculada será preservada.',confirm:'Desvincular sem apagar a geometria?',done:'Atualizado. Desfazer com Ctrl+Z.',move:'Aplicar posição à cópia',objects:'objetos',added:'adicionados',removed:'removidos',overwritten:'atualizados',auto:'Não há sincronização automática durante movimentos.'}
};
const style={display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'} as const;
// Stable snapshot for projects created before HF15. Creating [] inside the Zustand
// selector makes React 19's useSyncExternalStore re-render indefinitely.
const EMPTY_LINKED_PREFABS: readonly LinkedPrefabRecord[] = Object.freeze([]);
export function LinkedPrefabsPanel(){
  const locale=useEditor(s=>s.locale);const w=W[locale]??W.en;
  const records=useEditor(s=>s.project.linkedPrefabs)??EMPTY_LINKED_PREFABS;
  const objects=useEditor(s=>s.project.objects);
  const selectedIds=useEditor(s=>s.selectedIds);
  const [name,setName]=useState('Prefab vinculado');
  const [active,setActive]=useState<string|null>(null);
  const [at,setAt]=useState<[number,number,number]>([128,0,0]);
  const [yaw,setYaw]=useState(0);
  const [adopt,setAdopt]=useState(false);
  const [preview,setPreview]=useState<LinkedPrefabPreview|null>(null);
  const [previewBaseline,setPreviewBaseline]=useState('');
  const [notice,setNotice]=useState('');
  const current=records.find(r=>r.id===active)??records[0];
  const source=useMemo(()=>current?.sourceIds.map(id=>objects.find(o=>o.id===id)).filter((o):o is NonNullable<typeof o>=>!!o)??[],[current,objects]);
  const run=(fn:()=>void):boolean=>{try{fn();setNotice('');setPreview(null);return true}catch(e){setNotice(String(e));return false}};
  const selectIds=(ids:string[])=>{useEditor.getState().setSelected(ids[0]??null);if(ids.length>1)for(const id of ids.slice(1))useEditor.getState().selectObject(id,true);};
  const newLink=()=>run(()=>{useEditor.getState().createLinkedFromSelection(name);const r=useEditor.getState().project.linkedPrefabs?.at(-1);setActive(r?.id??null);if(r)setAt([r.template.origin[0]+128,...r.template.origin.slice(1)] as [number,number,number]);});
  const createCopy=()=>{if(!current)return;run(()=>{useEditor.getState().placeLinkedCopy(current.id,at,yaw)})};
  const makePreview=()=>{if(!current)return;try{const p=planLinkedPrefabSync(useEditor.getState().project,current.id,adopt?selectedIds:undefined);setPreview(p);setPreviewBaseline(JSON.stringify(useEditor.getState().project));setNotice('')}catch(e){setPreview(null);setNotice(String(e))}};
  const apply=()=>{if(!current||!preview||preview.linkId!==current.id)return;const ok=run(()=>{
    if(JSON.stringify(useEditor.getState().project)!==previewBaseline)throw Error('The MAP changed after preview. Preview again.');
    useEditor.getState().syncLinked(current.id,preview.selectionIds);
  });if(ok)setNotice(w.done)};
  const inputStyle={width:84,maxWidth:'100%'};
  return <details className="hf15-linked"><summary><Link2 size={16}/>{w.title} · {records.length}</summary><section aria-label={w.title} style={{border:'1px solid var(--border-color, #51687d)',borderRadius:8,padding:12,display:'grid',gap:10,marginTop:12,minWidth:0}}>
    <strong style={style}><Boxes size={16}/>{w.title}</strong><small>{w.info}</small>
    <div style={style}><label>{w.name} <input maxLength={64} value={name} onChange={e=>setName(e.target.value)} style={{maxWidth:180}}/></label><button type="button" disabled={!selectedIds.length} onClick={newLink}><Link2 size={14}/>{w.create}</button></div>
    {!records.length&&<small>{w.none}</small>}
    {records.length>0&&<div style={style}><select aria-label={w.title} value={current?.id??''} onChange={e=>{setActive(e.target.value);setPreview(null)}}>{records.map(r=><option key={r.id} value={r.id}>{r.name} · {r.instances.length} {w.copies}</option>)}</select><button type="button" onClick={()=>current&&selectIds(current.sourceIds)}>{w.selectSource}</button></div>}
    {current&&<>
      <small>{w.source}: {source.length}/{current.sourceIds.length} {w.objects}. {w.copies}: {current.instances.length}</small>
      <div style={style}><span>{w.offset}:</span>{at.map((v,i)=><label key={i}>{['X','Y','Z'][i]} <input type="number" step="16" value={v} onChange={e=>setAt(old=>old.map((n,j)=>j===i?Number(e.target.value):n) as [number,number,number])} style={inputStyle}/></label>)}<label>{w.rot}: <select value={yaw} onChange={e=>setYaw(Number(e.target.value))}>{[0,90,180,270].map(n=><option key={n} value={n}>{n}°</option>)}</select></label><button type="button" onClick={createCopy}><Copy size={14}/>{w.place}</button></div>
      <div style={style}>{current.instances.map((i,n)=><span key={i.id} style={style}><button type="button" onClick={()=>{selectIds(Object.values(i.memberIds));setAt([...i.anchor]);setYaw(i.yaw);setPreview(null)}}>{w.copy} {n+1}</button><button type="button" title={w.move} onClick={()=>{if(window.confirm(w.warning))run(()=>useEditor.getState().repositionLinkedCopy(current.id,i.id,at,yaw))}}>{w.move}</button><button type="button" title={w.detachCopy} onClick={()=>{if(window.confirm(w.confirm))run(()=>useEditor.getState().detachLinked(current.id,i.id))}}><Link2Off size={13}/></button></span>)}</div>
      <label style={style}><input type="checkbox" checked={adopt} onChange={e=>{setAdopt(e.target.checked);setPreview(null)}}/>{w.include}</label>
      <div style={style}><button type="button" onClick={makePreview}><RefreshCw size={14}/>{w.preview}</button><button type="button" onClick={()=>{if(window.confirm(w.confirm))run(()=>useEditor.getState().detachLinked(current.id))}}><Link2Off size={14}/>{w.detach}</button></div>
      {preview&&<div role="status" style={{display:'grid',gap:7,padding:9,border:'1px solid var(--border-color, #51687d)',borderRadius:7}}><strong>{w.update}: {preview.instances} {w.copies}</strong><span>{preview.updated} {w.overwritten} · {preview.added} {w.added} · {preview.removed} {w.removed}</span><small>{w.warning}</small><button type="button" onClick={apply}>{w.apply}</button></div>}
      <small>{w.auto}</small>
    </>}
    {notice&&<div role="alert" className="pfstudio-status">{notice}</div>}
  </section></details>;
}
