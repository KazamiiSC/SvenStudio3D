import {useEffect,useMemo,useState} from 'react';
import {CloudFog,CloudSun,Lightbulb,Sun,SunMoon,Flashlight,MapPin,Plus,CheckCircle2,AlertTriangle,Eye,EyeOff,SlidersHorizontal,X,Link2} from 'lucide-react';
import {useEditor} from '../store';
import type {PointEntity,Vec3} from '../engine/types';
import {makeEnvironment,isEnvironmentKind,parseLight,lightString,hexRgb,rgbHex,LIGHT_PRESETS,validateEnvironment,type EnvironmentKind,type EnvironmentPreset} from '../engine/environment';
import {useT} from '../i18n';
const KINDS:EnvironmentKind[]=['light','light_spot','light_environment','env_fog','trigger_changesky'];
const NAME:Record<EnvironmentKind,string>={light:'Point Light',light_spot:'Spotlight',light_environment:'Sun / Sky Light',env_fog:'Fog',trigger_changesky:'Change Sky Trigger'};
const ICON={light:Lightbulb,light_spot:Flashlight,light_environment:Sun,env_fog:CloudFog,trigger_changesky:CloudSun};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
export function LightingStudio({onClose}:{onClose:()=>void}){
 const t=useT();const gameDir=useEditor(s=>s.settings.gameDir);const objects=useEditor(s=>s.project.objects),selected=useEditor(s=>s.selected),world=useEditor(s=>s.project.world);
 const add=useEditor(s=>s.addObjects),setSelected=useEditor(s=>s.setSelected),setProp=useEditor(s=>s.setObjectProp),changeWorld=useEditor(s=>s.changeWorld),startPlace=useEditor(s=>s.startEnvironmentPlacement);
 const preview=useEditor(s=>s.environmentPreview),setPreview=useEditor(s=>s.setEnvironmentPreview),fogPreview=useEditor(s=>s.fogPreview),setFogPreview=useEditor(s=>s.setFogPreview);
 const shadows=useEditor(s=>s.previewShadows),setShadows=useEditor(s=>s.setPreviewShadows),ranges=useEditor(s=>s.showLightRanges),setRanges=useEditor(s=>s.setShowLightRanges);
 const [skies,setSkies]=useState<{name:string;source:string;complete:boolean;faces:number;thumbnailSide:string}[]>([]),[skyQuery,setSkyQuery]=useState(''),[skyStatus,setSkyStatus]=useState('');
 const [ambient,setAmbient]=useState('170 200 255 80');
 const [kind,setKind]=useState<EnvironmentKind>('light'),[color,setColor]=useState('#ffe8c4'),[brightness,setBrightness]=useState(350),[cone,setCone]=useState(30),[outer,setOuter]=useState(55),[pitch,setPitch]=useState(-45),[yaw,setYaw]=useState(0),[fogStart,setFogStart]=useState(256),[fogEnd,setFogEnd]=useState(2048),[sky,setSky]=useState(world.skyname||'desert'),[notice,setNotice]=useState('');
 useEffect(()=>{
  let active=true;
  if(!gameDir){setSkies([]);setSkyStatus(t('Set the game directory to browse installed skies.'));return;}
  setSkyStatus(t('Scanning installed skies…'));
  fetch('/api/assets/skies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameDir})})
   .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||`HTTP ${r.status}`);return data.items as {name:string;source:string;complete:boolean;faces:number;thumbnailSide:string}[]})
   .then(items=>{if(active){setSkies(items);setSkyStatus(items.length?`${items.length} ${t('sky collections found')}`:t('No skyboxes found in gfx/env.'))}})
   .catch(err=>{if(active){setSkies([]);setSkyStatus(String(err))}});
  return()=>{active=false};
 },[gameDir]);
 const entries=useMemo(()=>objects.filter((o):o is PointEntity=>o.kind==='entity'&&isEnvironmentKind(o.classname)),[objects]);
 const active=entries.find(x=>x.id===selected)||null;
 const warnings=useMemo(()=>validateEnvironment(objects),[objects]);
 useEffect(()=>{if(!active)return;setKind(active.classname as EnvironmentKind);const p=active.props;
   if(active.classname.startsWith('light')){const l=parseLight(p._light);setColor(rgbHex(l.rgb));setBrightness(l.brightness);}
   else if(active.classname==='env_fog'){setColor(rgbHex((p.rendercolor||'115 141 176').split(/\s+/).map(Number)));setFogStart(Number(p.iuser2)||256);setFogEnd(Number(p.iuser3)||2048);}
   if(active.classname==='light_environment')setAmbient(p._diffuse_light||'170 200 255 80');
   if(active.classname==='light_spot'){setCone(Number(p._cone)||30);setOuter(Number(p._cone2)||55);}
   if(p.pitch!==undefined)setPitch(Number(p.pitch)||0);
   setYaw(Number(p.angles?.split(' ')[1])||0);
   if(p.skyname)setSky(p.skyname);
 },[active?.id]);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onClose()}};window.addEventListener('keydown',handler,true);return()=>window.removeEventListener('keydown',handler,true)},[onClose]);
 const applyPreset=(name:EnvironmentPreset)=>{const preset=LIGHT_PRESETS[name],parsed=parseLight(preset.light);setKind('light_environment');setBrightness(parsed.brightness);setColor(rgbHex(parsed.rgb));setPitch(Number(preset.pitch));setAmbient(preset.ambient);setNotice(t('Preset selected. Create a sun light to apply it. Sky textures are not generated automatically.'))};
 const make=()=>{const props:Record<string,string>={};
   if(kind.startsWith('light')){props._light=lightString(hexRgb(color),brightness);if(kind==='light_spot'){props._cone=String(cone);props._cone2=String(outer);}if(kind==='light_environment')props._diffuse_light=ambient;if(kind!=='light'){props.pitch=String(pitch);props.angles=`0 ${yaw} 0`;}}
   if(kind==='env_fog'){props.rendercolor=hexRgb(color).join(' ');props.iuser2=String(fogStart);props.iuser3=String(fogEnd);}
   if(kind==='trigger_changesky'){props.skyname=sky;}
   return props;
 };
 const place=()=>{const entity=makeEnvironment(kind,[0,0,64],make());const issues=validateEnvironment([entity]);if(issues.some(x=>x.severity==='error')){setNotice(issues.map(x=>x.message).join('; '));return;}startPlace(kind,make());onClose()};
 const createNear=()=>{const origin=objects.find(o=>o.id===selected)?.position||[0,0,64];const position=[origin[0]+64,origin[1],origin[2]+48] as Vec3;const entity=makeEnvironment(kind,position,make());const issues=validateEnvironment([entity]);if(issues.some(x=>x.severity==='error')){setNotice(issues.map(x=>x.message).join('; '));return;}add([entity]);setSelected(entity.id);setNotice(`${kind} ${t('created')}`)};
 const edit=(key:string,value:string)=>{if(!active)return;setProp(active.id,key,value)};
 const applyToSelected=()=>{if(!active){setNotice(t('Select an environment entity first.'));return;}
  const props=make();if(kind!==active.classname){setNotice(t('Select the matching entity type to edit.'));return;}
  const candidate={...active,props:{...active.props,...props}};
  const issues=validateEnvironment([candidate]);if(issues.some(x=>x.severity==='error')){setNotice(issues.map(x=>x.message).join('; '));return;}
  Object.entries(props).forEach(([key,value])=>edit(key,value));setNotice(t('Native Svengine keyvalues updated.'));
 };
 const saveSky=()=>{if(!/^[\w-]{1,64}$/.test(sky)){setNotice(t('Use a valid sky prefix (letters, numbers, dash, underscore).'));return;}changeWorld('skyname',sky);setNotice(t('Sky prefix saved. SKY-textured faces are required in the game.'))};
 return <div className="modal-backdrop lighting-backdrop" onMouseDown={onClose}><section className="lighting-studio" role="dialog" aria-modal="true" aria-label="Lighting & Environment Studio" onMouseDown={e=>e.stopPropagation()}>
 <header className="lighting-header"><span className="lighting-header-symbol"><SunMoon size={23}/></span><div><strong>{t('Lighting & Environment Studio')}</strong><small>Svengine · light · light_spot · light_environment · env_fog · trigger_changesky</small></div><span className="lighting-count">{entries.length} {t('entities')}</span><button onClick={onClose} title={t('Close')}><X size={20}/></button></header>
 <div className="lighting-content">
 <aside className="lighting-side"><h3><SunMoon size={15}/>{t('Create environment entity')}</h3><div className="lighting-kind-list">{KINDS.map(k=>{const Icon=ICON[k];return <button key={k} className={kind===k?'active':''} onClick={()=>{setKind(k);setNotice('')}}><Icon size={17}/><span>{t(NAME[k])}</span><small>{k}</small></button>})}</div>
 <h3><CloudSun size={16}/>{t('Lighting presets')}</h3><div className="lighting-presets">{(Object.keys(LIGHT_PRESETS) as EnvironmentPreset[]).map(k=><button key={k} onClick={()=>applyPreset(k)}>{t(LIGHT_PRESETS[k].label)}<small>{LIGHT_PRESETS[k].light}</small></button>)}</div>
 <h3><Eye size={16}/>{t('Viewport preview')}</h3><label className="lighting-check"><input type="checkbox" checked={preview} onChange={e=>setPreview(e.target.checked)}/>{t('Approximate lighting')}</label><label className="lighting-check"><input type="checkbox" checked={fogPreview} onChange={e=>setFogPreview(e.target.checked)}/>{t('Fog preview')}</label>
 <label className="lighting-check"><input type="checkbox" checked={shadows} onChange={e=>setShadows(e.target.checked)}/>{t('Preview shadows (selected light)')}</label>
 <label className="lighting-check"><input type="checkbox" checked={ranges} onChange={e=>setRanges(e.target.checked)}/>{t('Show point light radius')}</label>
 <p className="lighting-hint">{t('Viewport preview is not SC-RAD lightmaps; compile for final light and shadows.')}</p></aside>
 <section className="lighting-main"><h3><SlidersHorizontal size={17}/>{t('Environment properties')} — <code>{kind}</code></h3>
 {kind.startsWith('light')&&<><label className="lighting-field">{t('Light color')}<input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><label className="lighting-field">{t('Brightness')} ({brightness})<input type="range" min="1" max="1400" step="10" value={clamp(brightness,1,1400)} onChange={e=>setBrightness(+e.target.value)}/><input type="number" min="1" max="100000" value={brightness} onChange={e=>setBrightness(clamp(+e.target.value,1,100000))}/></label>
 {kind==='light_spot'&&<><label className="lighting-field">{t('Inner angle')} — _cone <input type="number" min="1" max="180" value={cone} onChange={e=>setCone(clamp(+e.target.value,1,180))}/></label><label className="lighting-field">{t('Outer angle')} — _cone2 <input type="number" min="1" max="180" value={outer} onChange={e=>setOuter(clamp(+e.target.value,1,180))}/></label></>}
 {kind!=='light'&&<><label className="lighting-field">Pitch <input type="number" min="-90" max="90" value={pitch} onChange={e=>setPitch(clamp(+e.target.value,-90,90))}/></label><label className="lighting-field">Yaw <input type="number" min="-360" max="360" value={yaw} onChange={e=>setYaw(clamp(+e.target.value,-360,360))}/></label></>}
 <p className="lighting-hint">{kind==='light_environment'?t('Sky lighting needs SKY-textured brushes to affect the compiled map.'):t('Light color and brightness are exported through _light.')}</p></>}
 {kind==='env_fog'&&<><label className="lighting-field">{t('Fog color')} <input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><label className="lighting-field">{t('Fog start distance')} — iuser2<input type="number" min="1" max="131072" value={fogStart} onChange={e=>setFogStart(Math.round(+e.target.value))}/></label><label className="lighting-field">{t('Fog end distance')} — iuser3<input type="number" min="2" max="131072" value={fogEnd} onChange={e=>setFogEnd(Math.round(+e.target.value))}/></label><p className="lighting-hint">{t('Fog is displayed in-game only for players with fog enabled. Dynamic preview is approximate.')}</p></>}
 {kind==='trigger_changesky'&&<p className="lighting-hint">{t('Use Gameplay Studio to trigger this entity. A static sky is set on worldspawn.')}</p>}
 {(kind==='trigger_changesky'||kind==='light_environment')&&<label className="lighting-field">{t('Sky texture prefix')} <input value={sky} onChange={e=>setSky(e.target.value)} placeholder="desert"/></label>}
 <h3><CloudSun size={17}/>{t('Installed sky browser')}</h3>
 <div className="lighting-sky-search"><input aria-label={t('Search skies')} value={skyQuery} onChange={e=>setSkyQuery(e.target.value)} placeholder={t('Search skies')}/><small>{skyStatus}</small></div>
 <div className="lighting-sky-catalog">{skies.filter(item=>item.name.toLowerCase().includes(skyQuery.toLowerCase())).slice(0,120).map(item=><button type="button" key={item.source+'|'+item.name} className={sky===item.name?'active':''} onClick={()=>{setSky(item.name);setNotice(item.complete?t('Sky selected; save to worldspawn to apply.') :t('Incomplete sky set: one or more of the six faces are missing.'))}}>
 {item.thumbnailSide?<img loading="lazy" src={`/api/assets/sky-face?gameDir=${encodeURIComponent(gameDir)}&source=${encodeURIComponent(item.source)}&sky=${encodeURIComponent(item.name)}&side=${item.thumbnailSide}`} alt="" onError={e=>{e.currentTarget.style.visibility='hidden'}}/>:<span>☀</span>}
 <strong>{item.name}</strong><small>{item.faces}/6 · {item.source}</small></button>)}
 </div>
 <div className="lighting-actions"><button className="lighting-primary" onClick={place}><MapPin size={16}/>{t('Place in 3D')}</button><button onClick={createNear}><Plus size={16}/>{t('Create near selection')}</button><button disabled={!active||active.classname!==kind} onClick={applyToSelected}><SlidersHorizontal size={15}/>{t('Apply to selected')}</button></div>
 <h3><CloudSun size={17}/>{t('World sky')}</h3><div className="lighting-sky"><input aria-label="world skyname" value={sky} onChange={e=>setSky(e.target.value)}/><button onClick={saveSky}><CheckCircle2 size={15}/>{t('Save skyname')}</button></div><p className="lighting-hint">worldspawn.skyname = <code>{world.skyname||'desert'}</code>. {t('Enter a sky prefix installed under gfx/env; six sky faces are required.')}</p>
 {notice&&<p role="status" className="lighting-notice">{notice}</p>}
 </section>
 <aside className="lighting-side lighting-inspector"><h3><Lightbulb size={16}/>{t('Scene environment')}</h3><div className="lighting-entities">{entries.map(entity=><button key={entity.id} className={entity.id===selected?'active':''} onClick={()=>setSelected(entity.id)}><span>{entity.classname}</span><small>{entity.props.targetname||entity.props._light||entity.props.skyname||entity.props.rendercolor}</small></button>)}{!entries.length&&<p className="lighting-hint">{t('No environment entities yet.')}</p>}</div>
 {active&&<p className="lighting-hint"><Link2 size={13}/> {t('Selected entity')}: {active.name} · {active.id.slice(0,8)}</p>}
 <h3><AlertTriangle size={16}/>{t('Environment validation')}</h3>{warnings.length?<div className="lighting-issues">{warnings.map((issue,i)=><button key={i} onClick={()=>setSelected(issue.entityId)}><AlertTriangle size={13}/>{issue.message}</button>)}</div>:<p className="lighting-valid"><CheckCircle2 size={16}/>{t('No invalid light or fog keyvalues found.')}</p>}
 <p className="lighting-hint"><EyeOff size={14}/> {t('Visual previews are editor-only and do not modify BSP lightmaps.')}</p></aside>
 </div><footer className="lighting-footer">{t('Compiled lighting is calculated by SC-RAD; sky and fog effects depend on the game settings.')}</footer>
 </section></div>;
}
