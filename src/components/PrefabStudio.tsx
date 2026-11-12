/** Dedicated prefab catalog; never changes the BSP or MAP until explicitly imported. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {createPortal} from 'react-dom';
import * as THREE from 'three';
import {Boxes,FolderOpen,FolderPlus,RefreshCw,Save,Search,Upload,Plus,MousePointer2,X,ShieldAlert,FileDown,HardDrive,CheckCircle2,AlertTriangle,Download,Trash2,Layers3} from 'lucide-react';
import {useEditor} from '../store';
import {createPrefab,type Prefab} from '../engine/prefabs';
import {decodePrefabWad} from '../engine/bspObjectExtractor';
import {parseWad} from '../engine/wad';
import {rememberWadFile,forgetSavedWadFile} from '../engine/wadPersistence';
import {planMapWadRemoval} from '../engine/mapWadRemoval';
import {wadBasename} from '../engine/textureWadSelection';
import {decodePrefabTextures,downloadPrefabWad,installPrefabWadForBuild,prefabWadReport,appendConfiguredWadPath} from '../engine/prefabWadDependencies';
import {buildMeshGeometry,gameToThree,transformedVertices,toRenderQuaternion} from '../engine/geometry';
import type {Brush,TextureAsset} from '../engine/types';
import {ensurePrefabFolderPermission,forgetPrefabFolder,isPrefabFile,parseStudioPrefab,readPrefabFolder,rememberPrefabFolder,scanPrefabFolder,writePrefabToFolder,type FolderHandle,type PrefabFolderEntry,type StudioPrefab} from '../engine/prefabStudioFolder';

const WORDS={
 es:{title:'Estudio de Prefabricados',subtitle:'Catálogo local · objetos reutilizables · visor 3D',folder:'Carpeta de prefabs',choose:'Elegir carpeta',rescan:'Actualizar carpeta',disconnect:'Desvincular',authorize:'Autorizar carpeta',library:'Biblioteca interna',files:'Archivos de carpeta',empty:'No se encontraron prefabs válidos.',chooseItem:'Elegí un prefab para verlo en 3D.',search:'Buscar prefab...',place:'Colocar con el mouse',import:'Importar al Editor MAP',add:'Guardar en biblioteca',save:'Guardar en carpeta',saveSelection:'Guardar selección MAP en carpeta',pick:'Importar archivos',close:'Cerrar',noFolder:'Elegí una carpeta local. Chrome puede recordar el permiso para volver a detectar archivos al abrir el estudio.',readonly:'La carpeta necesita permiso para guardado; podés autorizarla con el botón correspondiente.',tooLarge:'El almacenamiento interno tiene límites: los prefabs BSP grandes pueden permanecer solo en la carpeta.',count:'objetos',denied:'Chrome requiere autorización para acceder otra vez a la carpeta.',error:'Algunos archivos no pudieron cargarse',preview:'Vista 3D: arrastrar para girar · botón derecho para desplazar · rueda para zoom',fallback:'Tu navegador no permite recordar una carpeta. Podés cargar su contenido manualmente, pero deberás elegirla al volver a abrir.',saveName:'Nombre del prefab seleccionado',selected:'Selección MAP'},
 en:{title:'Prefab Studio',subtitle:'Local catalog · reusable objects · 3D viewer',folder:'Prefab folder',choose:'Choose folder',rescan:'Rescan folder',disconnect:'Unlink',authorize:'Authorize folder',library:'Internal Library',files:'Folder files',empty:'No valid prefabs found.',chooseItem:'Select a prefab to see its 3D preview.',search:'Search prefabs...',place:'Place with mouse',import:'Import into MAP Editor',add:'Add to Library',save:'Save to folder',saveSelection:'Save selected MAP objects to folder',pick:'Import files',close:'Close',noFolder:'Choose a local folder. Chrome can remember your permission and find its files when Studio opens.',readonly:'Writing requires folder permission. Use the authorization button.',tooLarge:'Internal storage is limited. Large BSP prefabs may remain in the folder only.',count:'objects',denied:'Chrome needs your permission to access the folder again.',error:'Some files could not be loaded',preview:'3D: drag to orbit · right mouse to pan · wheel to zoom',fallback:'This browser cannot remember a folder. You can load its files manually, but must choose them again next time.',saveName:'Selected prefab name',selected:'MAP selection'},
 ru:{title:'Студия префабов',subtitle:'Каталог · объекты · 3D-просмотр',folder:'Папка префабов',choose:'Выбрать папку',rescan:'Обновить',disconnect:'Отключить',authorize:'Разрешить доступ',library:'Внутренняя библиотека',files:'Файлы папки',empty:'Нет подходящих префабов.',chooseItem:'Выберите префаб для 3D-просмотра.',search:'Поиск...',place:'Разместить мышью',import:'Импорт в MAP',add:'В библиотеку',save:'Сохранить в папку',saveSelection:'Сохранить выделение MAP',pick:'Импорт файлов',close:'Закрыть',noFolder:'Выберите папку. Chrome может запомнить разрешение.',readonly:'Требуется разрешение на запись.',tooLarge:'Для больших BSP префабов используйте папку.',count:'объектов',denied:'Нужно снова разрешить доступ.',error:'Ошибка некоторых файлов',preview:'3D: вращение · перемещение · масштаб',fallback:'Браузер не умеет запоминать папку.',saveName:'Название префаба',selected:'Выделение MAP'},
 ko:{title:'프리팹 스튜디오',subtitle:'로컬 카탈로그 · 3D 미리보기',folder:'프리팹 폴더',choose:'폴더 선택',rescan:'새로고침',disconnect:'연결 해제',authorize:'폴더 권한',library:'내부 라이브러리',files:'폴더 파일',empty:'유효한 프리팹이 없습니다.',chooseItem:'3D로 볼 프리팹을 선택하세요.',search:'프리팹 검색...',place:'마우스로 배치',import:'MAP 에디터로 가져오기',add:'라이브러리에 추가',save:'폴더에 저장',saveSelection:'MAP 선택 항목 저장',pick:'파일 가져오기',close:'닫기',noFolder:'로컬 폴더를 선택하세요. Chrome은 접근 권한을 기억할 수 있습니다.',readonly:'저장에는 폴더 쓰기 권한이 필요합니다.',tooLarge:'큰 BSP 프리팹은 폴더를 사용하세요.',count:'오브젝트',denied:'폴더 접근 권한이 필요합니다.',error:'일부 파일 오류',preview:'3D: 회전 · 이동 · 확대',fallback:'폴더를 기억할 수 없는 브라우저입니다.',saveName:'프리팹 이름',selected:'MAP 선택'},
 zh:{title:'预制件工作室',subtitle:'本地目录 · 三维预览',folder:'预制件文件夹',choose:'选择文件夹',rescan:'重新扫描',disconnect:'断开关联',authorize:'授权文件夹',library:'内部资源库',files:'文件夹文件',empty:'未发现有效预制件。',chooseItem:'选择预制件进行三维预览。',search:'搜索预制件...',place:'鼠标放置',import:'导入 MAP 编辑器',add:'添加至资源库',save:'保存到文件夹',saveSelection:'保存 MAP 选中对象',pick:'导入文件',close:'关闭',noFolder:'选择本地文件夹。Chrome 可记住访问权限。',readonly:'保存需要写入权限。',tooLarge:'大型 BSP 预制件可只保存在文件夹。',count:'对象',denied:'需要重新授权。',error:'部分文件加载失败',preview:'3D：旋转 · 平移 · 缩放',fallback:'该浏览器不能记住文件夹。',saveName:'预制件名称',selected:'MAP 选择'},
 pt:{title:'Estúdio de Prefabs',subtitle:'Catálogo local · visualizador 3D',folder:'Pasta de prefabs',choose:'Escolher pasta',rescan:'Atualizar pasta',disconnect:'Desvincular',authorize:'Autorizar pasta',library:'Biblioteca interna',files:'Arquivos da pasta',empty:'Nenhum prefab válido encontrado.',chooseItem:'Selecione um prefab para ver em 3D.',search:'Buscar prefab...',place:'Colocar com mouse',import:'Importar ao editor MAP',add:'Adicionar à biblioteca',save:'Salvar na pasta',saveSelection:'Salvar seleção MAP na pasta',pick:'Importar arquivos',close:'Fechar',noFolder:'Escolha uma pasta. Chrome pode lembrar a permissão.',readonly:'Salvar requer permissão de escrita.',tooLarge:'Prefabs BSP grandes podem permanecer só na pasta.',count:'objetos',denied:'Autorize o acesso novamente.',error:'Alguns arquivos falharam',preview:'3D: girar · mover · zoom',fallback:'O navegador não pode lembrar pastas.',saveName:'Nome do prefab',selected:'Seleção MAP'}
} as const;
const EXTRA:Record<string,{remove:string;confirm:string;clean:string;cleanConfirm:string;cleanNone:string;smart:string;duplicates:string;duplicateConfirm:string}>={
 es:{remove:'Quitar de biblioteca interna',confirm:'¿Quitar este prefab de la biblioteca interna? Los objetos ya colocados y archivos de carpeta NO se eliminan.',clean:'Liberar WAD sin uso',cleanConfirm:'¿Liberar de la memoria y caché los WAD que no usa este proyecto ni Deshacer/Rehacer? No se borran archivos de Windows.',cleanNone:'No hay WAD cargados que se puedan liberar con seguridad.',smart:'Smart WAD se configura en Configuración de compilación. Solo empaqueta las texturas utilizadas.',duplicates:'Limpiar duplicados exactos',duplicateConfirm:'¿Eliminar copias idénticas de la biblioteca interna? Se conserva un ejemplar de cada prefab.'},
 en:{remove:'Remove from internal library',confirm:'Remove this internal prefab? Objects already placed and folder files will NOT be deleted.',clean:'Unload unused WADs',cleanConfirm:'Unload WADs unused by the MAP and undo/redo? Files on disk will NOT be deleted.',cleanNone:'No safely removable loaded WADs.',smart:'Configure Smart WAD in Build Configuration. Only used textures are packed.',duplicates:'Clean exact duplicates',duplicateConfirm:'Remove identical internal library copies, keeping one of each?'},
 ru:{remove:'Удалить из внутренней библиотеки',confirm:'Удалить префаб? Размещённые объекты и файлы останутся.',clean:'Выгрузить неиспользуемые WAD',cleanConfirm:'Выгрузить ненужные WAD? Файлы на диске останутся.',cleanNone:'Нет безопасных для удаления WAD.',smart:'Smart WAD настраивается в параметрах сборки.',duplicates:'Убрать точные дубликаты',duplicateConfirm:'Удалить точные дубликаты, оставив один экземпляр?'},
 ko:{remove:'내부 라이브러리에서 제거',confirm:'제거할까요? 배치된 오브젝트 및 디스크 파일은 그대로 유지됩니다.',clean:'미사용 WAD 해제',cleanConfirm:'미사용 WAD를 메모리에서 제거할까요? 디스크 파일은 유지됩니다.',cleanNone:'안전하게 해제할 WAD가 없습니다.',smart:'빌드 설정에서 Smart WAD를 설정합니다.',duplicates:'중복 프리팹 정리',duplicateConfirm:'동일한 프리팹 중복을 제거할까요?'},
 zh:{remove:'从内部资源库移除',confirm:'移除此预制件？已放置对象和磁盘文件不会被删除。',clean:'释放未使用的 WAD',cleanConfirm:'释放未使用的 WAD？磁盘文件不受影响。',cleanNone:'没有可安全释放的 WAD。',smart:'在编译配置中设置 Smart WAD。',duplicates:'清除完全相同的副本',duplicateConfirm:'清除完全相同的副本，只保留一份？'},
 pt:{remove:'Remover da biblioteca interna',confirm:'Remover prefab interno? Objetos colocados e arquivos não serão apagados.',clean:'Liberar WAD sem uso',cleanConfirm:'Liberar WAD sem uso? Arquivos do disco não serão removidos.',cleanNone:'Nenhum WAD pode ser liberado com segurança.',smart:'Configure Smart WAD na Configuração de compilação.',duplicates:'Limpar duplicados exatos',duplicateConfirm:'Remover cópias idênticas e manter uma de cada?'}
};
type Locale=keyof typeof WORDS;
type CatalogItem={key:string;name:string;fileName?:string;source:'folder'|'library'|'manual';prefab:StudioPrefab};
function PreviewCamera({center,radius,signature}:{center:THREE.Vector3;radius:number;signature:string}){
 const {camera,invalidate}=useThree();const control=useRef<any>(null);
 useEffect(()=>{camera.position.set(radius*1.45,radius*.95,radius*1.45);camera.lookAt(0,0,0);camera.updateProjectionMatrix();control.current?.target.set(0,0,0);control.current?.update();invalidate()},[camera,radius,signature,invalidate]);
 return <OrbitControls ref={control} makeDefault enablePan enableRotate enableZoom minDistance={Math.max(.5,radius*.1)} maxDistance={radius*20} enableDamping/>;
}
function PrefabSolid({brush,center,materials,dimensions}:{brush:Brush;center:THREE.Vector3;materials:ReadonlyMap<string,THREE.Material>;dimensions:ReadonlyMap<string,{width:number;height:number}>}){
 const geom=useMemo(()=>buildMeshGeometry(brush,dimensions),[brush,dimensions]);
 useEffect(()=>()=>geom.dispose(),[geom]);
 const faceMats=useMemo(()=>brush.faces.map(face=>materials.get(face.texture.toLowerCase())??new THREE.MeshStandardMaterial({color:'#7996a9',roughness:.85,side:THREE.DoubleSide})),[brush,materials]);
 useEffect(()=>()=>faceMats.forEach(mat=>{if(![...materials.values()].includes(mat))mat.dispose()}),[faceMats,materials]);
 const origin=gameToThree(brush.position).sub(center);
 return <mesh geometry={geom} material={faceMats} position={origin.toArray()} quaternion={toRenderQuaternion(brush.rotation)} scale={[brush.scale[0],brush.scale[2],brush.scale[1]]}/>;
}
function PrefabView3D({prefab,textureAssets}:{prefab:StudioPrefab;textureAssets:TextureAsset[]}){
 const brushes=useMemo(()=>prefab.objects.filter((o):o is Brush=>o.kind==='brush').slice(0,128),[prefab]);
 const entities=useMemo(()=>prefab.objects.filter(o=>o.kind==='entity').slice(0,128),[prefab]);
 const bounds=useMemo(()=>{
   const points=[...brushes.flatMap(b=>transformedVertices(b).map(gameToThree)),...entities.map(e=>gameToThree(e.position))];
   const bbox=points.length?new THREE.Box3().setFromPoints(points):new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(),new THREE.Vector3(64,64,64));
   return {center:bbox.getCenter(new THREE.Vector3()),radius:Math.max(32,bbox.getSize(new THREE.Vector3()).length()*.5)};
 },[brushes,entities]);
 const dimensions=useMemo(()=>new Map(textureAssets.map(t=>[t.name.toUpperCase(),{width:t.width,height:t.height}])),[textureAssets]);
 const materials=useMemo(()=>{
   const map=new Map<string,THREE.Material>();
   const required=new Set(brushes.flatMap(b=>b.faces.map(f=>f.texture.toLowerCase())));
   for(const asset of textureAssets){
     const key=asset.name.toLowerCase();if(!required.has(key)||map.has(key))continue;
     const image=asset.dataUrl;if(!image)continue;
     const texture=new THREE.TextureLoader().load(image);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;
     map.set(key,new THREE.MeshStandardMaterial({map:texture,side:THREE.DoubleSide,roughness:.9,alphaTest:key.startsWith('{')?0.5:0}));
   }
   return map;
 },[brushes,textureAssets]);
 useEffect(()=>()=>materials.forEach(mat=>{const map=(mat as THREE.MeshStandardMaterial).map;map?.dispose();mat.dispose()}),[materials]);
 return <div className="pf3d-stage" onContextMenu={e=>e.preventDefault()}><Canvas camera={{position:[150,130,150],fov:50,near:.1,far:100000}} dpr={[1,1.5]} gl={{antialias:true,powerPreference:'high-performance'}}>
   <color attach="background" args={['#0c1c2c']}/><ambientLight intensity={1.7}/><directionalLight position={[200,330,130]} intensity={2}/><directionalLight position={[-100,75,-110]} intensity={.6}/>
   {brushes.map(b=><PrefabSolid key={b.id} brush={b} center={bounds.center} dimensions={dimensions} materials={materials}/>)}
   <PreviewCamera center={bounds.center} radius={bounds.radius} signature={prefab.id}/><axesHelper args={[Math.min(128,bounds.radius*.6)]}/>
 </Canvas></div>;
}
export function PrefabStudio({onClose,onImportPrefab,onStartPlacement}:{onClose:()=>void;onImportPrefab:(file:File)=>Promise<void>;onStartPlacement:(id:string)=>void}){
 const currentLocale=useEditor(s=>s.locale) as Locale;
 const w=WORDS[currentLocale]??WORDS.es;
 const extra=EXTRA[currentLocale]??EXTRA.es;
 const settings=useEditor(s=>s.settings);
 const items=useEditor(s=>s.prefabs),selectedIds=useEditor(s=>s.selectedIds),objects=useEditor(s=>s.project.objects),assetTextures=useEditor(s=>s.textureAssets);
 const [folder,setFolder]=useState<FolderHandle|null>(null),[permission,setPermission]=useState(false),[folderEntries,setFolderEntries]=useState<PrefabFolderEntry[]>([]),[manual,setManual]=useState<CatalogItem[]>([]);
 const [errors,setErrors]=useState<string[]>([]),[message,setMessage]=useState(''),[query,setQuery]=useState(''),[chosen,setChosen]=useState(''),[busy,setBusy]=useState(false),[previewTextures,setPreviewTextures]=useState<TextureAsset[]>([]);
 const fallbackRef=useRef<HTMLInputElement>(null),inputRef=useRef<HTMLInputElement>(null);
 const setError=(error:unknown)=>setMessage(error instanceof Error?error.message:String(error));
 const rescan=async(handle:FolderHandle,interactive=false)=>{
   if(!await ensurePrefabFolderPermission(handle,false,interactive)){setPermission(false);setMessage(w.denied);return}
   setPermission(true);const scan=await scanPrefabFolder(handle);
   setFolderEntries(scan.entries);setErrors(scan.skipped);setMessage(`${scan.entries.length} .svprefab`);
 };
 useEffect(()=>{let alive=true;void readPrefabFolder().then(async handle=>{
   if(!alive||!handle)return;setFolder(handle);
   if(await ensurePrefabFolderPermission(handle)){
     const scanned=await scanPrefabFolder(handle);
     if(alive){setFolderEntries(scanned.entries);setErrors(scanned.skipped);setPermission(true)}
   }else if(alive)setMessage(w.denied);
 }).catch(e=>{if(alive)setError(e)});return()=>{alive=false}},[]);
 const chooseFolder=async()=>{
   const picker=(window as Window&{showDirectoryPicker?:(options?:{id?:string;mode?:'readwrite'|'read'})=>Promise<FolderHandle>}).showDirectoryPicker;
   if(!picker){fallbackRef.current?.click();setMessage(w.fallback);return}
   try{const handle=await picker.call(window,{id:'svenstudio-prefabs',mode:'readwrite'});await rememberPrefabFolder(handle);setFolder(handle);setChosen('');await rescan(handle,true)}catch(e){if((e as Error).name!=='AbortError')setError(e)}
 };
 const catalog=useMemo<CatalogItem[]>(()=>[
  ...folderEntries.map(e=>({key:`folder:${e.name}`,name:e.prefab.name,fileName:e.name,source:'folder' as const,prefab:e.prefab})),
  ...items.map(p=>({key:`library:${p.id}`,name:p.name,source:'library' as const,prefab:p as StudioPrefab})),...manual
 ],[folderEntries,items,manual]);
 const filtered=catalog.filter(x=>`${x.name} ${x.fileName??''}`.toLowerCase().includes(query.toLowerCase()));
 const selected=filtered.find(x=>x.key===chosen)??filtered[0]??null;
 useEffect(()=>{let active=true;setPreviewTextures([]);
   if(!selected)return;
   if(selected.prefab.format==='svenstudio-bsp-object'&&selected.prefab.wad?.base64){
     try{const wad=decodePrefabWad(selected.prefab.wad.base64);const file=new File([Uint8Array.from(wad)],selected.prefab.wad.filename,{type:'application/octet-stream'});
       void parseWad(file,{remember:false}).then(textures=>{if(active)setPreviewTextures(textures)}).catch(err=>{if(active)setError(err)})
     }catch(err){setError(err)}
   }else setPreviewTextures(assetTextures);
   return()=>{active=false};
 },[selected?.key,selected?.prefab,assetTextures]);
 const dependencies=useMemo(()=>selected?prefabWadReport(selected.prefab,assetTextures,settings.wadPaths):null,[selected?.key,selected?.prefab,assetTextures,settings.wadPaths]);
 const prepareTextures=async(prefab:StudioPrefab)=>{
   if(prefab.format!=='svenstudio-bsp-object')return;
   const {file,textures}=await decodePrefabTextures(prefab,useEditor.getState().textureAssets);
   // Populate preview assets BEFORE activating mouse placement. Do not claim
   // that the archive exists on disk until the explicit install step succeeds.
   useEditor.getState().setTextures(textures,file.name,{trackProject:false});
   try{await rememberWadFile(file)}catch(error){useEditor.getState().appendLogs([`Prefab WAD browser cache: ${String(error)}`])}
 };
 const installToGame=async()=>{
   if(!selected||!dependencies?.embedded)return;
   if(!window.confirm(({es:`¿Instalar ${dependencies.filename} en svencoop_addon para compilar? No se sobrescribirán WAD existentes.`,en:`Install ${dependencies.filename} to svencoop_addon for compilation? Existing WADs will not be overwritten.`,ru:`Установить ${dependencies.filename} в svencoop_addon? Файлы не перезаписываются.`,ko:`컴파일을 위해 ${dependencies.filename}을(를) svencoop_addon에 설치할까요? 기존 WAD는 덮어쓰지 않습니다.`,zh:`是否安装 ${dependencies.filename} 到 svencoop_addon 以供编译？不会覆盖现有 WAD。`,pt:`Instalar ${dependencies.filename} em svencoop_addon para compilar? Nenhum WAD existente será substituído.`} as Record<string,string>)[currentLocale]))return;
   setBusy(true);
   try{
     const path=await installPrefabWadForBuild(selected.prefab,settings.gameDir);
     const existing=settings.wadPaths.split(/[\r\n]+/).map(x=>x.trim()).find(x=>x.replaceAll('\\','/').split('/').pop()?.toLowerCase()===dependencies.filename?.toLowerCase());
     if(existing&&existing.replaceAll('\\','/').toLowerCase()!==path.replaceAll('\\','/').toLowerCase()){
       setMessage(`WAD installed: ${path}. Build Configuration already contains another path for this WAD (${existing}). Check its precedence manually.`);
     }else{
       useEditor.getState().setSettings({wadPaths:appendConfiguredWadPath(settings.wadPaths,path)});
       setMessage(`${dependencies.filename} — ${path}`);
     }
   }catch(err){setError(err)}finally{setBusy(false)}
 };
 const saveToFolder=async(prefab:StudioPrefab)=>{
   if(!folder){setMessage(w.noFolder);return}
   setBusy(true);try{
     if(!await ensurePrefabFolderPermission(folder,true,true)){setMessage(w.readonly);return}
     const filename=await writePrefabToFolder(folder,prefab);
     await rescan(folder);setChosen(`folder:${filename}`);
   }catch(err){setError(err)}finally{setBusy(false)}
 };
 const addLibrary=()=>{if(!selected)return;try{useEditor.getState().addPrefab(selected.prefab);setMessage(`${selected.name} · ${w.library}`)}catch(err){setError(err)}};
 const removeLibrary=()=>{
   if(!selected||selected.source!=='library')return;
   if(!window.confirm(extra.confirm))return;
   const id=selected.prefab.id;
   useEditor.getState().removePrefab(id);
   setChosen('');setMessage(`${selected.name}: ${extra.remove}`);
 };
 const cleanDuplicates=()=>{
   const originals=new Map<string,string>(),duplicates:string[]=[];
   for(const prefab of useEditor.getState().prefabs){
     // Same name, exact geometry, WAD bytes and recovery metadata. Do not remove
     // similarly named objects which have different materials or geometry.
     const asStudio=prefab as StudioPrefab;
     const k=JSON.stringify([prefab.name,prefab.origin,prefab.objects,asStudio.wad,asStudio.recovery]);
     if(originals.has(k))duplicates.push(prefab.id);else originals.set(k,prefab.id);
   }
   if(!duplicates.length){setMessage('0 duplicates');return}
   if(!window.confirm(`${extra.duplicateConfirm} (${duplicates.length})`))return;
   for(const id of duplicates)useEditor.getState().removePrefab(id);
   setChosen('');setMessage(`${duplicates.length} · ${extra.duplicates}`);
 };
 const unloadUnused=async()=>{
   const state=useEditor.getState();
   const wads=[...new Set(state.textureAssets.map(t=>wadBasename(t.wad)))].filter(Boolean);
   const choices=wads.filter(wad=>planMapWadRemoval(wad,state.textureAssets,state.project,state.history,state.future,
     state.settings.wadPaths.split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean)).ok);
   if(!choices.length){setMessage(extra.cleanNone);return}
   if(!window.confirm(`${extra.cleanConfirm} (${choices.length})`))return;
   setBusy(true);const errors:string[]=[];let removed=0;
   try{
     for(const wad of choices){
       try{useEditor.getState().removeTextureWad(wad);await forgetSavedWadFile(wad);removed++}
       catch(err){errors.push(`${wad}: ${String(err)}`)}
     }
     setMessage(`${removed} WAD unloaded${errors.length?'; '+errors.join('; '):''}`);
   }finally{setBusy(false)}
 };
 const startPlacement=async()=>{
   if(!selected||busy)return;
   setBusy(true);
   try{
     await prepareTextures(selected.prefab);
     let match=items.find(p=>p.id===selected.prefab.id);
     if(!match){useEditor.getState().addPrefab(selected.prefab);match=useEditor.getState().prefabs.at(-1)}
     if(!match)throw Error('Prefab not saved.');
     onStartPlacement(match.id);onClose();
   }catch(err){setError(err)}finally{setBusy(false)}
 };
 const saveSelection=()=>{try{
   const ids=new Set(selectedIds);const collection=objects.filter(o=>ids.has(o.id));
   if(!collection.length)throw Error('Select one or more MAP objects first.');
   const name=window.prompt(w.saveName,`Prefab_${collection.length}`);if(!name)return;
   void saveToFolder(createPrefab(collection,name));
 }catch(err){setError(err)}};
 const handleInput=async(event:React.ChangeEvent<HTMLInputElement>,directory=false)=>{
   const files=Array.from(event.target.files??[]);event.target.value='';
   const loaded:CatalogItem[]=[];const warnings:string[]=[];
   for(const file of files.filter(f=>isPrefabFile(f.name)).slice(0,512)){
     try{if(file.size>40*1024*1024)throw Error('File exceeds 40 MB.');
       const prefab=parseStudioPrefab(await file.text());loaded.push({key:`manual:${file.name}:${file.lastModified}`,name:prefab.name,fileName:file.name,source:'manual',prefab})
     }catch(err){warnings.push(`${file.name}: ${String(err)}`)}
   }
   setManual(loaded);setErrors(warnings);
   if(directory)setMessage(w.fallback);else setMessage(`${loaded.length} .svprefab`);
   if(loaded.length)setChosen(loaded[0].key);
 };
 const importIntoMap=async()=>{if(!selected)return;setBusy(true);try{
   const text=JSON.stringify(selected.prefab);
   await onImportPrefab(new File([text],selected.fileName??`${selected.name}.svprefab`,{type:'application/json'}));
 }catch(err){setError(err)}finally{setBusy(false)}};
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopImmediatePropagation();event.preventDefault();onClose()}};window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true)},[onClose]);
 return createPortal(<div className="pfstudio-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();e.stopPropagation()}}>
  <section className="pfstudio-dialog" role="dialog" aria-modal="true" aria-label={w.title} onPointerDown={e=>e.stopPropagation()}>
    <header className="pfstudio-head"><Boxes size={24}/><div><strong>{w.title}</strong><small>{w.subtitle}</small></div><button onClick={onClose} title={w.close}><X size={21}/></button></header>
    <div className="pfstudio-content"><aside className="pfstudio-sidebar"><div className="pfstudio-folder"><h3>{w.folder}</h3><div className="pfstudio-folder-name"><FolderOpen size={17}/>{folder?.name??w.noFolder}</div><div className="pfstudio-row">
      <button onClick={()=>void chooseFolder()}><FolderPlus size={15}/>{w.choose}</button>
      <button disabled={!folder||busy} title={permission?w.rescan:w.authorize} onClick={()=>{if(folder)void rescan(folder,true).catch(setError)}}><RefreshCw size={15}/></button>
      <button disabled={!folder} title={w.disconnect} onClick={()=>void forgetPrefabFolder().then(()=>{setFolder(null);setFolderEntries([]);setPermission(false);setChosen('')}).catch(setError)}><X size={15}/></button>
    </div><div className="pfstudio-row"><button onClick={()=>inputRef.current?.click()}><Upload size={15}/>{w.pick}</button></div>
      <input type="file" hidden ref={inputRef} accept=".svprefab,.json" multiple onChange={e=>void handleInput(e)}/>
      <input type="file" hidden ref={fallbackRef} multiple onChange={e=>void handleInput(e,true)} {...{'webkitdirectory':''} as React.InputHTMLAttributes<HTMLInputElement>}/>
    </div><label className="pfstudio-search"><Search size={15}/><input placeholder={w.search} value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="pfstudio-list">{filtered.length===0&&<p>{w.empty}</p>}{filtered.map((item,i)=><div key={`${item.key}:${i}`} className="pfstudio-item-wrap">{(i===0||filtered[i-1].source!==item.source)&&<h4>{item.source==='folder'?w.files:item.source==='library'?w.library:w.pick}</h4>}
      <button className={`pfstudio-item ${selected?.key===item.key?'selected':''}`} onClick={()=>setChosen(item.key)}><Boxes size={16}/><span>{item.name}<small>{item.prefab.objects.length} {w.count} · {item.fileName??'Local'}</small></span></button>
    </div>)}</div></aside>
    <div className="pfstudio-main">{selected?<><div className="pfstudio-title"><strong>{selected.name}</strong><span>{selected.prefab.objects.filter(o=>o.kind==='brush').length} brushes · {selected.prefab.objects.filter(o=>o.kind==='entity').length} entities</span></div>
      {selected.prefab.format==='svenstudio-bsp-object'&&selected.prefab.recovery?.mode==='surface-shell'&&<div className="pfstudio-status" role="status"><ShieldAlert size={15}/>{({es:`Aproximación visual: ${selected.prefab.recovery.panels} paneles delgados; ${selected.prefab.recovery.skippedFaces?.length??0} caras BSP omitidas. No recupera los volúmenes originales, caras ocultas ni colisiones. Revisá antes de compilar.`,en:`Visual approximation: ${selected.prefab.recovery.panels} thin panels; ${selected.prefab.recovery.skippedFaces?.length??0} BSP faces omitted. Original volumes, hidden faces and collision hulls are NOT recovered. Inspect before compiling.`,ru:`Приближённая модель: ${selected.prefab.recovery.panels} тонких панелей. Исходные объёмы, скрытые грани и коллизии не восстановлены.`,ko:`근사 모델: 얇은 패널 ${selected.prefab.recovery.panels}개. 원래 체적, 숨겨진 면, 충돌 복구 안 됨.`,zh:`近似模型：${selected.prefab.recovery.panels} 个薄面板。未恢复原始体积、隐藏面和碰撞。`,pt:`Aproximação visual: ${selected.prefab.recovery.panels} painéis finos. Volumes originais, faces ocultas e colisões NÃO foram recuperados.`} as Record<string,string>)[currentLocale]}</div>}
      {selected.prefab.format==='svenstudio-bsp-object'&&selected.prefab.recovery?.mode==='hull0-solid'&&<div className="pfstudio-status" role="status"><ShieldAlert size={15}/>{({es:`Sólidos Hull 0: ${selected.prefab.recovery.solids} celdas convexas reconstruidas del submodelo *${selected.prefab.recovery.modelIndex}. NO son los brushes originales. Texturas, colisiones y luz pueden diferir; verificá antes de compilar.`,en:`Hull 0 solids: ${selected.prefab.recovery.solids} convex cells recovered from submodel *${selected.prefab.recovery.modelIndex}. NOT the original brushes. Textures, collisions and lighting may differ.`,ru:`Hull 0: ${selected.prefab.recovery.solids} выпуклых фрагментов. Исходные кисти, коллизии и освещение не сохранены.`,ko:`Hull 0: 볼록 솔리드 ${selected.prefab.recovery.solids}개. 원본 브러시, 충돌 및 조명이 다를 수 있습니다.`,zh:`Hull 0：恢复 ${selected.prefab.recovery.solids} 个凸实体。并非原始笔刷，碰撞与光照可能不同。`,pt:`Hull 0: ${selected.prefab.recovery.solids} células convexas reconstruídas. Não são brushes originais; texturas, colisões e luz podem diferir.`} as Record<string,string>)[currentLocale]}</div>}
      <PrefabView3D key={selected.key} prefab={selected.prefab} textureAssets={previewTextures}/><div className="pfstudio-help">{w.preview}</div>
      {dependencies&&<section className="pfstudio-dependencies" aria-label="Prefab WAD dependencies">
        <div className="pfstudio-dep-head"><HardDrive size={16}/><strong>{({es:'Recursos y WAD para compilación',en:'Resources and compilation WAD',ru:'Ресурсы и WAD для компиляции',ko:'리소스 및 컴파일 WAD',zh:'资源和编译用 WAD',pt:'Recursos e WAD de compilação'} as Record<string,string>)[currentLocale]}</strong></div>
        <div className="pfstudio-dep-details">
          <span>{dependencies.filename??({es:'Prefab MAP: WAD externos',en:'MAP prefab: external WADs',ru:'Внешние WAD',ko:'외부 WAD',zh:'外部 WAD',pt:'WAD externos'} as Record<string,string>)[currentLocale]}</span>
          <small>{dependencies.embedded?({es:'WAD3 incluido en .svprefab',en:'WAD3 embedded in .svprefab',ru:'WAD3 включён в prefab',ko:'WAD3 포함됨',zh:'包含 WAD3',pt:'WAD3 incluído no prefab'} as Record<string,string>)[currentLocale]:({es:'Este prefab no incluye WAD3; comprobá los recursos externos.',en:'This prefab has no WAD3; check external textures.',ru:'WAD3 не включён.',ko:'WAD3가 포함되지 않았습니다.',zh:'未包含 WAD3',pt:'WAD3 não incluído.'} as Record<string,string>)[currentLocale]}</small>
        </div>
        <div className="pfstudio-dep-stats"><span><CheckCircle2 size={13}/>{dependencies.loaded.length}/{dependencies.materials.length} {({es:'texturas cargadas',en:'textures loaded',ru:'текстур загружено',ko:'텍스처 로드됨',zh:'已加载纹理',pt:'texturas carregadas'} as Record<string,string>)[currentLocale]}</span>
          {dependencies.collisions.length>0&&<span className="warning"><AlertTriangle size={13}/>{dependencies.collisions.length} {({es:'nombres compartidos con otros WAD',en:'names shared with other WADs',ru:'конфликтующих имён',ko:'중복 이름',zh:'重复名称',pt:'nomes duplicados'} as Record<string,string>)[currentLocale]}</span>}</div>
        <details className="pfstudio-dep-list"><summary>{dependencies.materials.length} {({es:'materiales utilizados',en:'materials used',ru:'используемые материалы',ko:'사용된 재질',zh:'使用的材质',pt:'materiais utilizados'} as Record<string,string>)[currentLocale]}</summary>
          <div>{dependencies.materials.map(name=><span key={name} className="pfstudio-dep-material">{name} {dependencies.loaded.includes(name)?'✓':''}</span>)}</div>
        </details>
        <div className="pfstudio-dep-build"><span>{dependencies.configuredPath?({es:'Ruta en configuración (existencia sin verificar):',en:'Configured path (file existence not checked):',ru:'Путь настроен (не проверен):',ko:'설정된 경로 (확인 안 됨):',zh:'已配置路径（未验证文件）:',pt:'Caminho configurado (não verificado):'} as Record<string,string>)[currentLocale]:({es:'WAD todavía no configurado para compilación. La vista previa no instala archivos.',en:'WAD not configured for compilation. Preview does not install files.',ru:'WAD не настроен для компиляции.',ko:'컴파일 WAD 경로가 설정되지 않았습니다.',zh:'编译 WAD 尚未配置',pt:'WAD ainda não configurado para compilar.'} as Record<string,string>)[currentLocale]}</span>
          {dependencies.configuredPath&&<code>{dependencies.configuredPath}</code>}</div>
        {dependencies.embedded&&<div className="pfstudio-dep-buttons">
          <button disabled={busy} onClick={()=>{setBusy(true);void prepareTextures(selected.prefab).then(()=>setMessage(`${dependencies.filename}: ${dependencies.materials.length} texture(s) loaded into MAP browser.`)).catch(setError).finally(()=>setBusy(false))}}><CheckCircle2 size={14}/>{({es:'Cargar texturas en MAP',en:'Load textures into MAP',ru:'Загрузить текстуры в MAP',ko:'MAP 텍스처 불러오기',zh:'加载纹理到 MAP',pt:'Carregar texturas no MAP'} as Record<string,string>)[currentLocale]}</button>
          <button disabled={busy} onClick={()=>{try{downloadPrefabWad(selected.prefab)}catch(err){setError(err)}}}><Download size={14}/>{({es:'Descargar WAD3',en:'Download WAD3',ru:'Скачать WAD3',ko:'WAD3 다운로드',zh:'下载 WAD3',pt:'Baixar WAD3'} as Record<string,string>)[currentLocale]}</button>
          <button disabled={busy||!settings.gameDir} onClick={()=>void installToGame()}><HardDrive size={14}/>{({es:'Instalar para compilar',en:'Install for compilation',ru:'Установить для сборки',ko:'컴파일용 설치',zh:'安装用于编译',pt:'Instalar para compilar'} as Record<string,string>)[currentLocale]}</button>
        </div>}
        {dependencies.embedded&&!settings.gameDir&&<small>{({es:'Configurá primero la carpeta del juego en Configuración de compilación.',en:'Set the game data folder in Build Configuration first.',ru:'Сначала настройте папку игры.',ko:'먼저 게임 폴더를 설정하세요.',zh:'先配置游戏目录',pt:'Configure a pasta do jogo primeiro.'} as Record<string,string>)[currentLocale]}</small>}
      </section>}
      <div className="pfstudio-actions"><button disabled={busy} onClick={()=>void importIntoMap()}><Plus size={15}/>{w.import}</button><button disabled={busy} onClick={()=>void startPlacement()}><MousePointer2 size={15}/>{w.place}</button><button disabled={busy} onClick={addLibrary}><Boxes size={15}/>{w.add}</button><button disabled={busy||!folder} onClick={()=>void saveToFolder(selected.prefab)}><Save size={15}/>{w.save}</button>
      {selected.source==='library'&&<button disabled={busy} className="pfstudio-remove" onClick={removeLibrary}><Trash2 size={15}/>{extra.remove}</button>}
      </div>
    </>:<div className="pfstudio-empty">{w.chooseItem}</div>}
    <div className="pfstudio-footer"><button disabled={!selectedIds.length||busy||!folder} onClick={saveSelection}><FileDown size={15}/>{w.saveSelection}</button><small>{w.tooLarge}</small></div>
    <div className="pfstudio-actions pfstudio-maintenance"><button disabled={busy} onClick={()=>void unloadUnused()}><Layers3 size={14}/>{extra.clean}</button><button disabled={busy} onClick={cleanDuplicates}><Trash2 size={14}/>{extra.duplicates}</button><small>{extra.smart}</small></div>
    {(message||errors.length>0)&&<div className="pfstudio-status" role="status"><span>{message}</span>{errors.length>0&&<details><summary><ShieldAlert size={14}/>{w.error} ({errors.length})</summary>{errors.slice(0,30).map((s,i)=><p key={i}>{s}</p>)}</details>}</div>}
    </div></div>
  </section>
 </div>,document.body);
}
