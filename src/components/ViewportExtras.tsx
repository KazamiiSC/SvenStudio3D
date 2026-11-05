import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {Copy,Trash2,EyeOff,Eye,Lock,Unlock,Focus,Move3D,Rotate3D,Scaling,Box,Sun,Layers,Grid3x3,Users,Link2,FolderOpen,Paintbrush,Settings2,MousePointer2,Undo2,Redo2,Scan,FilePlus2,MapPin,Group,FolderTree} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {useStudioLayout} from '../layout';
import {orthoObjectUpdates,type OrthoAxis} from '../engine/orthoActions';
export type SceneMenu={x:number;y:number;objectId:string|null};
export function ContextHitProbe({open}:{open:(menu:SceneMenu)=>void}){
  const {gl,camera,scene}=useThree();
  useEffect(()=>{
    const canvas=gl.domElement;
    let start:{x:number;y:number}|null=null,dragged=false;
    const down=(e:PointerEvent)=>{if(e.button===2){start={x:e.clientX,y:e.clientY};dragged=false}};
    const move=(e:PointerEvent)=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)dragged=true};
    const show=(clientX:number,clientY:number)=>{
      const state=useEditor.getState();
      if(dragged||state.modalTransform||state.placementShape||state.drawMode||state.flyMode)return;
      const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
      const ndc=new THREE.Vector2((clientX-r.left)*2/r.width-1,1-(clientY-r.top)*2/r.height);
      const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);
      const hits=ray.intersectObjects(scene.children,true);
      const findId=(obj:THREE.Object3D):string|null=>{
        let parent:THREE.Object3D|null=obj;
        while(parent){if(parent.userData.brushId||parent.userData.entityId)return (parent.userData.brushId||parent.userData.entityId) as string;parent=parent.parent}
        return null;
      };
      const id=hits.map(hit=>findId(hit.object)).find(Boolean)??null;
      if(id&&!state.selectedIds.includes(id))state.setSelected(id);
      open({x:clientX,y:clientY,objectId:id});
    };
    const up=(e:PointerEvent)=>{
      if(e.button!==2||!start)return;
      const wasDragged=dragged;start=null;
      if(!wasDragged)show(e.clientX,e.clientY);
    };
    const preventNative=(e:MouseEvent)=>e.preventDefault();
    canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);
    window.addEventListener('pointerup',up,true);canvas.addEventListener('contextmenu',preventNative,true);
    return()=>{canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);canvas.removeEventListener('contextmenu',preventNative,true)};
  },[gl,camera,scene,open]);
  return null;
}
/** Context menu shared between the 3D viewport and hierarchy rows.
 * Only dispatches existing editor/store operations; it never creates mesh data
 * that would be incompatible with the Sven Co-op MAP exporter. */
export function ContextMenu({menu,onClose}:{menu:SceneMenu;onClose:()=>void}){
  const t=useT();const objects=useEditor(s=>s.project.objects),selectedIds=useEditor(s=>s.selectedIds);
  const layout=useStudioLayout();
  const obj=objects.find(o=>o.id===menu.objectId);
  useEffect(()=>{
    const dismiss=(e:PointerEvent)=>{if(!(e.target as HTMLElement)?.closest('.studio-context-menu'))onClose()};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};
    document.addEventListener('pointerdown',dismiss,true);window.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',dismiss,true);window.removeEventListener('keydown',escape)};
  },[onClose]);
  const store=useEditor.getState();
  const run=(action:()=>void)=>{
    try{action()}catch(e){store.appendLogs([`Context menu: ${String(e)}`]);window.alert(String(e))}
    onClose();
  };
  const item=(label:string,icon:React.ReactNode,action:()=>void,shortcut?:string,disabled=false)=><button type="button" role="menuitem" key={label} disabled={disabled} onClick={()=>run(action)}>{icon}<span>{t(label)}</span>{shortcut&&<kbd>{shortcut}</kbd>}</button>;
  const section=(label:string)=><div className="context-section" key={label}>{t(label)}</div>;
  // Constrain using the actual menu height (rather than an old 390px guess).
  const left=Math.max(6,Math.min(window.innerWidth-285,menu.x));
  const top=Math.max(6,Math.min(window.innerHeight-Math.min(610,window.innerHeight*.76)-10,menu.y));
  const selectedActive=selectedIds.length>0;
  const openProperties=()=>{if(obj&&!selectedIds.includes(obj.id))store.setSelected(obj.id);layout.setVisible('properties',true)};
  const openAssets=(resource:'entities'|'textures'|'models'|'layers')=>{store.setResourceView(resource);layout.setVisible('assets',true)};
  const promptName=(question:string,initial:string,handler:(value:string)=>void)=>{const value=window.prompt(t(question),initial);if(value?.trim())handler(value.trim())};
  const showClasses=()=>{if(obj?.kind==='entity')store.selectSameClass(obj.classname)};
  const findTarget=()=>{
    if(obj?.kind!=='entity')return;
    const names=(obj.props.target||'').split(/[;,\s]+/).filter(Boolean);
    const match=objects.find(o=>o.kind==='entity'&&names.includes(o.props.targetname));
    if(match){store.setSelected(match.id);store.issueCameraCommand('frame')}
    else window.alert(t('No matching targetname found'));
  };
  const groupName=obj?.group;
  const targetAvailable=obj?.kind==='entity'&&!!obj.props.target;
  const targetNameFound=targetAvailable&&objects.some(o=>o.kind==='entity'&&!!o.props.targetname&&(obj.props.target||'').split(/[;,\s]+/).includes(o.props.targetname));
  return createPortal(<div role="menu" className="studio-context-menu" style={{left,top}} onContextMenu={e=>e.preventDefault()}>
    <div className="context-head"><span>{obj?obj.name:t('Viewport tools')}</span><small>{obj?`${t(obj.kind==='brush'?'Brush':'Entity')} · ${obj.kind==='entity'?obj.classname:obj.primitive} · ${selectedIds.length} ${t('selected')}`:'Svengine · Valve 220'}</small></div>
    {obj&&<>
      {section('Edit object')}
      {item('Open properties',<Settings2 size={15}/>,openProperties)}
      {item('Duplicate',<Copy size={15}/>,store.duplicateSelected,'Ctrl+D',!selectedActive)}
      {item('Move',<Move3D size={15}/>,()=>{if(store.geometryMode!=='object')store.setGeometryMode('object');store.setMode('translate')},'G',obj.locked)}
      {obj.kind==='brush'&&item('Rotate',<Rotate3D size={15}/>,()=>{if(store.geometryMode!=='object')store.setGeometryMode('object');store.setMode('rotate')},'R',obj.locked)}
      {obj.kind==='brush'&&item('Scale',<Scaling size={15}/>,()=>{if(store.geometryMode!=='object')store.setGeometryMode('object');store.setMode('scale')},'C',obj.locked)}
      {item('Frame selection',<Focus size={15}/>,()=>store.issueCameraCommand('frame'),'Num .')}
      {item('Snap selection to grid',<Grid3x3 size={15}/>,store.snapSelectionToGrid,undefined,obj.locked)}
      {section('Organize')}
      {item('Select same layer',<Layers size={15}/>,()=>store.selectSameLayer(obj.layer||'Geometry'))}
      {item('Isolate selection',<EyeOff size={15}/>,store.isolateSelection)}
      {item('Show all objects',<Eye size={15}/>,store.revealAll)}
      {item('Select group',<Users size={15}/>,()=>store.selectGroup(groupName!),undefined,!groupName)}
      {item('Group selection…',<Group size={15}/>,()=>promptName('Group name',groupName||'New Group',store.groupSelected))}
      {item('Ungroup selection',<Group size={15}/>,store.ungroupSelected,undefined,!groupName)}
      {item('Change layer…',<Layers size={15}/>,()=>promptName('Layer',obj.layer||'Geometry',name=>store.setLayer(obj.id,name)))}
      {item(obj.hidden?'Show':'Hide',obj.hidden?<Eye size={15}/>:<EyeOff size={15}/>,()=>store.toggleVisibility(obj.id))}
      {item(obj.locked?'Unlock':'Lock',obj.locked?<Unlock size={15}/>:<Lock size={15}/>,()=>store.toggleLocked(obj.id))}
      {obj.kind==='brush'&&<>
        {section('Brush tools')}
        {item('Object mode',<MousePointer2 size={15}/>,()=>store.setGeometryMode('object'))}
        {item('Vertex mode',<MapPin size={15}/>,()=>store.setGeometryMode('vertex'))}
        {item('Edge mode',<Scan size={15}/>,()=>store.setGeometryMode('edge'))}
        {item('Face mode',<Paintbrush size={15}/>,()=>store.setGeometryMode('face'))}
        {item('Apply selected texture',<Paintbrush size={15}/>,()=>store.paintSelected(store.currentTexture),undefined,obj.locked)}
        {item('Save selection as prefab…',<FolderOpen size={15}/>,()=>promptName('Prefab name',obj.name||'Prefab',store.saveSelectedPrefab))}
        {!obj.entityId&&item('Create func_door',<Box size={15}/>,()=>store.tieGameplayBrush(obj.id,'func_door'),undefined,obj.locked)}
        {!obj.entityId&&item('Create func_button',<Box size={15}/>,()=>store.tieGameplayBrush(obj.id,'func_button'),undefined,obj.locked)}
      </>}
      {obj.kind==='entity'&&<>
        {section('Entity tools')}
        {item('Select same classname',<Users size={15}/>,showClasses)}
        {item('Find linked target',<Link2 size={15}/>,findTarget,undefined,!targetNameFound)}
        {item('Browse entities',<FolderTree size={15}/>,()=>openAssets('entities'))}
        {item('Copy classname',<Copy size={15}/>,()=>void navigator.clipboard?.writeText(obj.classname))}
        {obj.classname.startsWith('monster_')&&item('Add AI waypoint',<MapPin size={15}/>,()=>store.startWaypointPlacement(obj.id))}
      </>}
      {section('History & cleanup')}
      {item('Undo',<Undo2 size={15}/>,store.undo,'Ctrl+Z',!store.history.length)}
      {item('Redo',<Redo2 size={15}/>,store.redo,'Ctrl+Y',!store.future.length)}
      {item('Delete',<Trash2 size={15}/>,store.removeSelected,'Del',!selectedActive||!!obj.locked)}
    </>}
    {!obj&&<>
      {section('Create')}
      {item('Add Box',<Box size={15}/>,()=>store.setPlacementShape('box'))}
      {item('Add Light',<Sun size={15}/>,()=>store.addEntity(store.fgdClasses.find(c=>c.name==='light')||{name:'light',type:'point',description:'Light',props:{}}))}
      {item('Browse entities',<FolderTree size={15}/>,()=>openAssets('entities'))}
      {item('Texture Browser',<Paintbrush size={15}/>,()=>openAssets('textures'))}
      {item('Model Browser',<Layers size={15}/>,()=>openAssets('models'))}
      {section('Viewport')}
      {item('Frame all',<Focus size={15}/>,()=>store.issueCameraCommand('frameAll'),'Home')}
      {item('Orthographic / Perspective',<Scan size={15}/>,()=>store.issueCameraCommand('projection'),'Num 5')}
      {item('Grid visibility',<Grid3x3 size={15}/>,()=>store.setFlag('showGrid',!store.showGrid))}
      {item('Show entity names',<Eye size={15}/>,()=>store.setFlag('showEntityNames',!store.showEntityNames))}
      {section('Scene')}
      {item('Show all objects',<Eye size={15}/>,store.revealAll)}
      {item('Unlock all objects',<Unlock size={15}/>,store.unlockAll)}
      {item('Properties',<Settings2 size={15}/>,()=>layout.setVisible('properties',true))}
      {item('Undo',<Undo2 size={15}/>,store.undo,'Ctrl+Z',!store.history.length)}
      {item('Redo',<Redo2 size={15}/>,store.redo,'Ctrl+Y',!store.future.length)}
    </>}
  </div>,document.body);
}
export function OrthoQuickTools(){
  const t=useT();const label=useEditor(s=>s.cameraLabel),ids=useEditor(s=>s.selectedIds),objects=useEditor(s=>s.project.objects);
  const transform=useEditor(s=>s.transformSelection),step=useEditor(s=>s.snap);
  const active=/(Top|Front|Right).*Ortho/i.test(label)&&objects.some(o=>ids.includes(o.id)&&o.kind==='brush'&&!o.locked);
  const [axis,setAxis]=useState<OrthoAxis>('Z');
  useEffect(()=>setAxis(label.includes('Top')?'Z':label.includes('Front')?'Y':'X'),[label]);
  if(!active)return null;
  const act=(mode:'rotate'|'scale'|'nudge',amount:number)=>transform(orthoObjectUpdates(objects,ids,axis,mode,amount));
  return <div className="ortho-toolkit" onPointerDown={e=>e.stopPropagation()}>
    <div className="ortho-tool-title"><Rotate3D size={15}/><strong>{t('Ortho Transform')}</strong><span>{label}</span></div>
    <div className="ortho-line"><span>{t('Axis')}</span><select value={axis} onChange={e=>setAxis(e.target.value as OrthoAxis)} aria-label="Rotate axis"><option>X</option><option>Y</option><option>Z</option></select>
      <span className="ortho-info">Svengine</span></div>
    <div className="ortho-line"><span>{t('Rotate')}</span>{[-90,-15,15,90].map(v=><button key={v} onClick={()=>act('rotate',v)} title={`${v}° ${axis}`}>{v>0?'+':''}{v}°</button>)}</div>
    <div className="ortho-line"><span>{t('Move')}</span><button onClick={()=>act('nudge',-step)}>−{step}</button><button onClick={()=>act('nudge',step)}>+{step}</button>
      <span>{t('Scale')}</span><button onClick={()=>act('scale',.8)}>80%</button><button onClick={()=>act('scale',1.25)}>125%</button></div>
  </div>;
}
