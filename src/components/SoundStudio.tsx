import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AudioLines,CheckCircle2,Headphones,MapPin,Music2,Plus,RefreshCcw,Search,SlidersHorizontal,Volume2,Star,Activity,X,AlertTriangle,Radio,Link2} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {AudioConverter} from './AudioConverter';
import type {WAV_PRESETS} from '../engine/audioConversion';
import {DEFAULT_SOUND_OPTIONS,validateAudio,validSoundReference,type SoundAsset,type AudioEntityKind,type SoundOptions} from '../engine/sound';
import type {PointEntity,Vec3} from '../engine/types';

type SoundResponse={items:SoundAsset[];total:number;limited:boolean;scanComplete:boolean};
const STORE_KEY='svenstudio-sound-favorites-v1';
const loadStars=()=>{try{const value=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[]}catch{return []}};
export const soundUrl=(asset:SoundAsset,gameDir:string)=>'/api/assets/sound?'+new URLSearchParams({gameDir,source:asset.source,path:asset.path}).toString();
export function useSoundInventory(){
  const gameDir=useEditor(s=>s.settings.gameDir),[query,setQuery]=useState(''),[refreshIndex,setRefreshIndex]=useState(0);
  const forceRefresh=useRef(false);
  const [data,setData]=useState<SoundResponse>({items:[],total:0,limited:false,scanComplete:false});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(!gameDir){setData({items:[],total:0,limited:false,scanComplete:false});setError('Configure the game directory in Build Settings first.');setBusy(false);return;}
    let alive=true;const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setBusy(true);setError('');
      const refresh=forceRefresh.current;forceRefresh.current=false;
      try{
        const response=await fetch('/api/assets/sounds',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({gameDir,query,limit:600,refresh})});
        const json=await response.json();if(!response.ok)throw Error(json.error||`HTTP ${response.status}`);
        if(alive)setData(json as SoundResponse);
      }catch(err){if(alive&&!controller.signal.aborted)setError(String(err));}
      finally{if(alive)setBusy(false)}
    },query?260:0);
    return()=>{alive=false;clearTimeout(timer);controller.abort()};
  },[gameDir,query,refreshIndex]);
  return {gameDir,query,setQuery,refresh:()=>{forceRefresh.current=true;setRefreshIndex(v=>v+1)},data,busy,error};
}
function AudioPlayback({asset,gameDir}:{asset:SoundAsset|null;gameDir:string}){
  const t=useT();const [notice,setNotice]=useState(''),[peaks,setPeaks]=useState<number[]>([]),[analyzing,setAnalyzing]=useState(false);
  const audio=useRef<HTMLAudioElement>(null);
  const url=asset?soundUrl(asset,gameDir):'';
  useEffect(()=>{setNotice('');setPeaks([]);audio.current?.pause()},[url]);
  const analyze=async()=>{
    if(!asset)return;setAnalyzing(true);setNotice('');
    let ctx:AudioContext|null=null;
    try{
      const head=await fetch(url,{method:'HEAD'});
      if(!head.ok||Number(head.headers.get('content-length')||0)>15_000_000)throw Error('Waveform needs a browser-supported file smaller than 15 MiB.');
      const response=await fetch(url);if(!response.ok)throw Error('Cannot read audio file.');
      ctx=new AudioContext();const decoded=await ctx.decodeAudioData(await response.arrayBuffer());
      const channel=decoded.getChannelData(0),bins=72,step=Math.max(1,Math.floor(channel.length/bins));const list=[];
      for(let i=0;i<bins;i++){
        let peak=0;const start=i*step;for(let j=start;j<Math.min(start+step,channel.length);j+=Math.max(1,Math.floor(step/250)))peak=Math.max(peak,Math.abs(channel[j]));
        list.push(Math.max(.025,peak));
      }
      setPeaks(list);
    }catch(err){setNotice(t('Waveform unavailable for this format or file size.')+' '+String(err));}
    finally{await ctx?.close();setAnalyzing(false)}
  };
  if(!asset)return <div className="sound-player-empty"><Headphones size={27}/>{t('Choose a sound to preview.')}</div>;
  return <div className="sound-playback">
    <div className="sound-playback-title"><AudioLines size={17}/><div><strong>{asset.name}</strong><small>{asset.source} / sound/{asset.path}</small></div></div>
    <audio ref={audio} key={url} controls preload="none" src={url} onError={()=>setNotice(t('Browser cannot decode this format. Sven Co-op may still support it.'))}/>
    <div className="sound-waveform">{peaks.length?<svg role="img" aria-label="Audio waveform" viewBox="0 0 720 90" preserveAspectRatio="none">{peaks.map((v,i)=><rect key={i} x={i*10+1} y={45-v*40} width="6" height={Math.max(2,v*80)} rx="2" fill="#68d7ef"/>)}</svg>:<div className="sound-wave-placeholder"><Activity size={23}/>{t('Analyze waveform to view actual audio levels.')}</div>}</div>
    <button className="sound-subtle-button" disabled={analyzing} onClick={analyze}><AudioLines size={14}/>{analyzing?'…':t('Analyze waveform')}</button>
    {notice&&<small className="sound-warning">{notice}</small>}
  </div>;
}
function SoundList({items,gameDir,selected,onSelect}:{items:SoundAsset[];gameDir:string;selected:string;onSelect:(asset:SoundAsset)=>void}){
  const [stars,setStars]=useState<string[]>(loadStars),[onlyStars,setOnlyStars]=useState(false);const t=useT();
  const entries=onlyStars?items.filter(item=>stars.includes(item.source+'|'+item.path)):items;
  const toggle=(key:string)=>{setStars(current=>{const next=current.includes(key)?current.filter(k=>k!==key):[...current,key];localStorage.setItem(STORE_KEY,JSON.stringify(next));return next})};
  return <><button className="sound-favorite-filter" onClick={()=>setOnlyStars(v=>!v)} aria-pressed={onlyStars}><Star size={14} fill={onlyStars?'currentColor':'none'}/>{t('Favorites only')}</button>
    <div className="sound-file-scroll">{entries.map(item=>{const key=item.source+'|'+item.path;return <div key={key} className={`sound-file-entry ${selected===key?'active':''}`} draggable onDragStart={e=>{
      e.dataTransfer.setData('application/x-svenstudio-sound',JSON.stringify({source:item.source,path:item.path}));e.dataTransfer.effectAllowed='copy';
    }}><button className="sound-file-select" onClick={()=>onSelect(item)} title={'sound/'+item.path}><Volume2 size={17}/><span><strong>{item.name}</strong><small>{item.source} / {item.path}</small></span><b>{item.extension}</b></button><button className="sound-star" title={t('Toggle favorite')} onClick={()=>toggle(key)}><Star size={15} fill={stars.includes(key)?'currentColor':'none'}/></button></div>})}
      {!entries.length&&<div className="sound-empty">{t('No matching sounds found.')}</div>}
    </div></>;
}
export function SoundBrowser({compact=false}:{compact?:boolean}){
  const t=useT();const inventory=useSoundInventory(),[selected,setSelected]=useState<SoundAsset|null>(null);
  const start=useEditor(s=>s.startAudioPlacement),setResourceView=useEditor(s=>s.setResourceView);
  const filtered=inventory.data.items;
  return <div className={`sound-browser ${compact?'sound-browser-compact':''}`}>
    <header className="sound-library-heading"><strong><Headphones size={17}/>{t('Svengine Sound Library')}</strong><button onClick={inventory.refresh} title={t('Rescan sound folders')}><RefreshCcw size={16}/></button></header>
    <div className="sound-search"><Search size={15}/><input value={inventory.query} onChange={e=>inventory.setQuery(e.target.value)} placeholder={t('Search sound files…')}/></div>
    <div className="sound-scan-status">{inventory.busy?t('Scanning…'):inventory.error||`${inventory.data.total} ${t('sound files')} · ${inventory.data.scanComplete?t('Ready'):''}`}</div>
    <SoundList items={filtered} gameDir={inventory.gameDir} selected={selected?selected.source+'|'+selected.path:''} onSelect={setSelected}/>
    {selected&&<div className="sound-browser-footer"><audio src={soundUrl(selected,inventory.gameDir)} controls preload="none"/><button onClick={()=>{start('ambient_generic',selected.path);setResourceView('sounds')}}><MapPin size={15}/>{t('Place sound in 3D')}</button></div>}
  </div>;
}
// Exact roomtype descriptions from the Sven Co-op FGD; do not translate engine IDs.
const rooms=[['0','Normal (off)'],['1','Generic'],['2','Metal Small'],['3','Metal Medium'],['4','Metal Large'],['5','Tunnel Small'],['6','Tunnel Medium'],['7','Tunnel Large'],['8','Chamber Small'],['9','Chamber Medium'],['10','Chamber Large'],['11','Bright Small'],['12','Bright Medium'],['13','Bright Large'],['14','Water Small'],['15','Water Medium'],['16','Water Large'],['17','Concrete Small'],['18','Concrete Medium'],['19','Concrete Large'],['20','Big Room'],['21','Bigger Room'],['22','Biggest Room'],['23','Cavern Small'],['24','Cavern Medium'],['25','Cavern Large'],['26','Weirdo - Drugged'],['27','Weirdo - Dizzy'],['28','Weirdo - Psychotic']];
export function SoundStudio({onClose}:{onClose:()=>void}){
  const t=useT(),inventory=useSoundInventory(),[asset,setAsset]=useState<SoundAsset|null>(null),[kind,setKind]=useState<AudioEntityKind>('ambient_generic');
  const [options,setOptions]=useState<SoundOptions>(DEFAULT_SOUND_OPTIONS),[notice,setNotice]=useState(''),[showConverter,setShowConverter]=useState(false);
  const start=useEditor(s=>s.startAudioPlacement),create=useEditor(s=>s.createAudioAt),setProp=useEditor(s=>s.setObjectProp),setSelected=useEditor(s=>s.setSelected);
  const objects=useEditor(s=>s.project.objects),selected=useEditor(s=>s.selected),appendLogs=useEditor(s=>s.appendLogs);
  const selectedEntity=objects.find((o):o is PointEntity=>o.id===selected&&o.kind==='entity'&&['ambient_generic','ambient_music','env_sound'].includes(o.classname))||null;
  const issues=useMemo(()=>validateAudio(objects),[objects]);
  useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onClose()}};window.addEventListener('keydown',esc,true);return()=>window.removeEventListener('keydown',esc,true)},[onClose]);
  const doPlace=()=>{try{if(kind!=='env_sound'&&!asset)throw Error(t('Choose a sound first.'));start(kind,asset?.path||'',options);onClose()}catch(e){setNotice(String(e))}};
  const createNear=()=>{try{if(kind!=='env_sound'&&!asset)throw Error(t('Choose a sound first.'));
    const obj=objects.find(o=>o.id===selected);const pos:Vec3=obj?[obj.position[0]+64,obj.position[1],obj.position[2]]:[0,0,64];
    create(kind,asset?.path||'',pos,options);setNotice(t('Audio entity created.'));
  }catch(err){setNotice(String(err))}};
  const assign=()=>{if(!selectedEntity||!asset||selectedEntity.classname==='env_sound')return;
    setProp(selectedEntity.id,'message',asset.path);setNotice(t('Sound assigned to selected entity.'));
  };
  const [diagnostic,setDiagnostic]=useState('');
  const verifyPath=async()=>{
    const path=selectedEntity?.props.message?.trim()||asset?.path||'';
    if(!path){setDiagnostic(t('No sound path selected.'));return;}
    try{
      const response=await fetch('/api/assets/sound-diagnostic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameDir:inventory.gameDir,path})});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);
      if(!data.matches?.length){setDiagnostic(`${t('File not found in game sound folders')}: sound/${path}`);return;}
      const first=data.matches[0];
      const format=first.wav?` · WAV PCM ${first.wav.format===1?'':('(format '+first.wav.format+') ')}${first.wav.channels}ch ${first.wav.rate}Hz ${first.wav.bits}bit`:'';
      const multiple=data.matches.length>1?` · ${t('Duplicate path in multiple sound folders')} (${data.matches.map((x:{source:string})=>x.source).join(', ')})`:'';
      setDiagnostic(`${t('Resolved file')}: ${first.source}/sound/${path}${format}${multiple}`);
    }catch(err){setDiagnostic(String(err))}
  };
  const installed=(path:string,preset:keyof typeof WAV_PRESETS)=>{
    const imported:SoundAsset={source:'svencoop_addon',path,name:path.split('/').pop()||path,extension:'wav',category:'svenstudio_imports'};
    setAsset(imported);setKind(preset==='music'?'ambient_music':'ambient_generic');
    if(preset==='music')setOptions(v=>({...v,loop:true,startSilent:false,volume:10}));
    inventory.setQuery(path);inventory.refresh();
    setDiagnostic('');setShowConverter(false);
    setNotice(`${t('Installed and selected for placement')}: sound/${path} · ${preset==='music'?'ambient_music':'ambient_generic'}`);
  };
  return <div className="modal-backdrop sound-backdrop" onMouseDown={onClose}><section className="sound-studio" role="dialog" aria-label={t('Sound & Atmosphere Studio')} aria-modal="true" onMouseDown={e=>e.stopPropagation()}>
    <header className="sound-studio-header"><span className="sound-header-icon"><Headphones size={21}/></span><div><strong>{t('Sound & Atmosphere Studio')}</strong><small>Sven Co-op · ambient_generic · ambient_music · env_sound</small></div><div className="sound-header-count">{inventory.data.total} {t('sound files')}</div><button className="sound-convert-entry" onClick={()=>setShowConverter(true)}><AudioLines size={16}/>{t('Convert audio')}</button><button onClick={onClose} title={t('Close')}><X size={20}/></button></header>
    <div className="sound-studio-columns">
      <aside className="sound-studio-library"><div className="sound-library-heading"><strong><AudioLines size={17}/>{t('Sound Browser')}</strong><button onClick={inventory.refresh} title={t('Rescan sound folders')}><RefreshCcw size={16}/></button></div>
        <label className="sound-search"><Search size={15}/><input placeholder={t('Search sound files…')} value={inventory.query} onChange={e=>inventory.setQuery(e.target.value)}/></label>
        <div className="sound-scan-status">{inventory.busy?t('Scanning…'):inventory.error||`${inventory.data.total} ${t('sound files')} ${inventory.data.limited?'(first 600)':''}`}</div>
        <SoundList items={inventory.data.items} gameDir={inventory.gameDir} selected={asset?asset.source+'|'+asset.path:''} onSelect={setAsset}/>
      </aside>
      <section className="sound-center"><h3><Headphones size={18}/>{t('Preview & Sound Properties')}</h3>
        <AudioPlayback asset={asset} gameDir={inventory.gameDir}/>
        <div className="sound-mode-tabs">{([['ambient_generic',Radio,'3D Sound'],['ambient_music',Music2,'Music'],['env_sound',AudioLines,'Reverb']] as const).map(([type,Icon,label])=><button key={type} className={kind===type?'active':''} onClick={()=>setKind(type)}><Icon size={17}/>{t(label)}</button>)}</div>
        <div className="sound-options"><h4><SlidersHorizontal size={16}/>{t('Svengine Keyvalues')}</h4>
          {kind!=='env_sound'&&<>
            <label><span>{t('Volume')} (0–10)</span><input type="range" min="0" max="10" step=".5" value={options.volume} onChange={e=>setOptions(v=>({...v,volume:Number(e.target.value)}))}/><output>{options.volume}</output></label>
            <label className="sound-option-check"><input type="checkbox" checked={options.loop} onChange={e=>setOptions(v=>({...v,loop:e.target.checked}))}/>{t('Loop')}</label>
            <label className="sound-option-check"><input type="checkbox" checked={options.startSilent} onChange={e=>setOptions(v=>({...v,startSilent:e.target.checked}))}/>{t('Start silent (triggered)')}</label>
          </>}
          {kind==='ambient_generic'&&<label><span>{t('Approximate sound range')}</span><select value={options.radius} onChange={e=>setOptions(v=>({...v,radius:e.target.value as SoundOptions['radius']}))}>{(['small','medium','large','everywhere'] as const).map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label>}
          {kind==='env_sound'&&<><label><span>{t('Reverb radius')} (u)</span><input type="number" min="0" max="8192" step="32" value={options.reverbRadius} onChange={e=>setOptions(v=>({...v,reverbRadius:Number(e.target.value)}))}/></label><label><span>{t('Room type')}</span><select value={options.roomType} onChange={e=>setOptions(v=>({...v,roomType:Number(e.target.value)}))}>{rooms.map(([value,name])=><option key={value} value={value}>{value}: {name}</option>)}</select></label></>}
        </div>
        <div className="sound-action-row"><button className="sound-primary" onClick={doPlace}><MapPin size={16}/>{t('Place in 3D')}</button><button onClick={createNear}><Plus size={16}/>{t('Create near selection')}</button></div>
        {asset&&kind!=='env_sound'&&<p className="sound-reference-highlight">{t('Sound that will be placed')}: <code>{kind} · sound/{asset.path}</code></p>}
        {kind==='ambient_music'&&<p className="sound-hint">{t('Music playback also depends on the player Music Volume setting (mp3volume).')}</p>}
        <p className="sound-hint">{t('Sound paths are relative to the game sound folder. Browser preview may not support every Svengine audio format.')}</p>
      </section>
      <aside className="sound-inspector"><h3><Volume2 size={17}/>{t('Audio Entities')}</h3>
        <div className="sound-entity-list">{objects.filter((o):o is PointEntity=>o.kind==='entity'&&['ambient_generic','ambient_music','env_sound'].includes(o.classname)).map(entity=><button key={entity.id} className={entity.id===selected?'active':''} onClick={()=>setSelected(entity.id)}><Volume2 size={14}/><span><strong>{entity.classname}</strong><small>{entity.props.message||entity.props.roomtype||'—'}</small></span></button>)}</div>
        {selectedEntity?<div className="sound-entity-edit"><h4>{t('Selected entity')} · {selectedEntity.classname}</h4>
          {selectedEntity.classname!=='env_sound'&&<><label>{t('Sound File (message)')}<input value={selectedEntity.props.message||''} onChange={e=>setProp(selectedEntity.id,'message',e.target.value)}/></label><button disabled={!asset} onClick={assign}><Link2 size={14}/>{t('Assign selected sound')}</button></>}
          {asset&&selectedEntity.classname!=='env_sound'&&asset.path!==(selectedEntity.props.message||'')&&<p className="sound-path-warning">{t('Selected entity is assigned to a different sound. Use Assign selected sound to update it.')}</p>}
          <label>{t('Targetname')}<input value={selectedEntity.props.targetname||''} onChange={e=>setProp(selectedEntity.id,'targetname',e.target.value)}/></label>
          <label>{t('Spawnflags')}<input value={selectedEntity.props.spawnflags||'0'} onChange={e=>setProp(selectedEntity.id,'spawnflags',e.target.value)}/></label>
          <p className="sound-hint">{t('Other entity keyvalues remain editable in Properties and Gameplay Studio.')}</p>
        </div>:<p className="sound-hint">{t('Select an audio entity in the scene to edit its keyvalues.')}</p>}
        <button className="sound-verify-button" onClick={verifyPath} disabled={!(selectedEntity?.props.message||asset?.path)}><CheckCircle2 size={14}/>{t('Check audio file path in Sven Co-op')}</button>
        {diagnostic&&<p className="sound-path-report" role="status">{diagnostic}</p>}
        <h3><AlertTriangle size={16}/>{t('Audio Validation')}</h3>
        <div className="sound-issues">{issues.length?issues.slice(0,24).map((issue,i)=><button key={i} onClick={()=>setSelected(issue.entityId)} className={issue.severity}><AlertTriangle size={13}/>{issue.message}</button>):<p className="sound-ok"><CheckCircle2 size={16}/>{t('No audio entity errors found.')}</p>}</div>
      </aside>
    </div>
    <footer className="sound-footer"><small>{t('Preview uses browser audio; final playback and reverb use Svengine.')}</small><span aria-live="polite">{notice}</span></footer>
  </section>{showConverter&&<AudioConverter onClose={()=>setShowConverter(false)} onInstalled={installed}/>}</div>;
}
