/** HF16: opt-in edge-connected UV alignment. The preview reads project data
 * and makes no edits; Apply recomputes from the latest Zustand snapshot. */
import {useMemo,useState} from 'react';
import {Link2,ChevronDown,ChevronRight} from 'lucide-react';
import {useEditor} from '../store';
import {planSeamlessUV,type SeamlessUvPlan} from '../engine/seamlessUV';
import type {MapObject} from '../engine/types';
import type {TextureFaceRef} from '../engine/textureStudio';
import type {Locale} from '../i18n';

const labels={
 es:{title:'Continuidad UV',description:'Solo caras seleccionadas con un borde compartido real. Conserva la fase UV en esquinas y paredes contiguas.',option:'Copiar también la textura del origen',preview:'Vista previa',hide:'Ocultar vista previa',apply:'Aplicar continuidad',none:'Elegí al menos dos caras conectadas. La primera es la referencia.',skipped:'caras no conectadas o incompatibles',changes:'caras por modificar',aligned:'ya alineadas',reference:'Referencia',edge:'desde',before:'Error anterior',after:'nuevo',unit:'texeles',warning:'La vista previa es un resumen de los cambios UV, no una simulación de iluminación. No cambia el MAP hasta aplicar. Deshacer revierte el lote.',excess:'Demasiadas caras seleccionadas.',success:'Continuidad aplicada. Podés deshacer con Ctrl+Z.'},
 en:{title:'Seamless UV',description:'Only selected faces sharing a real edge. Preserves UV phase across corners and neighboring walls.',option:'Also copy source texture',preview:'Preview changes',hide:'Hide preview',apply:'Apply continuity',none:'Select at least two connected faces. The first is the reference.',skipped:'disconnected or incompatible faces',changes:'faces to update',aligned:'already aligned',reference:'Reference',edge:'from',before:'Previous error',after:'new',unit:'texels',warning:'The preview summarizes UV changes; it is not a lighting simulation. The MAP is unchanged until Apply. Undo reverses the batch.',excess:'Too many faces selected.',success:'Alignment applied. Ctrl+Z to undo.'},
 ru:{title:'Непрерывные UV',description:'Только выбранные грани с общей кромкой; сохраняет UV вдоль углов и соседних стен.',option:'Также копировать текстуру источника',preview:'Предпросмотр',hide:'Скрыть просмотр',apply:'Применить',none:'Выберите две или больше смежных граней. Первая — опорная.',skipped:'несвязанных/несовместимых граней',changes:'граней изменится',aligned:'уже совмещено',reference:'Опорная грань',edge:'от',before:'Ошибка до',after:'после',unit:'текселей',warning:'Просмотр показывает изменения UV, а не освещение. Изменения применяются только по кнопке. Ctrl+Z отменяет все.',excess:'Слишком много граней.',success:'Готово. Ctrl+Z отменяет.'},
 ko:{title:'연속 UV',description:'실제로 맞닿는 선택 면에만 적용합니다. 모서리의 UV 연속성을 유지합니다.',option:'원본 텍스처도 복사',preview:'변경 미리보기',hide:'미리보기 숨기기',apply:'연속 정렬 적용',none:'연결된 면을 두 개 이상 선택하세요. 첫 번째 면이 기준입니다.',skipped:'연결되지 않거나 호환되지 않는 면',changes:'수정할 면',aligned:'이미 정렬됨',reference:'기준 면',edge:'기준',before:'이전 오차',after:'새 오차',unit:'텍셀',warning:'미리보기는 UV 변경 요약이며 조명 시뮬레이션이 아닙니다. 적용 전에는 MAP을 수정하지 않습니다. Ctrl+Z로 되돌릴 수 있습니다.',excess:'너무 많은 면을 선택했습니다.',success:'정렬되었습니다. Ctrl+Z로 취소할 수 있습니다.'},
 zh:{title:'无缝 UV',description:'仅处理具有真实公共边的已选面，并保持墙角的 UV 连续性。',option:'同时复制源纹理',preview:'预览更改',hide:'隐藏预览',apply:'应用连续对齐',none:'至少选择两个相连的面，第一个面作为参照。',skipped:'未连接或不兼容的面',changes:'将更改的面',aligned:'已对齐',reference:'参考面',edge:'来自',before:'原误差',after:'新误差',unit:'纹素',warning:'预览仅显示 UV 更改摘要，不模拟光照。应用前不会更改地图，可通过 Ctrl+Z 撤销。',excess:'选定面过多。',success:'已应用，可用 Ctrl+Z 撤销。'},
 pt:{title:'UV Contínuo',description:'Somente faces selecionadas com aresta compartilhada. Mantém o UV contínuo nas esquinas.',option:'Copiar também a textura da origem',preview:'Prévia das alterações',hide:'Ocultar prévia',apply:'Aplicar continuidade',none:'Selecione pelo menos duas faces adjacentes. A primeira é a referência.',skipped:'faces sem conexão ou incompatíveis',changes:'faces para alterar',aligned:'já alinhadas',reference:'Referência',edge:'de',before:'Erro anterior',after:'novo',unit:'texels',warning:'A prévia resume as alterações UV; não simula iluminação. O MAP só muda ao aplicar. Ctrl+Z desfaz o lote.',excess:'Muitas faces selecionadas.',success:'Alinhamento aplicado. Ctrl+Z para desfazer.'}
} as const;

export function SeamlessUvPanel({objects,targets,locale}:{objects:MapObject[];targets:TextureFaceRef[];locale:Locale}){
 const t=labels[locale]||labels.en;
 const apply=useEditor(s=>s.applySeamlessTextureAlignment);
 const [expanded,setExpanded]=useState(false),[showPreview,setShowPreview]=useState(false),[copyTexture,setCopyTexture]=useState(false),[notice,setNotice]=useState('');
 const plan:SeamlessUvPlan=useMemo(()=>expanded?planSeamlessUV(objects,targets,{copyTexture}):{anchor:null,selectedCount:0,changes:[],unreachable:[],alreadyAligned:0},[expanded,objects,targets,copyTexture]);
 const ready=expanded&&!plan.reason&&plan.changes.length>0;
 return <section className="texture-seamless-section" aria-label={t.title}>
  <button type="button" className="texture-seamless-toggle" aria-expanded={expanded} onClick={()=>{setExpanded(v=>!v);setShowPreview(false);setNotice('')}}>
   {expanded?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<Link2 size={13}/>{t.title}
  </button>
  {expanded&&<div className="texture-seamless-content">
    <p className="texture-studio-hint">{t.description}</p>
    <label className="texture-studio-check"><input type="checkbox" checked={copyTexture} onChange={e=>{setCopyTexture(e.target.checked);setShowPreview(false);setNotice('')}}/>{t.option}</label>
    <div className="texture-seamless-stats"><span>{plan.changes.length} {t.changes}</span><span>{plan.unreachable.length} {t.skipped}</span><span>{plan.alreadyAligned} {t.aligned}</span></div>
    {plan.anchor&&<small>{t.reference}: {plan.anchor.id.slice(0,20)} · #{plan.anchor.face+1}</small>}
    {plan.reason&&<p className="texture-studio-hint" role="status">{plan.reason.includes('at most')?t.excess:t.none}</p>}
    <div className="texture-studio-row">
      <button type="button" disabled={!ready} onClick={()=>{setShowPreview(v=>!v);setNotice('')}}>{showPreview?t.hide:t.preview}</button>
      <button type="button" className="texture-primary" disabled={!ready||!showPreview} onClick={()=>{apply({copyTexture});setShowPreview(false);setNotice(t.success)}}>{t.apply}</button>
    </div>
    {showPreview&&ready&&<div className="texture-seamless-preview" aria-label={t.preview}>
      {plan.changes.slice(0,12).map(c=><div key={`${c.ref.id}:${c.ref.face}`}>
        <strong>{c.ref.id.slice(0,16)} · #{c.ref.face+1}</strong>
        <small>{t.edge} {c.from.id.slice(0,12)} #{c.from.face+1}</small>
        <small>{t.before}: {Number.isFinite(c.beforeSeamError)?c.beforeSeamError.toFixed(2):'—'} {t.unit} · {t.after}: {c.maxSeamError.toFixed(3)}</small>
        <small>UV: {c.patch.uShift?.toFixed(2)}, {c.patch.vShift?.toFixed(2)} / {c.patch.uScale?.toFixed(3)}, {c.patch.vScale?.toFixed(3)}</small>
      </div>)}
      {plan.changes.length>12&&<small>+{plan.changes.length-12}</small>}
    </div>}
    {notice&&<p className="texture-studio-hint" role="status">{notice}</p>}
    <p className="texture-studio-hint">{t.warning}</p>
  </div>}
 </section>;
}
