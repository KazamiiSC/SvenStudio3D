import {useEffect,useState} from 'react';
import {PenTool,LayoutGrid,DoorOpen,AppWindow,Check,Move,Undo2,Trash2,Unlink2} from 'lucide-react';
import {useEditor} from '../store';
import {useArchitectureMode} from '../architectureModeState';
import {finishArchitectureMode,startArchitectureMode} from '../architectureModeController';
import type {ArchitecturePoint,ArchitectureLayoutOptions,ArchitectureLayoutRecord} from '../engine/architectureMode';
import {DEFAULT_LAYOUT_OPTIONS} from '../engine/architectureMode';

const EMPTY_LAYOUTS:ArchitectureLayoutRecord[]=[];
const parameter=(name:string,value:number,onChange:(v:number)=>void,min:number,max:number)=>
  <label className="arch-mode-field" key={name}><span>{name}</span><input type="number" value={value} min={min} max={max} step="1"
    onChange={e=>{if(Number.isFinite(e.target.valueAsNumber))onChange(e.target.valueAsNumber)}}/></label>;

export function ArchitectureModePanel({onStart}:{onStart:()=>void}){
  const mode=useArchitectureMode(s=>s.mode),drawOptions=useArchitectureMode(s=>s.options),setDrawOptions=useArchitectureMode(s=>s.setOptions);
  const layouts=useEditor(s=>s.project.architectureLayouts)??EMPTY_LAYOUTS;
  const selected=useEditor(s=>s.selected);
  const [chosenId,setChosenId]=useState(''),[editPoints,setEditPoints]=useState<ArchitecturePoint[]>([]);
  const [editOptions,setEditOptions]=useState<ArchitectureLayoutOptions>({...DEFAULT_LAYOUT_OPTIONS});
  const [message,setMessage]=useState('');
  const editId=useArchitectureMode(s=>s.editId),setEditId=useArchitectureMode(s=>s.edit);
  const chosen=layouts.find(l=>l.id===chosenId)||layouts.find(l=>l.memberIds.includes(selected||''))||layouts[0];
  useEffect(()=>{
    if(chosen){setEditPoints(chosen.points.map(p=>[...p] as ArchitecturePoint));setEditOptions({...chosen.options})}
  },[chosen?.id,chosen?.signatures.join('|')]);
  const edit=useEditor(s=>s.editArchitectureLayout),remove=useEditor(s=>s.deleteArchitectureLayout),detach=useEditor(s=>s.detachArchitectureLayout);
  const attempt=(task:()=>void,ok:string)=>{try{task();setMessage(ok)}catch(e){setMessage(`Error: ${String(e instanceof Error?e.message:e)}`)}};
  const start=(kind:'room'|'walls')=>attempt(()=>{startArchitectureMode(kind);onStart()},'');
  const open=(kind:'door'|'window')=>attempt(()=>{
    const s=useEditor.getState();
    if((s.project.architectureLayouts||[]).some(r=>r.memberIds.includes(s.selected||'')))throw Error('Convertí primero esta habitación a brushes normales para recortar puertas y ventanas.');
    s.startArchitecturePlacement(kind);onStart();
  },'');
  return <div className="architecture-mode-panel" data-architecture-mode="v1.5.17">
    <div className="arch-mode-title"><PenTool size={16}/> Architecture Mode <span>v1.5.17</span></div>
    <p>Construí directamente sobre la grilla. Clic para crear esquinas, Enter para terminar, Retroceso para deshacer un punto y Esc para cancelar.</p>
    <div className="arch-mode-actions">
      <button type="button" className={mode==='walls'?'active':''} onClick={()=>start('walls')}><PenTool size={15}/> Dibujar paredes</button>
      <button type="button" className={mode==='room'?'active':''} onClick={()=>start('room')}><LayoutGrid size={15}/> Dibujar habitación</button>
    </div>
    <div className="arch-mode-settings">
      {parameter('Altura de muros',drawOptions.height,n=>setDrawOptions({height:n}),32,4096)}
      {parameter('Espesor',drawOptions.thickness,n=>setDrawOptions({thickness:n}),4,256)}
      {parameter('Elevación Z',drawOptions.baseZ,n=>setDrawOptions({baseZ:n}),-32768,32768)}
      {parameter('Espesor losa',drawOptions.slab,n=>setDrawOptions({slab:n}),4,256)}
    </div>
    <label className="arch-mode-ceiling"><input type="checkbox" checked={drawOptions.ceiling} onChange={e=>setDrawOptions({ceiling:e.target.checked})}/> Crear techo en habitaciones cerradas</label>
    <p className="arch-mode-note">Trazados rectos X/Y para mantener compatibilidad con aberturas GoldSrc. Las habitaciones abiertas permiten entrar a editarlas; para sellar un mapa elegí techo y verificá el resultado en Map Doctor.</p>
    <details className="arch-mode-section">
      <summary>Ventanas y puertas sobre paredes existentes</summary>
      <div className="arch-mode-actions"><button onClick={()=>open('door')}><DoorOpen size={15}/> Puerta</button><button onClick={()=>open('window')}><AppWindow size={15}/> Ventana</button></div>
      <p>El modo de aberturas existente se conserva. En edificios paramétricos, primero convertí la estructura a brushes normales.</p>
    </details>
    <details className="arch-mode-section" open={layouts.length>0?undefined:false}>
      <summary>Edificios y trazados editables ({layouts.length})</summary>
      {!layouts.length?<p>Aún no hay trazados. Dibujá una pared o una habitación en el visor.</p>:<>
        <select aria-label="Seleccionar trazado" value={chosen?.id||''} onChange={e=>setChosenId(e.target.value)}>
          {layouts.map((l,i)=><option key={l.id} value={l.id}>{i+1}. {l.kind==='room'?'Habitación':'Paredes'} · {l.points.length} esquinas</option>)}
        </select>
        {chosen&&<>
          <div className="arch-mode-settings">
            {parameter('Altura',editOptions.height,n=>setEditOptions(p=>({...p,height:n})),32,4096)}
            {parameter('Grosor',editOptions.thickness,n=>setEditOptions(p=>({...p,thickness:n})),4,256)}
            {parameter('Base Z',editOptions.baseZ,n=>setEditOptions(p=>({...p,baseZ:n})),-32768,32768)}
            {parameter('Losa',editOptions.slab,n=>setEditOptions(p=>({...p,slab:n})),4,256)}
          </div>
          {chosen.kind==='room'&&<label className="arch-mode-ceiling"><input type="checkbox" checked={editOptions.ceiling} onChange={e=>setEditOptions(p=>({...p,ceiling:e.target.checked}))}/> Techo</label>}
          <div className="arch-mode-vertex-list"><strong>Contorno (X/Y)</strong>
            {editPoints.map((point,i)=><div key={i}><span>{i+1}</span><input aria-label={`Punto ${i+1} X`} type="number" value={point[0]} onChange={e=>setEditPoints(prev=>prev.map((p,j)=>j===i?[Number(e.target.value),p[1]]:p))}/><input aria-label={`Punto ${i+1} Y`} type="number" value={point[1]} onChange={e=>setEditPoints(prev=>prev.map((p,j)=>j===i?[p[0],Number(e.target.value)]:p))}/></div>)}
          </div>
          <div className="arch-mode-actions"><button type="button" className={editId===chosen.id?'active':''} onClick={()=>{setEditId(editId===chosen.id?null:chosen.id);useEditor.getState().setSelected(null);onStart()}}><Move size={15}/> Editar esquinas en el visor</button></div>
          <div className="arch-mode-actions arch-mode-secondary">
            <button type="button" onClick={()=>setEditPoints(p=>p.map(([x,y])=>[x+16,y]))}><Move size={14}/> +16 X</button>
            <button type="button" onClick={()=>setEditPoints(p=>p.map(([x,y])=>[x,y+16]))}><Move size={14}/> +16 Y</button>
          </div>
          <div className="arch-mode-actions"><button type="button" className="active" onClick={()=>attempt(()=>edit(chosen.id,editPoints,editOptions),'Contorno regenerado. Ctrl+Z para deshacer.')}><Check size={14}/> Aplicar cambios</button><button type="button" onClick={()=>{setEditPoints(chosen.points.map(p=>[...p] as ArchitecturePoint));setEditOptions({...chosen.options});setMessage('Cambios descartados')}}><Undo2 size={14}/> Restablecer</button></div>
          <div className="arch-mode-actions arch-mode-secondary"><button type="button" onClick={()=>attempt(()=>{detach(chosen.id);setChosenId('')},'Brushes liberados. Los cortes de ventanas ya están permitidos.')}><Unlink2 size={14}/> Convertir a brushes</button><button type="button" onClick={()=>{if(window.confirm('¿Eliminar este trazado y todos sus brushes?'))attempt(()=>{remove(chosen.id);setChosenId('')},'Trazado eliminado.')}}><Trash2 size={14}/> Eliminar</button></div>
        </>}
      </>}
    </details>
    {message&&<p className={message.startsWith('Error:')?'architecture-error':'arch-mode-notice'} role="status">{message}</p>}
    <details className="arch-mode-section"><summary>Constructor avanzado anterior</summary><p>Las primitivas y las estructuras anteriores se conservan en la pestaña de herramientas tradicionales.</p></details>
  </div>;
}

export function ArchitectureDrawControls(){
  const mode=useArchitectureMode(s=>s.mode),editId=useArchitectureMode(s=>s.editId),setEditId=useArchitectureMode(s=>s.edit),points=useArchitectureMode(s=>s.points),error=useArchitectureMode(s=>s.error);
  const undoPoint=useArchitectureMode(s=>s.undoPoint),cancel=useArchitectureMode(s=>s.cancel);
  const options=useArchitectureMode(s=>s.options),setOptions=useArchitectureMode(s=>s.setOptions);
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    if(mode==='off'&&!editId)return;
    const onKey=(e:KeyboardEvent)=>{
      if((e.target instanceof HTMLInputElement)||(e.target instanceof HTMLTextAreaElement))return;
      if(e.key==='Escape'){e.preventDefault();if(editId)setEditId(null);else cancel()}
      else if(mode!=='off'&&e.key==='Backspace'){e.preventDefault();undoPoint()}
      else if(mode!=='off'&&e.key==='Enter'){e.preventDefault();finishArchitectureMode()}
    };
    window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true);
  },[mode,editId,cancel,undoPoint,setEditId]);
  if(mode==='off'&&editId)return <section className="architecture-draw-controls" role="status" onPointerDown={e=>e.stopPropagation()}><div><strong>Editar esquinas · Architecture Mode</strong></div><p>Arrastrá los puntos del contorno en el visor. Las operaciones válidas conservan la estructura y se pueden deshacer con Ctrl+Z.</p><div className="arch-mode-actions"><button className="active" onClick={()=>setEditId(null)}>Terminar edición</button></div>{error&&<p className="architecture-error">{error}</p>}</section>;
  if(mode==='off')return null;
  return <section className="architecture-draw-controls" role="status" onPointerDown={e=>e.stopPropagation()}>
    <div><strong>{mode==='room'?'Habitación':'Paredes'} · {points.length} puntos</strong><button type="button" onClick={()=>setOpen(v=>!v)}>Medidas</button></div>
    <p>Hacé clic sobre el plano · movimientos ortogonales · Enter terminar · Esc cancelar</p>
    {open&&<div className="architecture-draw-measures">
      {parameter('Altura',options.height,n=>setOptions({height:n}),32,4096)}
      {parameter('Espesor',options.thickness,n=>setOptions({thickness:n}),4,256)}
      {parameter('Base Z',options.baseZ,n=>setOptions({baseZ:n}),-32768,32768)}
    </div>}
    <div className="arch-mode-actions"><button type="button" onClick={()=>useEditor.getState().issueCameraCommand('top')}>Vista superior</button><button type="button" disabled={!points.length} onClick={undoPoint}>Atrás</button><button type="button" className="active" disabled={points.length<(mode==='room'?4:2)} onClick={finishArchitectureMode}>Terminar</button><button type="button" onClick={cancel}>Cancelar</button></div>
    {error&&<p className="architecture-error">{error}</p>}
  </section>;
}
