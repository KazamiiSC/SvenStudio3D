import {Box, Database, Zap, Layers, Boxes, AudioLines, UsersRound, FolderOpen, Import, SlidersHorizontal, Clock3, Play, ArrowRight, ChevronRight, ChevronDown, Gamepad2, Check, PanelLeft, ShieldCheck, Mountain, Share2, ShieldPlus, BookOpen, Brush} from 'lucide-react';
import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type ReactElement} from 'react';
import {useEditor} from '../store';
import type {HomeAction} from '../engine/homeV23';
import {homeRef,type ToolId,type AbilityId} from '../engine/homeRef';
import type {Project} from '../engine/types';
import type {Locale} from '../i18n';
import {listProjectHistory,openHistoryCheckpoint,type HistoryEntry} from '../engine/projectHistory';
import {studioFiles,readStudioText} from '../engine/studioFiles';
import {validateProjectFile} from '../engine/projectValidation';
import {useSaveState} from '../engine/saveState';
import './WelcomeScreen.css';

/**
 * v2.3 HF4 home screen.
 * Reproduces the approved reference on a fixed 1672x825 design canvas that is
 * zoomed to fit the window, so proportions never drift between resolutions.
 * Only illustrations come from images (public/home-ref, text-free crops of the
 * reference); every label, icon and control is real DOM, localized and clickable.
 */
const DESIGN_W=1672, DESIGN_H=825, MIN_SCALE=0.55;

/** Corner brackets with four dots: the BSP Editor glyph of the reference. */
function BspEditorIcon({size=30}:{size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>
    <circle cx="9.5" cy="9.5" r=".6" fill="currentColor"/><circle cx="14.5" cy="9.5" r=".6" fill="currentColor"/>
    <circle cx="9.5" cy="14.5" r=".6" fill="currentColor"/><circle cx="14.5" cy="14.5" r=".6" fill="currentColor"/>
  </svg>;
}

/** Original game icon read from the user's local installation; drawn fallback when the game is absent. */
function GameIcon({game,small=false,hint=''}:{game:'svengine'|'cs16';small?:boolean;hint?:string}){
  const [failed,setFailed]=useState(false);
  const src=`/api/assets/game-icon?game=${game}${hint?`&gameDir=${encodeURIComponent(hint)}`:''}`;
  if(failed)return game==='svengine'?<span className={`ssr-lambda ${small?'ssr-lambda-sm':''}`} aria-hidden="true">λ</span>:<span className={small?'ssr-cs-sm':'ssr-cs'} aria-hidden="true"/>;
  return <img className={`ssr-game-icon ssr-game-icon-${game} ${small?'is-sm':''}`} src={src} alt="" aria-hidden="true" draggable={false} onError={()=>setFailed(true)}/>;
}

type Tool={id:ToolId;Icon:(p:{size?:number})=>ReactElement;art:string;highlight?:boolean;badge?:'map'|'cs'};
// Order and highlights follow the reference: MAP Editor and CS Map Studio are the featured cards.
const tools:Tool[]=[
  {id:'editor',Icon:p=><Box {...p} strokeWidth={1.7}/>,art:'editor',highlight:true,badge:'map'},
  {id:'bspViewer',Icon:p=><Database {...p} strokeWidth={1.7}/>,art:'bspviewer'},
  {id:'bspEditor',Icon:p=><BspEditorIcon {...p}/>,art:'bspeditor'},
  {id:'csMap',Icon:p=><ShieldCheck {...p} strokeWidth={1.7}/>,art:'csmap',highlight:true,badge:'cs'},
  {id:'world',Icon:p=><Mountain {...p} strokeWidth={1.7}/>,art:'world'},
  {id:'connect',Icon:p=><Share2 {...p} strokeWidth={1.7}/>,art:'connect'},
  {id:'texture',Icon:p=><Layers {...p} strokeWidth={1.7}/>,art:'texture'},
  {id:'sound',Icon:p=><AudioLines {...p} strokeWidth={1.7}/>,art:'sound'},
  {id:'prefabs',Icon:p=><Boxes {...p} strokeWidth={1.7}/>,art:'prefabs'},
  {id:'doctor',Icon:p=><ShieldPlus {...p} strokeWidth={1.7}/>,art:'doctor'},
  {id:'together',Icon:p=><UsersRound {...p} strokeWidth={1.7}/>,art:'together'},
  {id:'resources',Icon:p=><Layers {...p} strokeWidth={1.7}/>,art:'resources'},
];
const abilities:{key:AbilityId;action:HomeAction;Icon:typeof Box}[]=[
  {key:'mapEditing',action:'editor',Icon:Box},{key:'bspTools',action:'bspViewer',Icon:Database},
  {key:'compile',action:'settings',Icon:Zap},{key:'materials',action:'texture',Icon:Layers},
  {key:'prefabAssets',action:'prefabs',Icon:Boxes},{key:'soundAmbient',action:'sound',Icon:AudioLines},
  {key:'collaboration',action:'together',Icon:UsersRound},
];
const quick=[
  {id:'new',Icon:Box},{id:'open',Icon:FolderOpen},{id:'import',Icon:Import},{id:'build',Icon:SlidersHorizontal},
] as const;

type SavedFile={name:string;bytes:number;modified:number;projectName:string;target:'svengine'|'cs16';brushes:number};
type Recent={kind:'file';key:string;name:string;time:number;file:SavedFile}|{kind:'history';key:string;name:string;time:number;entry:HistoryEntry};

const localeTag:Record<Locale,string>={es:'es',en:'en',pt:'pt-BR',ru:'ru',ko:'ko',zh:'zh-CN'};

export function WelcomeScreen({onStart,onAction,onRestoreProject}:{onStart:()=>void;onAction:(action:HomeAction)=>void;onRestoreProject:(project:Project)=>void}){
  const project=useEditor(s=>s.project);
  const locale=useEditor(s=>s.locale);
  const cs16=useEditor(s=>s.settings.gameProfile==='cs16');
  const gameDir=useEditor(s=>s.settings.gameDir);
  // The configured folder speeds up icon lookup; the server only uses it if it is that game's folder.
  const svenHint=cs16?'':gameDir, csHint=cs16?gameDir:'';
  const copy=homeRef(locale);
  const tag=localeTag[locale]??'en';
  const [history,setHistory]=useState<HistoryEntry[]>([]);
  const [historyMessage,setHistoryMessage]=useState('');
  const [historyBusy,setHistoryBusy]=useState(false);
  const [files,setFiles]=useState<SavedFile[]>([]);
  const dirty=useSaveState(s=>s.dirty);
  const [pendingCsMap,setPendingCsMap]=useState(false);
  const [scale,setScale]=useState(1);
  const hostRef=useRef<HTMLElement>(null);

  // Fit the design canvas into the available area (between top bar and status bar).
  useLayoutEffect(()=>{
    const host=hostRef.current;if(!host)return;
    const fit=()=>{const {clientWidth:w,clientHeight:h}=host;if(w&&h)setScale(Math.max(MIN_SCALE,Math.min(w/DESIGN_W,h/DESIGN_H)));};
    fit();const observer=new ResizeObserver(fit);observer.observe(host);
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    let valid=true;
    // Real local snapshots only: never invent names, thumbnails or times.
    listProjectHistory().then(entries=>{if(valid)setHistory([...entries].sort((a,b)=>b.createdAt-a.createdAt));})
      .catch(()=>{if(valid)setHistoryMessage(copy.historyUnavailable)});
    // Real .svenstudio.json files saved in Documents/SvenStudio3D/Projects (newest first).
    studioFiles('projects').then(async({files:list})=>{
      const top=list.slice(0,4);
      const withStats=await Promise.all(top.map(async file=>{
        try{const data=JSON.parse(await readStudioText('projects',file.name)) as Partial<Project>;
          const objects=Array.isArray(data.objects)?data.objects:[];
          return {...file,projectName:typeof data.name==='string'&&data.name?data.name:file.name.replace(/\.svenstudio\.json$/i,''),target:data.target==='cs16'?'cs16':'svengine',brushes:objects.filter(o=>o?.kind==='brush').length};
        }catch{return null}
      }));
      if(valid)setFiles(withStats.filter((f):f is SavedFile=>f!==null));
    }).catch(()=>{/* Documents folder unavailable: history still works */});
    return()=>{valid=false};
  },[copy.historyUnavailable]);

  // CS Map Studio from the Sven profile: switch profile first, then open the studio
  // once App has re-rendered with the CS 1.6 profile.
  useEffect(()=>{if(pendingCsMap&&cs16){setPendingCsMap(false);onAction('csMap');}},[pendingCsMap,cs16,onAction]);

  const switchProfile=(profile:'svengine'|'cs16',confirmText=copy.profileWarning)=>{
    const editor=useEditor.getState();
    if(editor.settings.gameProfile===profile)return true;
    if((project.objects.length>0||confirmText!==copy.profileWarning)&&!window.confirm(confirmText))return false;
    editor.setGameProfile(profile);return true;
  };
  const openTool=(id:ToolId)=>{
    if(id==='csMap'&&!cs16){if(switchProfile('cs16',copy.csSwitch))setPendingCsMap(true);return;}
    onAction(id);
  };
  const openSavedFile=async(file:SavedFile)=>{
    if(historyBusy||(dirty&&!window.confirm(copy.fileOpenWarning)))return;
    setHistoryBusy(true);
    try{onRestoreProject(validateProjectFile(JSON.parse(await readStudioText('projects',file.name))));}
    catch(error){setHistoryMessage(String(error instanceof Error?error.message:error));}
    finally{setHistoryBusy(false);}
  };
  const restoreHistory=async(entry:HistoryEntry)=>{
    if(historyBusy||!window.confirm(copy.restoreWarning))return;
    setHistoryBusy(true);
    try{onRestoreProject((await openHistoryCheckpoint(entry.id)).project);}
    catch(error){setHistoryMessage(String(error instanceof Error?error.message:error));}
    finally{setHistoryBusy(false);}
  };

  const number=(n:number)=>n.toLocaleString(tag);
  const when=(ms:number)=>{
    const date=new Date(ms),now=new Date();
    const time=date.toLocaleTimeString(tag,{hour:'numeric',minute:'2-digit'});
    const day=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
    const diff=Math.round((day(now)-day(date))/86400000);
    if(diff===0)return `${copy.today}, ${time}`;
    if(diff===1)return `${copy.yesterday}, ${time}`;
    return `${date.toLocaleDateString(tag,{day:'numeric',month:'short'})}, ${time}`;
  };
  const brushCount=project.objects.filter(o=>o.kind==='brush').length;
  const currentName=project.name||'Untitled Map';
  // Saved files first-class, history snapshots fill the rest; one row per project name.
  const recentItems:Recent[]=[...files.map(file=>({kind:'file' as const,key:'f:'+file.name,name:file.projectName,time:file.modified,file})),
    ...history.map(entry=>({kind:'history' as const,key:'h:'+entry.id,name:entry.projectName,time:entry.createdAt,entry}))]
    .sort((a,b)=>b.time-a.time).filter(item=>item.name!==currentName).filter((item,i,all)=>all.findIndex(other=>other.name===item.name)===i).slice(0,2);
  const gameName=cs16?'CS 1.6':'Sven Co-op';

  return <section ref={hostRef} className="sven-welcome sven-welcome-solid ssr-home" aria-label="SvenStudio 3D home">
    <div className="ssr-fit">
      <div className="ssr-stage" style={{zoom:scale} as CSSProperties}>
        <div className="ssr-hero-art" aria-hidden="true"/>

        {/* LEFT: quick actions + recent projects */}
        <section className="ssr-panel ssr-quick" aria-labelledby="ssr-quick-title">
          <header className="ssr-head"><Zap size={25} strokeWidth={1.8}/><span><strong id="ssr-quick-title">{copy.quick}</strong><small>{copy.quickHint}</small></span></header>
          <div className="ssr-quick-grid">{quick.map(({id,Icon},i)=><button type="button" key={id} className={`ssr-quick-btn ${i===0?'is-hi':''}`} onClick={()=>onAction(id==='build'?'settings':id)}><Icon size={27} strokeWidth={1.7}/><strong>{copy.actions[id]}</strong></button>)}</div>
        </section>

        <section className="ssr-panel ssr-recent" aria-labelledby="ssr-recent-title">
          <header className="ssr-head"><Clock3 size={25} strokeWidth={1.8}/><span><strong id="ssr-recent-title">{copy.recent}</strong><small>{copy.recentHint}</small></span>
            <button type="button" className="ssr-link" onClick={()=>onAction('history')}>{copy.viewAll} <ArrowRight size={14}/></button></header>
          <div className="ssr-recent-list">
            <button type="button" className="ssr-recent-row" onClick={onStart} title={copy.continueCurrent}>
              <span className="ssr-recent-text"><strong>{currentName}</strong><small>{gameName} · {number(brushCount)} {copy.brushes} · <em>{copy.currentTag}</em></small></span>
              <span className="ssr-play"><Play size={13} fill="currentColor"/></span>
            </button>
            {recentItems.map(item=>item.kind==='file'
              ?<button type="button" className="ssr-recent-row" key={item.key} onClick={()=>void openSavedFile(item.file)} disabled={historyBusy} title={copy.openFile}>
                <span className="ssr-recent-text"><strong>{item.name}</strong><small>{item.file.target==='cs16'?'CS 1.6':'Sven Co-op'} · {number(item.file.brushes)} {copy.brushes} · {when(item.time)}</small></span>
                <span className="ssr-play"><Play size={13} fill="currentColor"/></span>
              </button>
              :<button type="button" className="ssr-recent-row" key={item.key} onClick={()=>void restoreHistory(item.entry)} disabled={historyBusy} title={copy.openSaved}>
                <span className="ssr-recent-text"><strong>{item.name}</strong><small>{number(item.entry.brushes)} {copy.brushes} · {number(item.entry.entities)} {copy.entities} · {when(item.time)}</small></span>
                <span className="ssr-play"><Play size={13} fill="currentColor"/></span>
              </button>)}
            {(historyMessage||!recentItems.length)&&<p className="ssr-recent-note" role="status">{historyMessage||copy.emptyRecent}</p>}
          </div>
        </section>

        {/* CENTER: hero */}
        <h1 className="ssr-wordmark"><span className="ssr-w-sven">SVEN</span><span className="ssr-w-studio">STUDIO</span><b>3D</b></h1>
        <p className="ssr-tagline">{copy.tagline}</p>
        <p className="ssr-description">{copy.description}</p>
        <div className="ssr-pills" role="group" aria-label={copy.activeGame}>
          <button type="button" className={!cs16?'is-on':''} aria-pressed={!cs16} onClick={()=>switchProfile('svengine')}><GameIcon game="svengine" small hint={svenHint}/>SVEN CO-OP</button>
          <button type="button" className={cs16?'is-on':''} aria-pressed={cs16} onClick={()=>switchProfile('cs16')}><GameIcon game="cs16" small hint={csHint}/>COUNTER-STRIKE 1.6</button>
        </div>
        <button type="button" className="ssr-cta" onClick={onStart}><Play size={26} fill="currentColor" strokeWidth={0}/><span>{copy.continue}</span><ArrowRight size={24} strokeWidth={2}/></button>
        <div className="ssr-foot"><i/><span>{copy.foot}</span><i/></div>

        {/* RIGHT: profile + capabilities */}
        <section className="ssr-panel ssr-profile" aria-labelledby="ssr-profile-title">
          <header className="ssr-head"><Gamepad2 size={27} strokeWidth={1.7}/><span><strong id="ssr-profile-title">{copy.activeGame}</strong><small>{copy.activeGameHint}</small></span>
            <button type="button" className="ssr-link" onClick={()=>onAction('settings')}>{copy.manage} <ChevronRight size={14}/></button></header>
          <div className="ssr-games">
            <button type="button" className={`ssr-game ${!cs16?'is-on':''}`} aria-pressed={!cs16} onClick={()=>switchProfile('svengine')}>
              <GameIcon game="svengine" hint={svenHint}/><span><strong>Sven Co-op</strong><small>{copy.profileSven}</small></span>{!cs16&&<span className="ssr-check"><Check size={13} strokeWidth={3.2}/></span>}
            </button>
            <button type="button" className={`ssr-game ${cs16?'is-on':''}`} aria-pressed={cs16} onClick={()=>switchProfile('cs16')}>
              <GameIcon game="cs16" hint={csHint}/><span><strong>Counter-Strike 1.6</strong><small>{copy.profileCS}</small></span>{cs16&&<span className="ssr-check"><Check size={13} strokeWidth={3.2}/></span>}
            </button>
          </div>
          <div className="ssr-profile-row">
            <label htmlFor="ssr-profile-select">{copy.profile}:</label>
            <span className="ssr-select"><select id="ssr-profile-select" value={cs16?'cs16':'svengine'} onChange={e=>{if(!switchProfile(e.target.value as 'svengine'|'cs16'))e.target.value=cs16?'cs16':'svengine';}}>
              <option value="svengine">Sven Co-op {copy.profileDefault}</option>
              <option value="cs16">Counter-Strike 1.6</option>
            </select><ChevronDown size={16}/></span>
            <button type="button" className="ssr-square" onClick={()=>onAction('settings')} title={copy.buildConfig} aria-label={copy.buildConfig}><PanelLeft size={17} strokeWidth={1.8}/></button>
          </div>
        </section>

        <section className="ssr-panel ssr-abilities" aria-labelledby="ssr-abilities-title">
          <header className="ssr-head"><Box size={24} strokeWidth={1.7}/><span><strong id="ssr-abilities-title">{copy.abilities}</strong><small>{copy.abilitiesHint}</small></span></header>
          <div className="ssr-ability-grid">{abilities.map(({key,action,Icon})=><button type="button" key={key} className={`ssr-ability ssr-ability-${key}`} onClick={()=>onAction(action)}><Icon size={23} strokeWidth={1.7}/><span><strong>{copy.ability[key][0]}</strong><small>{copy.ability[key][1]}</small></span></button>)}</div>
        </section>

        {/* TOOLS */}
        <div className="ssr-tools-head"><Layers size={25} strokeWidth={1.8}/><strong>{copy.tools}</strong><i/><span>{copy.toolsHint}</span></div>
        <div className="ssr-tools">{tools.map(({id,Icon,art,highlight,badge})=><button type="button" key={id} className={`ssr-tool ssr-tool-${art} ${highlight?'is-hi':''}`} onClick={()=>openTool(id)} title={id==='csMap'&&!cs16?copy.csSwitch:copy.tool[id][1]}>
          <span className="ssr-tool-art" aria-hidden="true"/>
          <span className="ssr-tool-top"><Icon size={30}/><strong>{copy.tool[id][0]}</strong></span>
          <small>{copy.tool[id][1].replace(' (','\n(')}</small>
          {badge&&<em className="ssr-badge">{badge==='cs'?'CS 1.6':'MAP / RMF'}</em>}
        </button>)}</div>

        {/* FOOTER */}
        <button type="button" className="ssr-foot-btn ssr-help" onClick={()=>onAction('help')}><BookOpen size={30} strokeWidth={1.6}/><span><strong>{copy.help[0]}</strong><small>{copy.help[1]}</small></span><ArrowRight size={18}/></button>
        <button type="button" className="ssr-foot-btn ssr-appearance" onClick={()=>onAction('appearance')}><Brush size={30} strokeWidth={1.6}/><span><strong>{copy.appearance[0]}</strong><small>{copy.appearance[1]}</small></span><ArrowRight size={18}/></button>
        <button type="button" className="ssr-community" onClick={()=>onAction('together')}><span><strong>{copy.community[0]}</strong><small>{copy.community[1]}</small></span></button>
      </div>
    </div>
  </section>;
}
