import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,CheckCircle2,Flame,Layers,Lightbulb,Plus,Save,Shield,SlidersHorizontal,Sun,Target,RefreshCcw} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {uid,type PointEntity,type Vec3} from '../engine/types';
import {hexRgb,rgbHex} from '../engine/environment';
import {RAD_FIELDS,RAD_PRESETS,radFromProps,validateRadValues,mergeRadProps,textureLightProps,mergeTexlightsProps,validateTextureDraft,createLightingEntity,styleFromProps,mergeStyleProps,validateStyleDraft,LIGHT_STYLES,validateShadowTarget,type RadValues,type TextureLightDraft,type TextureLightKind,type StyleDraft} from '../engine/advancedLighting';

type Mode='texture'|'rad'|'styles';
const DEFAULT_TEXTURE:TextureLightDraft={texture:'',brightness:800,color:[255,235,198],autoColor:true,gap:'3.0',maxDistance:'',targetname:''};
const DEFAULT_STYLE:StyleDraft={targetname:'',style:'0',pattern:'',initiallyDark:false};
const getPos=(object:{position:Vec3}|undefined):Vec3=>object?[object.position[0]+64,object.position[1],object.position[2]+48]:[0,0,96];
const lightClass=(c:string)=>c==='light'||c==='light_spot'||c==='light_surface';

export function AdvancedLightingPanel({mode}:{mode:Mode}){
 const t=useT();
 const objects=useEditor(s=>s.project.objects),selected=useEditor(s=>s.selected),selectedFace=useEditor(s=>s.selectedFace);
 const addObjects=useEditor(s=>s.addObjects),updateObject=useEditor(s=>s.updateObject),setSelected=useEditor(s=>s.setSelected);
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 const selectedObject=objects.find(o=>o.id===selected);
 const selectedEntity=selectedObject?.kind==='entity'?selectedObject:undefined;
 const notify=(message:string)=>{setError('');setNotice(message)};
 const fail=(message:string)=>{setNotice('');setError(message)};
 const go=(cb:()=>void)=>{try{cb()}catch(e){fail(String((e as Error).message||e))}};
 const [textureKind,setTextureKind]=useState<TextureLightKind>('light_surface');
 const [texture,setTexture]=useState<TextureLightDraft>(DEFAULT_TEXTURE);
 const textureList=useMemo(()=>[...new Set(objects.flatMap(o=>o.kind==='brush'?o.faces.map(f=>f.texture):[]))].filter(Boolean).sort((a,b)=>a.localeCompare(b)),[objects]);
 const texEntities=objects.filter((o):o is PointEntity=>o.kind==='entity'&&(o.classname==='light_surface'||o.classname==='info_texlights'));
 const selectedTexture=selectedObject?.kind==='brush'?selectedObject.faces[selectedFace??0]?.texture:undefined;
 const setTextureField=<K extends keyof TextureLightDraft>(field:K,value:TextureLightDraft[K])=>setTexture(old=>({...old,[field]:value}));
 useEffect(()=>{
  if(!selectedEntity)return;
  if(selectedEntity.classname==='light_surface'){
   const props=selectedEntity.props,rgb=(props._texcolor||'').trim().split(/\s+/).map(Number);
   const parsedLight=(props._light||'255 255 255 80').trim().split(/\s+/).map(Number);
   setTextureKind('light_surface');setTexture({texture:props._tex||'',brightness:Number.isFinite(parsedLight[3])?parsedLight[3]:80,color:rgb.length===3&&rgb.every(n=>Number.isFinite(n))?rgb as [number,number,number]:[255,235,198],autoColor:!props._texcolor,gap:props._texlightgap||'',maxDistance:props._frange||'',targetname:props.targetname||''});
  }
  if(selectedEntity.classname==='info_texlights')setTextureKind('info_texlights');
 },[selectedEntity?.id]);
 const saveTexture=()=>go(()=>{
  const errors=validateTextureDraft(texture,textureKind);if(errors.length)throw Error(errors.join(' '));
  const props=textureLightProps(textureKind,texture);
  if(textureKind==='light_surface'&&selectedEntity?.classname==='light_surface'){
   const next={...selectedEntity.props,...props};
   if(texture.autoColor)delete next._texcolor;if(!texture.gap)delete next._texlightgap;
   if(!texture.maxDistance)delete next._frange;
   if(!texture.targetname)delete next.targetname;
   updateObject(selectedEntity.id,{props:next});notify('Updated selected light_surface. Compile with SC-RAD to see the result.');return;
  }
  if(textureKind==='info_texlights'){
   const existing=(selectedEntity?.classname==='info_texlights'?selectedEntity:texEntities.find(e=>e.classname==='info_texlights'));
   if(existing){updateObject(existing.id,{props:mergeTexlightsProps(existing.props,texture)});setSelected(existing.id);notify('Texture entry saved inside info_texlights; other entries preserved.');return;}
  }
  const e=createLightingEntity(uid(),textureKind,getPos(selectedObject),props);
  addObjects([e]);setSelected(e.id);notify(`${textureKind} created. Compile with SC-RAD to check baked emission.`);
 });
 const useSelectedTexture=()=>{if(selectedTexture){setTextureField('texture',selectedTexture);notify(`Using texture ${selectedTexture}.`)}else fail('Select a brush face in MAP Editor, or enter a texture name.')};

 const radEntities=objects.filter((o):o is PointEntity=>o.kind==='entity'&&o.classname==='info_compile_parameters');
 const radEntity=(selectedEntity?.classname==='info_compile_parameters'?selectedEntity:radEntities[0]);
 const [radDraft,setRadDraft]=useState<RadValues>({});
 useEffect(()=>setRadDraft(radFromProps(radEntity?.props||{})),[radEntity?.id]);
 const saveRad=()=>go(()=>{
  const issues=validateRadValues(radDraft);if(issues.length)throw Error(issues.join(' '));
  const props=mergeRadProps(radEntity?.props||{spawnflags:'0'},radDraft);
  if(radEntity){updateObject(radEntity.id,{props});setSelected(radEntity.id)}
  else{const entity=createLightingEntity(uid(),'info_compile_parameters',getPos(selectedObject),props);addObjects([entity]);setSelected(entity.id)}
  notify('SC-RAD settings saved as native info_compile_parameters keyvalues. No compiler command was replaced.');
 });
 const [styleDraft,setStyleDraft]=useState<StyleDraft>(DEFAULT_STYLE);
 const styleEntity=selectedEntity&&lightClass(selectedEntity.classname)?selectedEntity:undefined;
 useEffect(()=>setStyleDraft(styleFromProps(styleEntity?.props||{})),[styleEntity?.id]);
 const saveStyle=()=>go(()=>{
  if(!styleEntity)throw Error('Select light, light_spot or light_surface in the scene first.');
  const issues=validateStyleDraft(styleDraft);if(issues.length)throw Error(issues.join(' '));
  updateObject(styleEntity.id,{props:mergeStyleProps(styleEntity.props,styleDraft)});
  notify(`Updated ${styleEntity.classname}; unrelated spawnflags were preserved.`);
 });
 const namedBrushEntities=useMemo(()=>objects.filter((o):o is PointEntity=>o.kind==='entity'&&!!o.props.targetname&&o.classname.startsWith('func_')),[objects]);
 const [shadowTarget,setShadowTarget]=useState(''),[shadowInitial,setShadowInitial]=useState(false);
 const addShadow=(kind:'light_shadow'|'light_bounce')=>go(()=>{
  const target=shadowTarget.trim();const matches=objects.filter(o=>o.kind==='entity'&&o.props?.targetname===target);
  if(!target||!matches.length)throw Error('Choose the name of an existing target brush entity first.');
  const entity=createLightingEntity(uid(),kind,getPos(selectedObject),{target,targetname:`${kind}_${uid().slice(0,8)}`,spawnflags:shadowInitial?'1':'0'});
  addObjects([entity]);setSelected(entity.id);
  const issues=validateShadowTarget(objects,target);notify(`${kind} created for ${target}. ${issues.length?issues.join(' '):'Remember to connect a trigger in Gameplay Studio.'}`);
 });
 return <div className="advanced-lighting-panel">
 {mode==='texture'&&<>
  <h3><Flame size={17}/> Texture Lighting Studio</h3>
  <p className="lighting-hint">Native emissive textures for SC-RAD. <code>light_surface</code> can filter individual faces and use the texture's color automatically. <code>info_texlights</code> stores texture-name → RGB/brightness entries for all matching faces.</p>
  <div className="al-choice"><button className={textureKind==='light_surface'?'active':''} onClick={()=>setTextureKind('light_surface')}>light_surface</button><button className={textureKind==='info_texlights'?'active':''} onClick={()=>setTextureKind('info_texlights')}>info_texlights</button></div>
  <label className="lighting-field">{t('WAD texture name')}<input aria-label="Texture name" value={texture.texture} onChange={e=>setTextureField('texture',e.target.value)} placeholder="+0~LIGHT6A" list="sven-texture-list"/></label>
  <datalist id="sven-texture-list">{textureList.slice(0,300).map(x=><option value={x} key={x}/>)}</datalist>
  <div className="lighting-actions"><button onClick={useSelectedTexture} disabled={!selectedTexture}><Target size={15}/> Use selected face texture</button></div>
  <p className="lighting-hint">{textureList.length} texture names used in the current MAP. The emissive texture must exist in the WAD files used to compile.</p>
  <label className="lighting-field">{t('Brightness (1–100000)')}<input type="number" min="1" max="100000" value={texture.brightness} onChange={e=>setTextureField('brightness',Number(e.target.value))}/></label>
  {textureKind==='light_surface'&&<label className="lighting-check"><input type="checkbox" checked={texture.autoColor} onChange={e=>setTextureField('autoColor',e.target.checked)}/> Use original texture color (no _texcolor override)</label>}
  {(textureKind==='info_texlights'||!texture.autoColor)&&<label className="lighting-field">{textureKind==='info_texlights'?t('Light RGB (required)'):t('Override texture color (_texcolor)')} <input aria-label="Texture light color" type="color" value={rgbHex(texture.color)} onChange={e=>setTextureField('color',hexRgb(e.target.value))}/></label>}
  {textureKind==='light_surface'&&<>
   <label className="lighting-field">{t('Dark gap in front of surface (_texlightgap)')}<select value={texture.gap} onChange={e=>setTextureField('gap',e.target.value)}><option value="">Compiler default</option><option value="0.0">No gap</option><option value="3.0">3 units</option><option value="12.0">12 units</option></select></label>
   <label className="lighting-field">{t('Face filter max distance (_frange, optional)')}<input value={texture.maxDistance} onChange={e=>setTextureField('maxDistance',e.target.value)} placeholder="No filter"/></label>
   <label className="lighting-field">Targetname for trigger (optional)<input value={texture.targetname||''} onChange={e=>setTextureField('targetname',e.target.value)} placeholder="lamp_panel_01"/></label>
  </>}
  <div className="lighting-actions"><button className="lighting-primary" onClick={saveTexture}><Save size={16}/>{textureKind==='light_surface'&&selectedEntity?.classname==='light_surface'?t('Update selected surface light'):t('Add / update texture light')}</button></div>
  <h3><Layers size={15}/> Existing texture lighting</h3>
  <div className="al-entity-list">{texEntities.map(e=><button key={e.id} className={selected===e.id?'active':''} onClick={()=>setSelected(e.id)}>{e.classname} · {e.props._tex||Object.keys(e.props).filter(k=>!['origin','classname','targetname'].includes(k)).slice(0,4).join(', ')}</button>)}{!texEntities.length&&<small>No texture lighting entities yet.</small>}</div>
  <p className="lighting-hint">For info_texlights, existing per-texture entries are retained when adding another. For light_surface, filter by brush entity name/class through the native property inspector if needed.</p>
 </>}
 {mode==='rad'&&<>
  <h3><SlidersHorizontal size={17}/> Advanced SC-RAD · info_compile_parameters</h3>
  <p className="lighting-hint">These controls write documented native keyvalues into <code>info_compile_parameters</code>. The installed SC-RAD reads them from the MAP. Empty fields inherit the compiler defaults; unrelated CSG/BSP/VIS values are preserved.</p>
  {radEntities.length>1&&<p className="al-warning"><AlertTriangle size={15}/> Multiple info_compile_parameters exist. Select the one to edit; check for conflicting RAD settings.</p>}
  {radEntity&&((Number(radEntity.props.spawnflags||'0')&16)!==0)&&<p className="al-warning"><AlertTriangle size={15}/> RAD is disabled by bit 16 in this entity's spawnflags. Change it in Properties before compiling.</p>}
  <div className="al-choice"><button onClick={()=>setRadDraft({...radDraft,...RAD_PRESETS.interior})}>{t('Indoor bounce')}</button><button onClick={()=>setRadDraft({...radDraft,...RAD_PRESETS.final})}>{t('Final detail')}</button><button onClick={()=>setRadDraft({...radDraft,...RAD_PRESETS.softSky})}>{t('Soft sky')}</button><button onClick={()=>setRadDraft(radFromProps(radEntity?.props||{}))}><RefreshCcw size={13}/> Reload</button></div>
  {(['Bounces','Quality','Color','Shadows'] as const).map(group=><div key={group} className="al-rad-section"><h4>{t(group)}</h4><div className="al-fields">{RAD_FIELDS.filter(f=>f.category===group).map(f=><label className="lighting-field" key={f.key}><span>{t(f.label)}</span><small><code>{f.key}</code> · {f.help}</small>{f.kind==='choice'?<select aria-label={f.key} value={radDraft[f.key]||''} onChange={e=>setRadDraft(old=>({...old,[f.key]:e.target.value}))}>{f.choices?.map(c=><option value={c.value} key={c.value}>{c.label}</option>)}</select>:<input aria-label={f.key} type="text" inputMode="decimal" value={radDraft[f.key]||''} onChange={e=>setRadDraft(old=>({...old,[f.key]:e.target.value}))} placeholder="Compiler default"/>}</label>)}</div></div>)}
  <div className="lighting-actions"><button className="lighting-primary" onClick={saveRad}><Save size={16}/>{radEntity?t('Apply SC-RAD settings'):t('Create SC-RAD settings entity')}</button></div>
  <p className="lighting-hint">SvenStudio already passes <code>-extra</code> to SC-RAD for final sampling. The separate ambient diagnostic BSP may override ambient settings; set it to Normal when testing this panel.</p>
 </>}
 {mode==='styles'&&<>
  <h3><Lightbulb size={17}/> Light styles & triggers</h3>
  <p className="lighting-hint">Select an existing <code>light</code>, <code>light_spot</code> or <code>light_surface</code>. Trigger wiring is configured in Gameplay Studio. These are GoldSrc lightstyles baked by RAD, not runtime dynamic shadows.</p>
  <div className="al-entity-list">{objects.filter((o):o is PointEntity=>o.kind==='entity'&&lightClass(o.classname)).map(e=><button key={e.id} className={selected===e.id?'active':''} onClick={()=>setSelected(e.id)}>{e.classname} · {e.props.targetname||e.name} · {e.props._light}</button>)}</div>
  <label className="lighting-field">{t('Targetname')}<input value={styleDraft.targetname} onChange={e=>setStyleDraft(old=>({...old,targetname:e.target.value}))} placeholder="lamp_hall_01" disabled={!styleEntity}/></label>
  <label className="lighting-field">{t('Appearance (style)')}<select value={styleDraft.style} onChange={e=>setStyleDraft(old=>({...old,style:e.target.value}))} disabled={!styleEntity}>{LIGHT_STYLES.map(([value,label])=><option key={value} value={value}>{value} · {label}</option>)}</select></label>
  <label className="lighting-field">{t('Custom light pattern (a–z, 1–64 characters)')}<input value={styleDraft.pattern} onChange={e=>setStyleDraft(old=>({...old,pattern:e.target.value}))} placeholder="mmnmmomm..." disabled={!styleEntity}/></label>
  <label className="lighting-check"><input type="checkbox" checked={styleDraft.initiallyDark} onChange={e=>setStyleDraft(old=>({...old,initiallyDark:e.target.checked}))} disabled={!styleEntity}/> Initially dark (spawnflags bit 1)</label>
  <div className="lighting-actions"><button className="lighting-primary" onClick={saveStyle} disabled={!styleEntity}><Save size={15}/> Apply light style</button></div>
  <h3><Shield size={17}/> Switchable brush shadows & indirect bounce</h3>
  <p className="lighting-hint"><code>light_shadow</code> and <code>light_bounce</code> target a named opaque brush entity. The entity must have <code>zhlt_lightflags</code> bit 2 enabled and be configured to appear/disappear using triggers. These entities cannot switch multiple light_environment sources.</p>
  <label className="lighting-field">{t('Target brush entity name')}<input list="al-shadow-targets" value={shadowTarget} onChange={e=>setShadowTarget(e.target.value)} placeholder="named_func_wall"/></label>
  <datalist id="al-shadow-targets">{namedBrushEntities.map(e=><option key={e.id} value={e.props.targetname}>{e.classname}</option>)}</datalist>
  {shadowTarget&&validateShadowTarget(objects,shadowTarget).map(msg=><p className="al-warning" key={msg}><AlertTriangle size={14}/>{msg}</p>)}
  <label className="lighting-check"><input type="checkbox" checked={shadowInitial} onChange={e=>setShadowInitial(e.target.checked)}/> Spawnflags bit 1 (initial state; see Sven Co-op wiki)</label>
  <div className="lighting-actions"><button onClick={()=>addShadow('light_shadow')}><Plus size={14}/> Add light_shadow</button><button onClick={()=>addShadow('light_bounce')}><Plus size={14}/> Add light_bounce</button></div>
  <p className="lighting-hint">Shadow helper entities create their own targetname, and preserve the target brush. No opaque flags or triggers are changed automatically.</p>
 </>}
 {(notice||error)&&<p role="status" className={error?'al-warning':'lighting-valid'}>{error?<AlertTriangle size={15}/>:<CheckCircle2 size={15}/>} {error||notice}</p>}
 <p className="lighting-hint"><Sun size={13}/> Browser preview remains approximate. Compile and inspect the BSP inside Sven Co-op to verify all advanced lighting.</p>
 </div>;
}
