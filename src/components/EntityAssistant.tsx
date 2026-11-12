import {useEffect,useMemo,useState} from 'react';
import {BookOpen,ChevronDown,ChevronUp,Headphones,Link2,Search,Volume2,AlertTriangle} from 'lucide-react';
import {useEditor} from '../store';
import {connectionSearchText,entityConnectionLabel} from '../engine/entityNaming';
import {localizedGuideForClass,entityCapabilities,guideKeys,editableSoundKeys,entityGuideWarnings} from '../engine/entityGuide';
import type {FgdClass,PointEntity} from '../engine/types';
import type {Locale} from '../i18n';
import {DoorMotionControls} from './DoorMotionControls';

type TextKey='title'|'use'|'how'|'example'|'quick'|'connect'|'none'|'audio'|'browse'|'search'|'noSound'|'more'|'settings'|'up'|'down'|'still'|'custom'|'note'|'soundPath'|'listen'|'fgd'|'unknown'|'error'|'close';
const strings:Record<Locale,Record<TextKey,string>>={
 es:{title:'Mini guía de entidad',use:'Para qué sirve',how:'Cómo utilizarla',example:'Ejemplo',quick:'Configuración rápida',connect:'Activar entidad',none:'Sin conexión',audio:'Sonidos',browse:'Buscar en Sound Browser',search:'Buscar WAV por nombre…',noSound:'No hay sonidos disponibles. Configurá la carpeta del juego.',more:'Propiedades importantes',settings:'Opciones nativas',up:'Subir',down:'Bajar',still:'Horizontal',custom:'Ruta del archivo WAV',note:'Advertencias',soundPath:'Ruta relativa a sound/',listen:'Escuchar',fgd:'Campos declarados en FGD',unknown:'Importá el FGD de Sven Co-op para ver más parámetros de esta clase.',error:'No se pudo cargar la biblioteca de sonidos.',close:'Cerrar'},
 en:{title:'Entity mini guide',use:'Purpose',how:'How to use',example:'Example',quick:'Quick setup',connect:'Activate entity',none:'No connection',audio:'Sounds',browse:'Browse game sound files',search:'Search WAV files…',noSound:'No sounds available. Set your game folder.',more:'Important properties',settings:'Native settings',up:'Up',down:'Down',still:'Horizontal',custom:'Custom WAV path',note:'Warnings',soundPath:'Relative to sound/',listen:'Preview',fgd:'FGD-defined fields',unknown:'Import the Sven Co-op FGD to see more settings for this class.',error:'Could not load the sound library.',close:'Close'},
 ru:{title:'Справка по объекту',use:'Назначение',how:'Как использовать',example:'Пример',quick:'Быстрая настройка',connect:'Активировать объект',none:'Без связи',audio:'Звуки',browse:'Выбрать звук',search:'Поиск WAV…',noSound:'Укажите папку игры.',more:'Важные свойства',settings:'Настройки',up:'Вверх',down:'Вниз',still:'Горизонтально',custom:'Путь WAV',note:'Предупреждения',soundPath:'Путь от sound/',listen:'Прослушать',fgd:'Поля FGD',unknown:'Импортируйте FGD Sven Co-op.',error:'Ошибка загрузки звуков.',close:'Закрыть'},
 ko:{title:'엔티티 간단 가이드',use:'용도',how:'사용법',example:'예시',quick:'빠른 설정',connect:'엔티티 연결',none:'연결 없음',audio:'사운드',browse:'게임 사운드 찾기',search:'WAV 검색…',noSound:'게임 폴더를 설정하세요.',more:'주요 속성',settings:'기본 설정',up:'위',down:'아래',still:'수평',custom:'WAV 경로',note:'경고',soundPath:'sound/ 기준 경로',listen:'듣기',fgd:'FGD 속성',unknown:'Sven Co-op FGD를 가져오세요.',error:'사운드 로드 실패.',close:'닫기'},
 zh:{title:'实体迷你指南',use:'用途',how:'使用方法',example:'示例',quick:'快速设置',connect:'激活实体',none:'无连接',audio:'声音',browse:'浏览游戏音效',search:'搜索 WAV…',noSound:'请设置游戏目录。',more:'重要属性',settings:'原生设置',up:'向上',down:'向下',still:'水平',custom:'WAV 路径',note:'警告',soundPath:'相对于 sound/ 的路径',listen:'试听',fgd:'FGD 属性',unknown:'导入 Sven Co-op FGD 查看更多设置。',error:'无法加载声音库。',close:'关闭'},
 pt:{title:'Miniguia da entidade',use:'Finalidade',how:'Como usar',example:'Exemplo',quick:'Configuração rápida',connect:'Ativar entidade',none:'Sem conexão',audio:'Sons',browse:'Buscar sons do jogo',search:'Buscar WAV…',noSound:'Configure a pasta do jogo.',more:'Propriedades importantes',settings:'Opções nativas',up:'Subir',down:'Descer',still:'Horizontal',custom:'Caminho WAV',note:'Avisos',soundPath:'Relativo a sound/',listen:'Ouvir',fgd:'Campos do FGD',unknown:'Importe o FGD do Sven Co-op para ver mais opções.',error:'Falha ao carregar sons.',close:'Fechar'},
};
type AudioItem={path:string;name:string;source:string};
function Field({entity,field,definition,update}:{entity:PointEntity;field:string;definition?:FgdClass;update:(key:string,value:string)=>void}){
 const info=definition?.props[field];
 const value=entity.props[field]??info?.defaultValue??'';
 const [draft,setDraft]=useState(value);
 useEffect(()=>setDraft(value),[value,entity.id,field]);
 if(info?.type==='choices'&&info.options?.length)return <label className="ea-field"><span>{info.label||field} <code>{field}</code></span><select value={value} onChange={e=>update(field,e.target.value)}><option value="">—</option>{info.options.map(o=><option key={o.value} value={o.value}>{o.label} ({o.value})</option>)}</select></label>;
 return <label className="ea-field"><span>{info?.label||field} <code>{field}</code></span><input value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(draft!==value)update(field,draft)}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')e.currentTarget.blur()}}/></label>;
}
function NativeSounds({entity,definition,update,locale}:{entity:PointEntity;definition?:FgdClass;update:(key:string,value:string)=>void;locale:Locale}){
 const tx=strings[locale],keys=editableSoundKeys(entity.classname,definition);
 const gameDir=useEditor(s=>s.settings.gameDir);
 const [opened,setOpened]=useState<string|null>(null),[query,setQuery]=useState(''),[items,setItems]=useState<AudioItem[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{setOpened(null);setQuery('');setItems([])},[entity.id]);
 useEffect(()=>{
  if(!opened||!gameDir)return;
  const ac=new AbortController();const timer=setTimeout(async()=>{
   setLoading(true);setError('');
   try{const r=await fetch('/api/assets/sounds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameDir,query,limit:80}),signal:ac.signal});
    const result=await r.json();if(!r.ok)throw Error(result.error||`HTTP ${r.status}`);
    if(!ac.signal.aborted)setItems(Array.isArray(result.items)?result.items:[]);
   }catch(e){if(!ac.signal.aborted)setError(String(e))}finally{if(!ac.signal.aborted)setLoading(false)}
  },250);
  return()=>{clearTimeout(timer);ac.abort()};
 },[opened,query,gameDir]);
 if(!keys.length)return null;
 const keyLabels:Record<string,string>={noise:'Pulsación / Press',noise1:'Movimiento / Moving',noise2:'Detención / Stop',message:'Archivo / File',locked_sound_override:'Bloqueado / Locked',unlocked_sound_override:'Desbloqueado / Unlocked'};
 return <section className="ea-section"><h5><Headphones size={14}/>{tx.audio}</h5>
  {keys.map(k=>{const path=entity.props[k]||'';return <div className="ea-audio-field" key={k}>
   <Field entity={entity} field={k} definition={definition} update={update}/>
   <button type="button" title={tx.browse} onClick={()=>{setOpened(v=>v===k?null:k);setQuery('')}}><Search size={13}/>{keyLabels[k]||tx.browse}</button>
   {opened===k&&<div className="ea-sound-picker"><input aria-label={tx.search} placeholder={tx.search} value={query} onChange={e=>setQuery(e.target.value)}/>
    {loading&&<small>…</small>}{error&&<small role="alert">{tx.error}: {error}</small>}
    {!loading&&!error&&!items.length&&<small>{tx.noSound}</small>}
    {items.map(item=><div className="ea-sound-row" key={`${item.source}:${item.path}`}><button title={item.path} onClick={()=>{update(k,item.path);setOpened(null)}}><Volume2 size={12}/>{item.path}</button><audio preload="none" controls src={'/api/assets/sound?'+new URLSearchParams({gameDir,source:item.source,path:item.path})} aria-label={`${tx.listen} ${item.name}`}/></div>)}
   </div>}
  </div>})}
  <small className="ea-help">{tx.soundPath}. {tx.settings}: {keys.join(', ')}</small>
 </section>;
}
export function EntityAssistant({entity,definition,initiallyOpen=false,compact=false,showDoorControls=true}:{entity:PointEntity|null;definition?:FgdClass;initiallyOpen?:boolean;compact?:boolean;showDoorControls?:boolean}){
 const locale=useEditor(s=>s.locale) as Locale,tx=strings[locale]||strings.en;
 const updateStore=useEditor(s=>s.setObjectProp),connect=useEditor(s=>s.connectGameplay),objects=useEditor(s=>s.project.objects);
 const [opened,setOpened]=useState(initiallyOpen),[showAdvanced,setShowAdvanced]=useState(!compact),[keySearch,setKeySearch]=useState(''),[targetQuery,setTargetQuery]=useState('');
 useEffect(()=>setTargetQuery(''),[entity?.id]);
 const classname=entity?.classname||definition?.name||'';
 const guide=useMemo(()=>localizedGuideForClass(classname,definition,locale),[classname,definition,locale]);
 const keys=useMemo(()=>guideKeys(classname,definition),[classname,definition]);
 const capabilities=useMemo(()=>entityCapabilities(definition,locale),[definition,locale]);
 const update=(key:string,value:string)=>{if(entity)updateStore(entity.id,key,value)};
 const warnings=entity?entityGuideWarnings(entity,objects):[];
 const targets=entity?objects.filter((o):o is PointEntity=>o.kind==='entity'&&o.id!==entity.id):[];
 const matchedTargets=targets.filter(t=>t.props.targetname&&t.props.targetname===entity?.props.target||!targetQuery.trim()||connectionSearchText(t,objects).includes(targetQuery.trim().toLocaleLowerCase())).slice(0,80);
 const showTarget=!!entity&&(['func_button','trigger_once','trigger_multiple','trigger_relay','func_breakable'].includes(classname)||('target' in (definition?.props||{}))||'target' in entity.props);
 return <section className={`entity-assistant ${compact?'ea-compact':''}`}>
  <button type="button" className="ea-toggle" aria-expanded={opened} onClick={()=>setOpened(v=>!v)}><BookOpen size={15}/><strong>{tx.title}</strong><span>{classname}</span>{opened?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button>
  {opened&&<div className="ea-content">
   <div className="ea-section"><h5>{tx.use}</h5><p>{guide.summary}</p></div>
   {capabilities.length>0&&<div className="ea-section"><h5>{tx.settings}</h5><ul className="ea-capabilities">{capabilities.map(x=><li key={x}>{x}</li>)}</ul></div>}
   <div className="ea-section"><h5>{tx.how}</h5><ol>{guide.steps.map((s,i)=><li key={i}>{s}</li>)}</ol><p className="ea-example"><strong>{tx.example}: </strong><code>{guide.example}</code></p></div>
   {!!entity&&<div className="ea-section"><h5>{tx.quick}</h5>
    {showTarget&&entity&&<div className="ea-target-search">
      <label className="ea-field"><span><Link2 size={12}/>{tx.connect} <code>target</code></span>
        <input aria-label="Search named destination" placeholder={locale==='es'?'Buscar por nombre, classname o targetname…':'Search by name, classname or targetname…'} value={targetQuery} onChange={e=>setTargetQuery(e.target.value)} onKeyDown={e=>e.stopPropagation()}/></label>
      <select aria-label="Choose named destination" value={targets.find(x=>x.props.targetname&&x.props.targetname===entity.props.target)?.id||''} onChange={e=>{if(!e.target.value){update('target','');return;}try{connect(entity.id,e.target.value,true)}catch(error){window.alert(String(error))}}}>
        <option value="">{entity.props.target?`${entity.props.target} · ${tx.none}`:tx.none}</option>
        {matchedTargets.map(target=><option value={target.id} key={target.id}>{entityConnectionLabel(target,objects)}</option>)}
      </select><small>{matchedTargets.length}/{targets.length} · {locale==='es'?'El nombre es del editor; targetname se asigna para Svengine.':'Editor names are searchable; targetname is used by Svengine.'}</small>
    </div>}
    {classname==='func_door'&&showDoorControls&&<DoorMotionControls entity={entity} compact={compact}/>}
    {keys.filter(key=>key!=='target'&&key!=='targetname'&&!editableSoundKeys(classname,definition).includes(key)&&key!=='spawnflags'&&key!=='sounds'&&!(classname==='func_door'&&['angle','angles','speed','wait','lip'].includes(key))).slice(0,7).map(key=><Field key={`${entity.id}:${key}`} entity={entity} field={key} definition={definition} update={update}/>)}
    {definition?.props.sounds?.options?.length? <Field entity={entity} field="sounds" definition={definition} update={update}/>:null}
    <NativeSounds entity={entity} definition={definition} update={update} locale={locale}/>
   </div>}
   {definition&&<div className="ea-section"><button type="button" className="ea-advanced" onClick={()=>setShowAdvanced(v=>!v)} aria-expanded={showAdvanced}>{tx.fgd} · {Object.keys(definition.props).length} {tx.more} {showAdvanced?'▴':'▾'}</button>
      {showAdvanced&&<><input className="ea-guide-filter" aria-label={locale==='es'?'Buscar parámetro FGD':'Search FGD property'} placeholder={locale==='es'?'Buscar keyvalue, descripción o tipo…':'Search property, label or type…'} value={keySearch} onChange={e=>setKeySearch(e.target.value)} onKeyDown={e=>e.stopPropagation()}/>
        <div className="ea-fgd-keys ea-fgd-detailed">{Object.entries(definition.props).filter(([k,f])=>`${k} ${f.label} ${f.type}`.toLowerCase().includes(keySearch.toLowerCase())).map(([k,f])=><div key={k}><strong><code>{k}</code> — {f.label}</strong><small>{f.type}{f.defaultValue!==undefined?` · ${locale==='es'?'Predeterminado':'Default'}: ${f.defaultValue}`:''}</small>{!!f.options?.length&&<small>{f.options.slice(0,28).map(o=>`${o.value}: ${o.label}`).join(' · ')}{f.options.length>28?' …':''}</small>}</div>)}</div>
      </>}
    </div>}
   {!definition&&<div className="ea-section"><h5>{tx.fgd}</h5><p>{tx.unknown}</p></div>}
   <div className="ea-section ea-reference-links"><h5>{locale==='es'?'Documentación y verificación':'Reference documentation'}</h5>
      <p>{locale==='es'?'Las propiedades se toman del FGD cargado. La referencia externa describe el comportamiento del juego; algunas entidades y scripts personalizados pueden diferir.':'Properties come from the loaded FGD. External documentation describes game behavior; custom entities may differ.'}</p>
      <a href="https://www.svenmanor.com/entity-guide" target="_blank" rel="noopener noreferrer">Sven Co-op Manor · Entity Guide</a>
      <a href="https://wiki.svencoop.com/Mapping/Sven_Co-op_FGD" target="_blank" rel="noopener noreferrer">Sven Co-op Wiki · FGD</a>
    </div>
   {!!warnings.length&&<div className="ea-section ea-warning"><h5><AlertTriangle size={13}/>{tx.note}</h5>{warnings.map((w,i)=><p key={i}>{w}</p>)}</div>}
   {guide.caution&&<p className="ea-caution">{guide.caution}</p>}
  </div>}
 </section>;
}
