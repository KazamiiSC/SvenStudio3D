import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Line,OrbitControls} from '@react-three/drei';
import {Camera,Clapperboard,MapPin,Plus,Play,Pause,Save,ShieldCheck,AlertTriangle,CheckCircle2,MousePointer2,X,Route,Eye,Maximize2,Minimize2,SlidersHorizontal,RotateCcw} from 'lucide-react';
import {useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import {useEditor} from '../store';
import {useT} from '../i18n';
import type {Brush,PointEntity,TextureAsset,Vec3} from '../engine/types';
import {buildMeshGeometry,gameToThree,toRenderQuaternion} from '../engine/geometry';
import {pointInsideCinematicBrush,diagnoseCinematicPath} from '../engine/cinematicPreview';
import {goldSrcMaterial} from '../engine/previewEnhancements';
import {parseLight,rgbHex} from '../engine/environment';
import {previewCone,previewDirection,previewLocalLight,previewSunLight} from '../engine/lightingPreview';
import {defaultCinematicOptions,previewCinematicPosition,previewCinematicSegmentPosition,cinematicRouteLegs,readCinematicScene,type CinematicScene,type CinematicOptions,type CameraSettings} from '../engine/cinematic';

// Read-only preview textures: same WAD asset data and starter assets as the editor.
// None of these materials, lights or markers are exported to GoldSrc.
type PreviewShadingMode='wireframe'|'solid'|'material'|'rendered';
const starterTextureNames=new Set(['SV_BRICK01','SV_CONCRET','SV_TILE01','SV_METAL01','SV_GRID01']);
const assetNameIndexes=new WeakMap<TextureAsset[],Map<string,TextureAsset>>();
const textureCache=new Map<string,THREE.Texture>();
const materialCache=new Map<string,THREE.Material>();
function getPreviewTexture(name:string,assets:TextureAsset[]):THREE.Texture|undefined{
  let index=assetNameIndexes.get(assets);
  if(!index){index=new Map(assets.map(asset=>[asset.name.toLowerCase(),asset]));assetNameIndexes.set(assets,index);}
  const found=index.get(name.toLowerCase());
  const starter=starterTextureNames.has(name.toUpperCase());
  if(!found&&!starter)return;
  const key=found?`wad:${found.wad}:${found.name}:${found.sourceId||'legacy'}`:`starter:${name.toUpperCase()}`;
  let texture=textureCache.get(key);
  if(texture)return texture;
  texture=new THREE.TextureLoader().load(found?.dataUrl||`/starter-textures/${name.toUpperCase()}.png`,undefined,undefined,err=>{
    console.warn('Cinematic preview texture unavailable:',name,err);
  });
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.NearestFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.colorSpace=THREE.SRGBColorSpace;
  textureCache.set(key,texture);
  return texture;
}
function getPreviewMaterials(brush:Brush,assets:TextureAsset[],shade:PreviewShadingMode):THREE.Material[]{
  const palette=['#9eacbd','#b3ad9e','#a8b9ba','#b0a6b0','#8faaa3','#b6b9a7'];
  return brush.faces.map((face,index)=>{
    const texture=shade==='material'||shade==='rendered'?getPreviewTexture(face.texture,assets):undefined;
    const goldsrc=goldSrcMaterial(face.texture);
    const color=shade==='solid'?'#9daaba':shade==='wireframe'?'#6bdaed':texture?'#ffffff':palette[index%palette.length];
    const key=`${shade}:${color}:${texture?.uuid||'none'}:${goldsrc.kind}:${goldsrc.opacity}`;
    let material=materialCache.get(key);
    if(!material){
      if(shade==='wireframe')material=new THREE.MeshBasicMaterial({color,wireframe:true,side:THREE.DoubleSide});
      else if(shade==='solid')material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});
      else {
        const translucent=['water','glass','additive'].includes(goldsrc.kind);
        const opts={map:texture,color,side:THREE.DoubleSide,transparent:translucent,
          opacity:translucent?goldsrc.opacity:1,alphaTest:goldsrc.kind==='masked'?goldsrc.alphaTest:0,
          depthWrite:!translucent,blending:goldsrc.kind==='additive'?THREE.AdditiveBlending:THREE.NormalBlending};
        material=shade==='rendered'?new THREE.MeshStandardMaterial({...opts,roughness:.95}):new THREE.MeshBasicMaterial(opts);
      }
      materialCache.set(key,material);
    }
    return material;
  });
}
function PreviewBrush({object,assets,shade}:{object:Brush;assets:TextureAsset[];shade:PreviewShadingMode}){
  const geometry=useMemo(()=>buildMeshGeometry(object),[object]);
  const materials=useMemo(()=>getPreviewMaterials(object,assets,shade),[object,assets,shade]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const scale:[number,number,number]=[object.scale[0],object.scale[2],object.scale[1]];
  return <mesh geometry={geometry} material={materials} position={gameToThree(object.position)}
    quaternion={toRenderQuaternion(object.rotation)} scale={scale} raycast={()=>null}/>;
}
/** Same light parsing, attenuation and cone calculations as the main Rendered viewport.
 * This does not reproduce SC-RAD occlusion, baked lightmaps or shadow maps. */
function NativePreviewLight({entity}:{entity:PointEntity}){
  const parsed=parseLight(entity.props._light);
  const color=rgbHex(parsed.rgb);
  const position=gameToThree(entity.position);
  const yaw=entity.props.angles?.trim().split(/\s+/)[1]||'0';
  const direction=previewDirection(entity.props.pitch,yaw);
  const target=useMemo(()=>new THREE.Object3D(),[]);
  target.position.set(position.x+direction[0]*450,position.y+direction[1]*450,position.z+direction[2]*450);
  if(entity.classname==='light_environment'){
    const brightness=previewSunLight(parsed.brightness,parseLight(entity.props._diffuse_light).brightness);
    return <><directionalLight color={color} position={[-direction[0]*1100,-direction[1]*1100,-direction[2]*1100]} intensity={brightness.intensity}/>
      <hemisphereLight args={[color,'#283746',brightness.diffuseIntensity]}/></>;
  }
  if(entity.classname==='light_spot'){
    const config=previewLocalLight(parsed.brightness,'spot'),cone=previewCone(entity.props._cone,entity.props._cone2);
    return <><primitive object={target}/><spotLight position={position} target={target} color={color} intensity={config.intensity} distance={config.distance}
      angle={cone.angle} penumbra={cone.penumbra} decay={config.decay}/></>;
  }
  const config=previewLocalLight(parsed.brightness);
  return <pointLight position={position} color={color} intensity={config.intensity} distance={config.distance} decay={config.decay}/>;
}
function PreviewCamera({scene,seconds,mode,segmentSpeeds}:{scene:CinematicScene;seconds:number;mode:'camera'|'inspect';segmentSpeeds:Record<string,number>}){
  const {camera}=useThree();
  const {center,distance}=useMemo(()=>{
    const positions=[scene.camera.position,...scene.route.map(p=>p.position),...(scene.lookTarget?[scene.lookTarget.position]:[])];
    const box=new THREE.Box3().setFromPoints(positions.map(gameToThree));
    return {center:box.getCenter(new THREE.Vector3()),distance:Math.max(160,box.getSize(new THREE.Vector3()).length())};
  },[scene]);
  useEffect(()=>{
    if(mode==='inspect'){
      camera.position.copy(center).add(new THREE.Vector3(distance*.85,distance*.65,distance*.85));
      camera.up.set(0,1,0);camera.lookAt(center);camera.updateProjectionMatrix();
    }
  },[mode,scene.camera.id,center,distance,camera]);
  useFrame(()=>{
    if(mode==='inspect')return;
    const pos=gameToThree(Object.keys(segmentSpeeds).length?previewCinematicSegmentPosition(scene,seconds,segmentSpeeds):previewCinematicPosition(scene,seconds));
    const target=gameToThree(scene.lookTarget?.position||[scene.camera.position[0]+200,scene.camera.position[1],scene.camera.position[2]]);
    if(pos.distanceToSquared(target)<1)target.x+=50;
    camera.position.copy(pos);
    camera.up.set(0,1,0);camera.lookAt(target);
  });
  return mode==='inspect'?<OrbitControls makeDefault target={center.toArray()} enableDamping dampingFactor={.14}
    maxDistance={20000} minDistance={8} enablePan/>:null;
}
function ScenePreview({scene,objects,assets,seconds,mode,shade,segmentSpeeds,lights}:{scene:CinematicScene;objects:Brush[];assets:TextureAsset[];seconds:number;mode:'camera'|'inspect';shade:PreviewShadingMode;segmentSpeeds:Record<string,number>;lights:PointEntity[]}){
  const brushes=useMemo(()=>objects.filter(b=>!b.hidden).slice(0,250),[objects]);
  const path=useMemo(()=>[scene.camera.position,...scene.route.map(o=>o.position)].map(gameToThree),[scene]);
  const renderedLights=useMemo(()=>lights.filter(e=>!e.hidden&&['light','light_spot','light_environment'].includes(e.classname)).slice(0,24),[lights]);
  return <Canvas dpr={[1,1.25]} frameloop="always" camera={{fov:75,near:1,far:80000,position:[0,150,0]}}
      gl={{antialias:false,powerPreference:'low-power'}}>
    <color attach="background" args={[shade==='rendered'?'#19283a':'#273b51']}/>
    {shade==='rendered'?<><ambientLight intensity={.33}/><directionalLight position={[400,900,220]} intensity={.08}/>
      {renderedLights.map(e=><NativePreviewLight key={e.id} entity={e}/>)}</>:null}
    <PreviewCamera scene={scene} seconds={seconds} mode={mode} segmentSpeeds={segmentSpeeds}/>
    {brushes.map(b=><PreviewBrush key={b.id} object={b} assets={assets} shade={shade}/>)}
    {mode==='inspect'&&<>
      {path.length>1&&<Line points={path} color="#40d5ff" lineWidth={2} dashed dashSize={12} gapSize={8}/>}
      <mesh position={gameToThree(scene.camera.position)}><sphereGeometry args={[12,12,8]}/><meshBasicMaterial color="#ffc45a" depthTest={false}/></mesh>
      {scene.route.map(p=><mesh key={p.id} position={gameToThree(p.position)}><sphereGeometry args={[8,10,8]}/><meshBasicMaterial color="#d69cff" depthTest={false}/></mesh>)}
      {scene.lookTarget&&<mesh position={gameToThree(scene.lookTarget.position)}><octahedronGeometry args={[11]}/><meshBasicMaterial color="#5df5c7" depthTest={false}/></mesh>}
    </>}
  </Canvas>;
}
const asNumber=(value:string,defaultValue:number)=>Number.isFinite(Number(value))?Number(value):defaultValue;
function settingsFrom(scene:CinematicScene):CameraSettings{
  const f=Number(scene.camera.props.spawnflags)||0;
  return {duration:asNumber(scene.camera.props.wait,10),speed:asNumber(scene.camera.props.speed,180),freezePlayer:!!(f&4),allPlayers:!!(f&8),invulnerable:!!(f&256),
    acceleration:asNumber(scene.camera.props.acceleration,500),deceleration:asNumber(scene.camera.props.deceleration,500),turnspeed:asNumber(scene.camera.props.turnspeed,40),
    startAtPlayer:!!(f&1),followPlayer:!!(f&2),forceView:!!(f&16),noInstantTurn:!!(f&32),instantMove:!!(f&64),
    hideHealth:scene.camera.props.hud_health==='1',hideFlashlight:scene.camera.props.hud_flashlight==='1',hideWeapons:scene.camera.props.hud_weapons==='1'};
}
function NumInput({label,value,onChange,min=-131072,max=131072,step=1}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;step?:number}){
  return <label className="cine-field"><span>{label}</span><input type="number" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
export function CinematicCameraStudio({onClose}:{onClose:()=>void}){
  const t=useT();
  const objects=useEditor(s=>s.project.objects),selected=useEditor(s=>s.selected);
  const make=useEditor(s=>s.createCinematic),update=useEditor(s=>s.updateCinematic);
  const select=useEditor(s=>s.setSelected),beginPath=useEditor(s=>s.startCinematicPlacement);
  const addLog=useEditor(s=>s.appendLogs);
  const setPreviewSpeed=useEditor(s=>s.setCinematicPreviewSpeed);
  const removeLastPoint=useEditor(s=>s.removeLastCinematicPoint);
  const savedSpeeds=useEditor(s=>s.project.cinematicPreviewSpeeds);
  const segmentSpeeds=useMemo(()=>savedSpeeds||{},[savedSpeeds]);
  const cameras=useMemo(()=>objects.filter((o):o is PointEntity=>o.kind==='entity'&&o.classname==='trigger_camera'),[objects]);
  const initial=useMemo(()=>{
    const o=objects.find(o=>o.id===selected);
    return o?.kind==='entity'&&o.classname==='trigger_camera'?o:
      cameras.find(cam=>!!cam.group&&cam.group===o?.group)||null;
  },[objects,selected,cameras]);
  const [cameraId,setCameraId]=useState<string|null>(initial?.id||null);
  const scene=useMemo(()=>cameraId?readCinematicScene(objects,cameraId):null,[objects,cameraId]);
  const anchor=()=>objects.find(o=>o.id===selected)?.position||[0,0,96] as Vec3;
  const [draft,setDraft]=useState<CinematicOptions>(()=>defaultCinematicOptions(anchor()));
  const [edit,setEdit]=useState<CameraSettings>({duration:10,speed:180,freezePlayer:true,allPlayers:false,invulnerable:true});
  const [notice,setNotice]=useState('');
  const [seconds,setSeconds]=useState(0),[playing,setPlaying]=useState(false);
  const [viewMode,setViewMode]=useState<'camera'|'inspect'>('camera');
  const [shade,setShade]=useState<PreviewShadingMode>('material');
  const [expanded,setExpanded]=useState(false);
  const [playRate,setPlayRate]=useState(1);
  const lastTime=useRef<number|null>(null);
  useEffect(()=>{if(scene)setEdit(settingsFrom(scene));setPlaying(false);setSeconds(0);setViewMode('camera');},[cameraId]);
  useEffect(()=>{if(!playing||!scene)return;
    let frame=0;lastTime.current=null;
    const animate=(now:number)=>{
      const dt=lastTime.current===null?0:Math.min(.1,(now-lastTime.current)/1000);
      lastTime.current=now;
      setSeconds(value=>{const end=Math.max(1,edit.duration);if(value+dt*playRate>=end){setPlaying(false);return end;}return value+dt*playRate;});
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(frame);lastTime.current=null;};
  },[playing,scene?.camera.id,edit.duration,playRate]);
  const guarded=(fn:()=>void)=>{try{fn();setNotice('')}catch(error){setNotice(String(error instanceof Error?error.message:error))}};
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(expanded)setExpanded(false);else onClose();}};
    window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
  },[onClose,expanded]);
  const create=()=>{
    try{
      const id=make(draft);setCameraId(id);setNotice(t('Camera created. Link a trigger or add route points.'));
      addLog(['Cinematic Camera Studio: trigger_camera + info_target created.']);
    }catch(error){setNotice(String(error instanceof Error?error.message:error));}
  };
  const placePoint=()=>{
    if(!scene||!scene.generated)return;
    guarded(()=>{beginPath(scene.camera.id);setPlaying(false);onClose();});
  };
  const focus=(id:string)=>{select(id);onClose();};
  const activators=objects.filter((o):o is PointEntity=>o.kind==='entity'&&['trigger_once','trigger_multiple','trigger_auto','trigger_relay','func_button'].includes(o.classname));
  const availableActivator=activators.find(o=>o.id===draft.activatorId);
  const warningActivator=availableActivator?.props.target?.trim()?t('This activator already has a target and will not be overwritten.'):'';
  const parts=useMemo(()=>objects.filter((o):o is Brush=>o.kind==='brush'),[objects]);
  const assets=useEditor(s=>s.textureAssets);
  const lights=useMemo(()=>objects.filter((o):o is PointEntity=>o.kind==='entity'&&o.classname.startsWith('light')),[objects]);
  const routeLegs=useMemo(()=>scene?cinematicRouteLegs(scene):[],[scene]);
  const pathWarnings=useMemo(()=>scene?diagnoseCinematicPath(scene,parts):[],[scene,parts]);
  const estimatedDuration=routeLegs.reduce((sum,leg)=>sum+leg.distance/(segmentSpeeds[leg.to.id]||Math.max(1,edit.speed)),0);
  const jumpToLeg=(index:number)=>{
    const elapsed=routeLegs.slice(0,index+1).reduce((sum,leg)=>sum+leg.distance/(segmentSpeeds[leg.to.id]||Math.max(1,edit.speed)),0);
    setSeconds(Math.min(edit.duration,elapsed));setPlaying(false);setViewMode('camera');
  };
  const diagnosticSeconds=Math.round(seconds*2)/2; // Cap expensive brush-solid checks to 2 samples/second.
  const cameraInside=useMemo(()=>scene?parts.find(b=>!b.entityId&&pointInsideCinematicBrush(b,Object.keys(segmentSpeeds).length?previewCinematicSegmentPosition(scene,diagnosticSeconds,segmentSpeeds):previewCinematicPosition(scene,diagnosticSeconds))):undefined,[parts,scene,diagnosticSeconds,segmentSpeeds]);
  const editPos=(key:'position'|'lookAt',index:number,value:number)=>setDraft(s=>({...s,[key]:s[key].map((v,i)=>i===index?value:v) as Vec3}));
  return <div className="modal-backdrop cine-backdrop" onMouseDown={onClose}>
    <section className="cine-shell" role="dialog" aria-modal="true" aria-label={t('Cinematic Camera Studio')} onMouseDown={e=>e.stopPropagation()}>
      <header className="cine-header"><span className="cine-mark"><Clapperboard size={20}/></span><div><strong>{t('Cinematic Camera Studio')}</strong><small>Svengine 5.x · trigger_camera · path_corner · info_target</small></div>
        <span className="cine-note">{t('Native Sven Co-op entities')}</span><button className="cine-icon" title={t('Close')} onClick={onClose}><X size={20}/></button></header>
      <div className="cine-layout">
        <aside className="cine-side">
          <h3><Camera size={16}/>{t('Camera scenes')}</h3>
          <button className={`cine-scene-choice ${cameraId===null?'active':''}`} onClick={()=>{setCameraId(null);setPlaying(false);}}><Plus size={16}/>{t('Create new scene')}</button>
          {cameras.map(cam=><button key={cam.id} className={`cine-scene-choice ${cameraId===cam.id?'active':''}`} onClick={()=>setCameraId(cam.id)}><Camera size={16}/><span>{cam.name}<small>{cam.props.targetname||cam.id}</small></span></button>)}
          <p className="cine-muted">{t('Every scene uses native map entities; no custom engine plugins are required.')}</p>
        </aside>
        <main className="cine-main">
          {scene?<>
            <div className="cine-section-head"><strong><Camera size={16}/>{scene.camera.name}</strong><small>{scene.route.length} {t('path points')}</small></div>
            <div className={`cine-preview ${expanded?'cine-preview-fullscreen':''}`}><ScenePreview scene={scene} objects={parts} assets={assets} seconds={seconds} mode={viewMode} shade={shade} segmentSpeeds={segmentSpeeds} lights={lights}/>
              <div className="cine-preview-toolbar">
                <button className={viewMode==='camera'?'active':''} onClick={()=>setViewMode('camera')}><Camera size={14}/>{t('Camera view')}</button>
                <button className={viewMode==='inspect'?'active':''} onClick={()=>{setViewMode('inspect');setPlaying(false);}}><Eye size={14}/>{t('Inspect scene')}</button>
                <button onClick={()=>setExpanded(v=>!v)} title={t('Fullscreen preview')}>{expanded?<Minimize2 size={14}/>:<Maximize2 size={14}/>}</button>
              </div>
              <div className="cine-shading-toolbar" aria-label={t('Preview shading')}>
                {(['wireframe','solid','material','rendered'] as const).map(sh=><button key={sh} className={shade===sh?'active':''} onClick={()=>setShade(sh)}>{t(({wireframe:'Wireframe',solid:'Solid',material:'Material Preview',rendered:'Rendered'} as const)[sh])}</button>)}
              </div>
              <span className="cine-preview-label">{t(viewMode==='inspect'?'Mouse: orbit / zoom / pan — no map changes':'Approximate preview — not actual Svengine playback')}</span>
              {expanded&&<div className="cine-fullscreen-player"><button onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={15}/>:<Play size={15}/>} {t(playing?'Pause':'Play')}</button>
                <input type="range" aria-label={t('Preview time')} min={0} max={Math.max(1,edit.duration)} step="0.1" value={seconds} onChange={e=>{setSeconds(Number(e.target.value));setPlaying(false);}}/>
                <span>{seconds.toFixed(1)} / {edit.duration}s</span></div>}
            </div>
            {cameraInside&&<p className="cine-warning"><AlertTriangle size={14}/>{t('Camera is inside a solid brush:')} {cameraInside.name}. {t('Move the camera or path point with the 3D gizmo.')}</p>}
            <div className="cine-play-controls"><button onClick={()=>setPlaying(v=>!v)}><span>{playing?<Pause size={16}/>:<Play size={16}/>}</span>{t(playing?'Pause':'Play')}</button>
              <input type="range" aria-label={t('Preview time')} min={0} max={Math.max(1,edit.duration)} step="0.1" value={seconds} onChange={e=>{setSeconds(Number(e.target.value));setPlaying(false);}}/>
              <select className="cine-rate" aria-label={t('Preview playback speed')} value={playRate} onChange={e=>setPlayRate(Number(e.target.value))}>
                {[.5,1,2].map(n=><option key={n} value={n}>{n}×</option>)}
              </select><span>{seconds.toFixed(1)} / {edit.duration}s</span></div>
            {parts.length>250&&<p className="cine-muted">{t('Preview limited to 250 brushes for performance; exported map remains complete.')}</p>}
            <div className="cine-section-head"><strong><Route size={16}/>{t('Camera path')}</strong><button disabled={!scene.generated} onClick={placePoint}><Plus size={14}/>{t('Add point in 3D')}</button></div>
            <div className="cine-path-list">
              <button onClick={()=>focus(scene.camera.id)}><Camera size={14}/>{t('Camera position')} · {scene.camera.position.map(n=>Math.round(n)).join(', ')}</button>
              {scene.route.map((point,index)=><div className="cine-path-row" key={point.id}>
                <button onClick={()=>focus(point.id)}><MapPin size={14}/>{index+1}. path_corner · {point.position.map(n=>Math.round(n)).join(', ')}</button>
                {index>0&&<button title={t('Jump to point')} onClick={()=>jumpToLeg(index-1)}><Play size={12}/></button>}
              </div>)}
              {scene.lookTarget&&<button onClick={()=>focus(scene.lookTarget!.id)}><MousePointer2 size={14}/>{t('Look target')} · {scene.lookTarget.position.map(n=>Math.round(n)).join(', ')}</button>}
            </div>
            <p className="cine-muted">{t('Choose a point to close the studio and move it with the existing gizmo. Add points by clicking map surfaces; Esc ends placement.')}</p>
            {scene.generated&&scene.route.length>0&&<div className="cine-section-head"><small>{t('To remove a route point, only the last point can be removed safely.')}</small>
              <button onClick={()=>guarded(()=>{removeLastPoint(scene.camera.id);setPlaying(false);})}>{t('Remove last point')}</button></div>}
            {routeLegs.length>0&&<section className="cine-preview-segments">
              <h3><SlidersHorizontal size={15}/>{t('Segment speeds — simulation only')}</h3>
              <p className="cine-muted">{t('These speeds are saved only in .svenstudio.json. GoldSrc path_corner.speed controls trains, not documented camera segment speeds; the BSP uses the camera initial speed and acceleration.')}</p>
              {routeLegs.map((leg,index)=><div className="cine-segment" key={leg.to.id}>
                <label><span>{index+1} → {index+2} · {Math.round(leg.distance)} u · {(leg.distance/(segmentSpeeds[leg.to.id]||Math.max(1,edit.speed))).toFixed(1)} s</span>
                  <input type="number" min="1" max="2000" step="10" title={t('Preview-only speed (units/sec)')}
                    value={segmentSpeeds[leg.to.id]??edit.speed} onChange={e=>{const n=Number(e.target.value);if(n>=1&&n<=2000)guarded(()=>setPreviewSpeed(leg.to.id,n));}}/></label>
                <button title={t('Use global speed')} onClick={()=>guarded(()=>setPreviewSpeed(leg.to.id,null))}><RotateCcw size={13}/></button>
              </div>)}
              <small>{t('Estimated preview travel')}: {estimatedDuration.toFixed(1)} s · {t('Hold time')}: {edit.duration} s</small>
            </section>}
          </>:<>
            <div className="cine-section-head"><strong><Plus size={16}/>{t('New cinematic scene')}</strong></div>
            <p className="cine-muted">{t('Create a camera and target. For motion, add path points afterward using the 3D viewport.')}</p>
            <div className="cine-guide"><span>1. {t('Create camera')}</span><span>2. {t('Place route')}</span><span>3. {t('Connect trigger')}</span><span>4. {t('Compile and test')}</span></div>
            <button className="cine-secondary" onClick={()=>{setDraft(s=>({...s,...{position:defaultCinematicOptions(anchor()).position,lookAt:defaultCinematicOptions(anchor()).lookAt}}));}}><MapPin size={14}/>{t('Position near current selection')}</button>
            <div className="cine-coordinates"><h3>{t('Camera position (GoldSrc X/Y/Z)')}</h3><div>{(['X','Y','Z'] as const).map((label,i)=><NumInput key={label} label={label} value={draft.position[i]} onChange={n=>editPos('position',i,n)}/>)}</div></div>
            <div className="cine-coordinates"><h3>{t('Look target (GoldSrc X/Y/Z)')}</h3><div>{(['X','Y','Z'] as const).map((label,i)=><NumInput key={label} label={label} value={draft.lookAt[i]} onChange={n=>editPos('lookAt',i,n)}/>)}</div></div>
          </>}
        </main>
        <aside className="cine-inspector">
          <h3><ShieldCheck size={16}/>{t('Camera properties')}</h3>
          {!scene?<label className="cine-field"><span>{t('Scene name')}</span><input value={draft.name} maxLength={64} onChange={e=>setDraft(s=>({...s,name:e.target.value}))}/></label>:<div className="cine-meta">{scene.camera.props.targetname}<small>{scene.generated?t('Created by Cinematic Camera Studio'):t('Existing camera — inspect only')}</small></div>}
          <NumInput label={t('Hold time (seconds)')} min={1} max={120} value={scene?edit.duration:draft.duration} onChange={n=>scene?setEdit(s=>({...s,duration:n})):setDraft(s=>({...s,duration:n}))}/>
          <NumInput label={t('Initial speed (units/sec)')} min={1} max={2000} value={scene?edit.speed:draft.speed} onChange={n=>scene?setEdit(s=>({...s,speed:n})):setDraft(s=>({...s,speed:n}))}/>
          {( [{key:'freezePlayer',label:'Freeze player'},{key:'allPlayers',label:'All players'},{key:'invulnerable',label:'Player invulnerable'}] as const).map(({key,label})=><label className="cine-checkbox" key={key}><input type="checkbox" disabled={!!scene&&!scene.generated} checked={scene?edit[key]:draft[key]} onChange={e=>scene?setEdit(s=>({...s,[key]:e.target.checked})):setDraft(s=>({...s,[key]:e.target.checked}))}/>{t(label)}</label>)}
          {!scene&&<><label className="cine-checkbox"><input type="checkbox" checked={draft.moving} onChange={e=>setDraft(s=>({...s,moving:e.target.checked}))}/>{t('Moving camera (path)')}</label>
            <label className="cine-field"><span>{t('Trigger / button to activate (optional)')}</span><select value={draft.activatorId||''} onChange={e=>setDraft(s=>({...s,activatorId:e.target.value||undefined}))}><option value="">{t('Connect later in Gameplay Studio')}</option>{activators.map(a=><option key={a.id} value={a.id}>{a.classname} · {a.props.targetname||a.name}</option>)}</select></label>
            {warningActivator&&<p className="cine-warning"><AlertTriangle size={14}/>{warningActivator}</p>}
            <button className="cine-primary" onClick={create}><Plus size={16}/>{t('Create camera')}</button>
          </>}
          {scene&&<><details className="cine-advanced"><summary>{t('Advanced native camera options')}</summary>
            <NumInput label={t('Acceleration (units/s²)')} min={0} max={4000} value={edit.acceleration??500} onChange={n=>setEdit(s=>({...s,acceleration:n}))}/>
            <NumInput label={t('Stop deceleration (units/s²)')} min={0} max={4000} value={edit.deceleration??500} onChange={n=>setEdit(s=>({...s,deceleration:n}))}/>
            <NumInput label={t('Rotation speed (degrees/s)')} min={0} max={4000} value={edit.turnspeed??40} onChange={n=>setEdit(s=>({...s,turnspeed:n}))}/>
            {([['startAtPlayer','Start at Player'],['followPlayer','Follow Player'],['forceView','Force View'],['noInstantTurn','No Instant Turn (engine flag 32)'],['instantMove','Instant Move'],['hideHealth','Hide health HUD'],['hideFlashlight','Hide flashlight HUD'],['hideWeapons','Hide weapons HUD']] as const).map(([name,label])=><label className="cine-checkbox" key={name}>
              <input type="checkbox" disabled={!scene.generated} checked={!!edit[name]} onChange={e=>setEdit(s=>({...s,[name]:e.target.checked}))}/>{t(label)}</label>)}
            <p className="cine-muted">{t('Svengine note: deceleration and rotation speed may not behave as expected. Start at Player and Follow Player cannot be reproduced accurately in the offline preview.')}</p>
          </details><button className="cine-primary" disabled={!scene.generated} onClick={()=>guarded(()=>{update(scene.camera.id,edit);addLog([`Cinematic Camera Studio: updated ${scene.camera.props.targetname}.`]);})}><Save size={16}/>{t('Save camera properties')}</button>
            <button className="cine-secondary" onClick={()=>focus(scene.camera.id)}><MousePointer2 size={15}/>{t('Select camera in 3D')}</button>
            <h3><AlertTriangle size={16}/>{t('Scene validation')}</h3>
            {[...scene.warnings,...pathWarnings].length?[...scene.warnings,...pathWarnings].map((w,i)=><p className="cine-warning" key={i}><AlertTriangle size={14}/>{w}</p>):<p className="cine-ok"><CheckCircle2 size={15}/>{t('No scene reference errors found.')}</p>}
          </>}
          <div className="cine-separator"/>
          <p className="cine-muted">{t('Preview is approximate: GoldSrc uses its own camera acceleration, smoothing, targets and event timing. Verify the BSP in Sven Co-op.')}</p>
          {notice&&<p className="cine-warning" role="status">{notice}</p>}
        </aside>
      </div>
      <footer className="cine-footer">{t('Native entities only. Existing brushes, WAD/FGD, lightmaps, gizmos and BSP compiler are unchanged.')}</footer>
    </section>
  </div>;
}
