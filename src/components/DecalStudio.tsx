import {useMemo,useRef,useState,type ChangeEvent} from 'react';
import {Eraser,Upload,Search,Paintbrush,MousePointer2,Copy,Trash2} from 'lucide-react';
import {useEditor} from '../store';
import {parseDecalWad} from '../engine/wad';

/** Native GoldSrc infodecal library. Deliberately no arbitrary rotation/size:
 * infodecal supports a texture name and surface origin, not a full UV matrix. */
export function DecalStudio(){
  const files=useRef<HTMLInputElement>(null);const [loading,setLoading]=useState(false);
  const gameDir=useEditor(s=>s.settings.gameDir);
  const [search,setSearch]=useState('');const [error,setError]=useState('');
  const locale=useEditor(s=>s.locale);const es=locale==='es';
  const decals=useEditor(s=>s.decalAssets);const active=useEditor(s=>s.activeDecal);
  const setAssets=useEditor(s=>s.setDecalAssets),choose=useEditor(s=>s.chooseDecal);
  const selected=useEditor(s=>s.project.objects.find(o=>o.id===s.selected));
  const remove=useEditor(s=>s.removeSelected),duplicate=useEditor(s=>s.duplicateSelected);
  const setProp=useEditor(s=>s.setObjectProp),appendLogs=useEditor(s=>s.appendLogs);
  const filtered=useMemo(()=>decals.filter(d=>d.name.toLowerCase().includes(search.toLowerCase())).slice(0,1000),[decals,search]);
  const onFiles=async(event:ChangeEvent<HTMLInputElement>)=>{
    const input=event.currentTarget;const picked=[...(input.files||[])];input.value='';
    for(const file of picked){try{const assets=await parseDecalWad(file);setAssets(assets,file.name);setError('');appendLogs([`Decal Studio: ${assets.length} decals imported from ${file.name}`])}
      catch(e){setError(String(e));appendLogs([`Decal Studio WAD error: ${String(e)}`])}}
  };
  const selectedDecal=selected?.kind==='entity'&&selected.classname==='infodecal'?selected:null;
  const fromGame=async()=>{
    if(!gameDir){setError(es?'Configurá primero la carpeta del juego en Build Configuration.':'Set the game folder in Build Configuration first.');return;}
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/assets/decals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameDir})});
      if(!response.ok)throw new Error((await response.json()).error||`HTTP ${response.status}`);
      const file=new File([await response.blob()],'decals.wad',{type:'application/octet-stream'});
      const assets=await parseDecalWad(file);setAssets(assets,'decals.wad');appendLogs([`Decal Studio: imported ${assets.length} decals from Sven Co-op.`]);
    }catch(error){setError(String(error));}finally{setLoading(false)}
  };
  return <section className="decal-studio assets-scroll" aria-label="Decal Studio">
    <div className="decal-intro"><strong>Decal Studio · infodecal</strong><p>{es?'Colocación nativa para Sven Co-op. Elegí un decal y hacé clic en una pared, piso o techo.':'Native Sven Co-op decals. Choose one, then click a wall, floor or ceiling.'}</p></div>
    <button className="soft-button" type="button" onClick={()=>void fromGame()} disabled={loading}>{loading?'...':es?'Cargar decals de Sven Co-op':'Load Sven Co-op decals'}</button>
    <button className="soft-button" type="button" onClick={()=>files.current?.click()}><Upload size={15}/>{es?'Importar decals.wad':'Import decals.wad'}</button>
    <input ref={files} type="file" accept=".wad" multiple hidden onChange={onFiles}/>
    {error&&<p className="modeling-error" role="alert">{error}</p>}
    <div className="decal-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={es?'Buscar decals...':'Search decals...'}/></div>
    {active&&<div className="decal-placement-status"><Paintbrush size={15}/><span>{es?'Colocando':'Placing'}: <strong>{active}</strong></span><button type="button" onClick={()=>choose(null)}>{es?'Finalizar (Esc)':'Stop (Esc)'}</button></div>}
    {!decals.length&&<div className="empty-message"><Paintbrush size={25}/><strong>{es?'No hay decals cargados':'No decals loaded'}</strong><span>{es?'Importá el archivo decals.wad original de Sven Co-op. El editor no lo descarga de Internet.':'Import the original Sven Co-op decals.wad; the editor does not fetch it online.'}</span></div>}
    <div className="decal-gallery">{filtered.map(asset=><button type="button" key={`${asset.wad}:${asset.name}`} className={`decal-tile ${active===asset.name?'chosen':''}`} title={`${asset.name} · ${asset.width}×${asset.height} · ${asset.wad}`} onClick={()=>choose(active===asset.name?null:asset.name)}>
      <span className="decal-thumbnail"><img src={asset.thumbUrl||asset.dataUrl} loading="lazy" alt=""/></span><small>{asset.name}</small>
    </button>)}</div>
    {selectedDecal&&<div className="decal-current"><strong>{es?'Decal seleccionado':'Selected decal'}</strong><span>{selectedDecal.props.texture}</span><p className="decal-drag-hint">{es?'Arrastrá el decal sobre su superficie con el mouse; un solo paso de Deshacer por movimiento. También podés usar Mover (G).':'Drag the decal over its surface with the mouse; one Undo step per movement. You can also use Move (G).'}</p><div className="decal-actions"><button type="button" onClick={()=>{if(active)setProp(selectedDecal.id,'texture',active)}} disabled={!active}><MousePointer2 size={14}/>{es?'Aplicar elegido':'Apply chosen'}</button><button type="button" onClick={duplicate}><Copy size={14}/>{es?'Duplicar':'Duplicate'}</button><button type="button" onClick={remove}><Trash2 size={14}/>{es?'Eliminar':'Delete'}</button></div></div>}
    <div className="decal-note">{es?'Los decals se guardan como infodecal en MAP y se pueden desplazar por la misma superficie. La rotación y escala libres no son compatibles con infodecal; se necesitan recursos y un modo avanzado distintos. Transparencias aproximadas en las vistas previas.':'Decals export as native infodecal in MAP and can be moved on their original surface. Free rotation/scale require a separate advanced export mode, not infodecal. Preview transparency is approximate.'}</div>
  </section>;
}
