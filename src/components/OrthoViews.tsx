/** Optional 4-view layout: Top / Front / Side wireframe views next to the 3D viewport.
 * Hammer-style controls (v2.3 HF9):
 *  - click selects (Shift/Ctrl adds); dragging an object moves it on that plane with the editor
 *    snap through moveSelection (texture lock, one Undo step);
 *  - dragging empty space draws a selection box (objects fully inside are selected);
 *  - one unrotated brush selected → 8 handles resize it, the opposite side stays fixed;
 *  - the Top view's "Draw block" button: dragging creates a block with the current texture and
 *    draw height (same brush the 3D draw creates); Esc or the button turns it off;
 *  - middle or right button pans, the wheel zooms around the cursor;
 *  - the grid follows the editor's visible grid size.
 * The 3D view is untouched.
 */
import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {Focus,Maximize2,SquarePlus,Slice} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {ORTHO_VIEWS,ORTHO_AXES,projectObjects,pickProjected,dragDelta,boundsOf,brushBounds,resizableBrush,type OrthoView} from '../engine/orthoProjection';
import type {Vec3} from '../engine/types';

const LABELS:Record<OrthoView,string>={top:'Top (X/Y)',front:'Front (X/Z)',side:'Side (Y/Z)'};
type Camera={cx:number;cy:number;scale:number}; // scale = world units per screen pixel
type Handle={h:-1|0|1;v:-1|0|1};
type Drag={mode:'pan'|'move'|'marquee'|'resize'|'draw'|'clip';startX:number;startY:number;moved:boolean;cam:Camera;hit:string|null;additive:boolean;handle?:Handle};
type Rect={x0:number;y0:number;x1:number;y1:number};
const norm=(r:Rect)=>({x0:Math.min(r.x0,r.x1),y0:Math.min(r.y0,r.y1),x1:Math.max(r.x0,r.x1),y1:Math.max(r.y0,r.y1)});

function OrthoPanel({view}:{view:OrthoView}){
  const t=useT();
  const objects=useEditor(s=>s.project.objects);
  const selectedIds=useEditor(s=>s.selectedIds);
  const snap=useEditor(s=>s.snapping?s.snap:0);
  const gridStep=useEditor(s=>s.gridDisplayStep);
  const storeDraw=useEditor(s=>s.drawMode);
  const [drawBlock,setDrawBlock]=useState(false);
  const clipMode=useEditor(s=>s.freeClipMode);
  const drawMode=!clipMode&&view==='top'&&(drawBlock||storeDraw);
  const [clipLine,setClipLine]=useState<{a:[number,number];b:[number,number];pending:boolean}|null>(null);
  const busy=useEditor(s=>s.modalTransform!==null||s.walkMode);
  const items=useMemo(()=>projectObjects(objects,view),[objects,view]);
  const selected=useMemo(()=>new Set(selectedIds),[selectedIds]);
  const host=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState({w:300,h:200});
  const [cam,setCam]=useState<Camera>({cx:0,cy:0,scale:4});
  const [offset,setOffset]=useState<[number,number]|null>(null);
  const [rect,setRect]=useState<(Rect&{kind:'marquee'|'resize'|'draw'})|null>(null);
  const [notice,setNotice]=useState('');
  const drag=useRef<Drag|null>(null);
  const framed=useRef(false);
  const [hAxis,vAxis]=ORTHO_AXES[view];
  const snapValue=(n:number)=>snap>0?Math.round(n/snap)*snap:Math.round(n);

  useEffect(()=>{
    const el=host.current;if(!el)return;
    const ro=new ResizeObserver(([entry])=>setSize({w:Math.max(40,entry.contentRect.width),h:Math.max(40,entry.contentRect.height)}));
    ro.observe(el);return()=>ro.disconnect();
  },[]);
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),3500);return()=>window.clearTimeout(timer);},[notice]);
  const frame=(ids?:ReadonlySet<string>)=>{
    const b=boundsOf(items,ids&&ids.size?ids:undefined)??boundsOf(items);
    if(!b)return;
    const w=Math.max(64,b.max[0]-b.min[0]),h=Math.max(64,b.max[1]-b.min[1]);
    setCam({cx:(b.min[0]+b.max[0])/2,cy:(b.min[1]+b.max[1])/2,scale:Math.max(w/(size.w*.85),h/(size.h*.85),.05)});
  };
  useEffect(()=>{if(!framed.current&&items.length&&size.w>40){framed.current=true;frame();}});

  const toWorld=(clientX:number,clientY:number,c=cam)=>{
    const r=host.current!.getBoundingClientRect();
    return [c.cx+(clientX-r.left-size.w/2)*c.scale,c.cy+(clientY-r.top-size.h/2)*c.scale] as [number,number];
  };
  useEffect(()=>{
    const el=host.current;if(!el)return;
    const wheel=(e:WheelEvent)=>{
      e.preventDefault();
      setCam(c=>{
        const factor=Math.exp(Math.sign(e.deltaY)*Math.min(Math.abs(e.deltaY),200)*0.0018);
        const scale=Math.min(256,Math.max(.02,c.scale*factor));
        const r=el.getBoundingClientRect();
        const px=e.clientX-r.left-r.width/2,py=e.clientY-r.top-r.height/2;
        return {scale,cx:c.cx+px*c.scale-px*scale,cy:c.cy+py*c.scale-py*scale};
      });
    };
    el.addEventListener('wheel',wheel,{passive:false});
    return()=>el.removeEventListener('wheel',wheel);
  },[]);

  // Resize handles for a single unrotated brush (screen-space bounds, Y flipped).
  const single=selectedIds.length===1?objects.find(o=>o.id===selectedIds[0]):undefined;
  const handleTarget=resizableBrush(single)?single:null;
  const handleBox=useMemo(()=>{
    if(!handleTarget)return null;
    const b=brushBounds(handleTarget);
    return {x0:b.min[hAxis],x1:b.max[hAxis],y0:-b.max[vAxis],y1:-b.min[vAxis],bounds:b};
  },[handleTarget,hAxis,vAxis]);
  const handleSize=5*cam.scale;
  const handles:Handle[]=[{h:-1,v:-1},{h:0,v:-1},{h:1,v:-1},{h:-1,v:0},{h:1,v:0},{h:-1,v:1},{h:0,v:1},{h:1,v:1}];
  const handlePos=(hd:Handle,box:Rect)=>[hd.h<0?box.x0:hd.h>0?box.x1:(box.x0+box.x1)/2,hd.v<0?box.y0:hd.v>0?box.y1:(box.y0+box.y1)/2] as [number,number];
  const hitHandle=(x:number,y:number):Handle|null=>{
    if(!handleBox)return null;
    for(const hd of handles){const [hx,hy]=handlePos(hd,handleBox);if(Math.abs(hx-x)<=handleSize*1.6&&Math.abs(hy-y)<=handleSize*1.6)return hd;}
    return null;
  };
  const resizedBox=(hd:Handle,dx:number,dy:number):Rect=>{
    const b=handleBox!;const r={x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y1};
    if(hd.h<0)r.x0=snapValue(b.x0+dx);if(hd.h>0)r.x1=snapValue(b.x1+dx);
    if(hd.v<0)r.y0=-snapValue(-(b.y0+dy));if(hd.v>0)r.y1=-snapValue(-(b.y1+dy));
    return r;
  };

  const entityRadius=7*cam.scale;
  const onPointerDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
    if(busy)return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [wx,wy]=toWorld(e.clientX,e.clientY);
    const additive=e.shiftKey||e.ctrlKey||e.metaKey;
    const base={startX:e.clientX,startY:e.clientY,moved:false,cam,additive};
    if(e.button!==0){drag.current={...base,mode:'pan',hit:null};return;}
    const handle=!additive&&!clipMode?hitHandle(wx,wy):null;
    if(handle){drag.current={...base,mode:'resize',hit:handleTarget!.id,handle};return;}
    const hit=pickProjected(items,wx,wy,entityRadius);
    if(hit&&!additive&&!drawMode&&!clipMode){
      if(!selected.has(hit))useEditor.getState().selectObject(hit,false);
      drag.current={...base,mode:'move',hit};return;
    }
    if(clipMode){setClipLine(null);drag.current={...base,mode:'clip',hit:null};return;}
    if(drawMode){drag.current={...base,mode:'draw',hit:null};return;}
    drag.current={...base,mode:'marquee',hit};
  };
  const onPointerMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
    const d=drag.current;if(!d)return;
    const dx=(e.clientX-d.startX)*d.cam.scale,dy=(e.clientY-d.startY)*d.cam.scale;
    if(!d.moved&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<4)return;
    d.moved=true;
    if(d.mode==='pan'){setCam({...d.cam,cx:d.cam.cx-dx,cy:d.cam.cy-dy});return;}
    if(d.mode==='move'){const delta=dragDelta(view,dx,dy,snap);setOffset([delta[hAxis],-delta[vAxis]]);return;}
    if(d.mode==='resize'&&d.handle){setRect({...resizedBox(d.handle,dx,dy),kind:'resize'});return;}
    const [sx,sy]=toWorld(d.startX,d.startY,d.cam),[ex,ey]=toWorld(e.clientX,e.clientY,d.cam);
    if(d.mode==='clip'){setClipLine({a:[snapValue(sx),-snapValue(-sy)],b:[snapValue(ex),-snapValue(-ey)],pending:false});return;}
    if(d.mode==='draw')setRect({x0:snapValue(sx),y0:-snapValue(-sy),x1:snapValue(ex),y1:-snapValue(-ey),kind:'draw'});
    else setRect({x0:sx,y0:sy,x1:ex,y1:ey,kind:'marquee'});
  };
  const finish=(e:ReactPointerEvent<HTMLDivElement>,cancel=false)=>{
    const d=drag.current;drag.current=null;setOffset(null);
    const box=rect;setRect(null);
    if(!d||cancel)return;
    const state=useEditor.getState();
    const dx=(e.clientX-d.startX)*d.cam.scale,dy=(e.clientY-d.startY)*d.cam.scale;
    try{
      if(d.mode==='move'){
        if(!d.moved)return;
        const delta=dragDelta(view,dx,dy,snap);
        if(delta.some(v=>v!==0))state.moveSelection(delta);
        return;
      }
      if(d.mode==='resize'&&d.handle&&handleBox&&d.moved){
        const r=norm(resizedBox(d.handle,dx,dy));
        const min=[...handleBox.bounds.min] as Vec3,max=[...handleBox.bounds.max] as Vec3;
        min[hAxis]=r.x0;max[hAxis]=r.x1;min[vAxis]=-r.y1;max[vAxis]=-r.y0;
        state.resizeBrushToBounds(d.hit!,min,max);
        return;
      }
      if(d.mode==='clip'){
        setClipLine(line=>line&&d.moved&&Math.hypot(line.b[0]-line.a[0],line.b[1]-line.a[1])>=1?{...line,pending:true}:null);
        return;
      }
      if(d.mode==='draw'&&box&&d.moved){
        const r=norm(box);
        if(r.x1-r.x0<1||r.y1-r.y0<1){setNotice(t('Drag a larger rectangle.'));return;}
        state.addDrawnBox([r.x0,-r.y1,0],[r.x1,-r.y0,0]);
        return;
      }
      if(d.mode==='marquee'){
        if(d.moved&&box){
          const r=norm(box);
          const inside=items.filter(it=>it.min[0]>=r.x0&&it.max[0]<=r.x1&&it.min[1]>=r.y0&&it.max[1]<=r.y1).map(it=>it.id);
          state.selectObjectIds(d.additive?[...state.selectedIds,...inside]:inside);
          return;
        }
        if(d.hit)state.selectObject(d.hit,d.additive);
        else if(!d.additive)state.selectObjectIds([]);
      }
    }catch(error){setNotice(t(String(error instanceof Error?error.message:error)));}
  };
  useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;if(drag.current){drag.current=null;setOffset(null);setRect(null);}else{setDrawBlock(false);setClipLine(null);useEditor.getState().setFreeClipMode(false);}};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc);},[]);

  // Grid: the editor's visible grid size, doubled until lines are at least 8 px apart; every 8th line brighter.
  const grid=useMemo(()=>{
    let step=Math.max(1,gridStep||16);while(step/cam.scale<8)step*=2;
    const x0=cam.cx-size.w/2*cam.scale,x1=cam.cx+size.w/2*cam.scale,y0=cam.cy-size.h/2*cam.scale,y1=cam.cy+size.h/2*cam.scale;
    let minor='',major='';
    for(let x=Math.ceil(x0/step)*step;x<=x1;x+=step){const seg=`M${x} ${y0}V${y1}`;if(Math.round(x/step)%8===0)major+=seg;else minor+=seg;}
    for(let y=Math.ceil(y0/step)*step;y<=y1;y+=step){const seg=`M${x0} ${y}H${x1}`;if(Math.round(y/step)%8===0)major+=seg;else minor+=seg;}
    return {minor,major,axes:`M${x0} 0H${x1}M0 ${y0}V${y1}`,step};
  },[cam,size,gridStep]);

  // Free clip: the drawn line plus this view's depth axis define the cutting plane.
  const depthAxis=[0,1,2].find(i=>i!==hAxis&&i!==vAxis)!;
  const clipPlane=(line:{a:[number,number];b:[number,number]})=>{
    const A:Vec3=[0,0,0],B:Vec3=[0,0,0];A[hAxis]=line.a[0];A[vAxis]=-line.a[1];B[hAxis]=line.b[0];B[vAxis]=-line.b[1];
    const d:Vec3=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],e:Vec3=[0,0,0];e[depthAxis]=1;
    const n:Vec3=[d[1]*e[2]-d[2]*e[1],d[2]*e[0]-d[0]*e[2],d[0]*e[1]-d[1]*e[0]];
    const sx=n[hAxis],sy=-n[vAxis];
    const front=Math.abs(sx)>=Math.abs(sy)?(sx>0?'right':'left'):(sy>0?'bottom':'top');
    const opposite={right:'left',left:'right',top:'bottom',bottom:'top'}[front];
    return {point:A,normal:n,front,back:opposite};
  };
  const applyClip=(side:'both'|'front'|'back')=>{
    if(!clipLine)return;
    try{const plane=clipPlane(clipLine);const cut=useEditor.getState().clipSelectedByPlane(plane.point,plane.normal,side);setNotice(`${t('Cut brushes')}: ${cut} · ${t('Ctrl+Z undoes it in one step.')}`);}
    catch(error){setNotice(t(String(error instanceof Error?error.message:error)));}
    setClipLine(null);
  };
  const sideNames:Record<string,string>={right:'Keep right side',left:'Keep left side',top:'Keep top side',bottom:'Keep bottom side'};
  const clipInfo=clipLine?.pending?clipPlane(clipLine):null;
  const normal=items.filter(it=>it.kind==='brush'&&!selected.has(it.id));
  const chosen=items.filter(it=>selected.has(it.id));
  const entities=items.filter(it=>it.kind==='entity'&&!selected.has(it.id));
  const viewBox=`${cam.cx-size.w/2*cam.scale} ${cam.cy-size.h/2*cam.scale} ${size.w*cam.scale} ${size.h*cam.scale}`;
  const box=(x:number,y:number,r:number)=>`M${x-r} ${y-r}h${r*2}v${r*2}h${-r*2}Z`;
  const rectPath=(r:Rect)=>{const n=norm(r);return `M${n.x0} ${n.y0}H${n.x1}V${n.y1}H${n.x0}Z`;};
  const rectSize=rect&&rect.kind!=='marquee'?(()=>{const n=norm(rect);return `${Math.round(n.x1-n.x0)} × ${Math.round(n.y1-n.y0)}`;})():'';
  return <section className={`ortho-panel ortho-${view}`} aria-label={t(LABELS[view])}>
    <header className="ortho-header"><strong>{t(LABELS[view])}</strong><small>{grid.step}u</small>
      <button type="button" className={clipMode?'is-on':''} aria-pressed={clipMode} title={t('Free clip: drag a line across the selected brushes in any 2D view, then choose what to keep. Esc ends.')} aria-label={t('Free clip')} onClick={()=>{setClipLine(null);useEditor.getState().setFreeClipMode(!clipMode);}}><Slice size={13}/></button>
      {view==='top'&&<button type="button" className={drawBlock?'is-on':''} aria-pressed={drawBlock} title={t('Draw block: drag a rectangle (current texture and draw height). Esc ends.')} aria-label={t('Draw block')} onClick={()=>setDrawBlock(v=>!v)}><SquarePlus size={13}/></button>}
      <button type="button" title={t('Frame selection')} aria-label={t('Frame selection')} disabled={!selectedIds.length} onClick={()=>frame(selected)}><Focus size={13}/></button>
      <button type="button" title={t('Frame whole map')} aria-label={t('Frame whole map')} onClick={()=>frame()}><Maximize2 size={13}/></button>
    </header>
    <div ref={host} className={`ortho-canvas${drawMode||clipMode?' is-drawing':''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onContextMenu={e=>e.preventDefault()}>
      <svg width={size.w} height={size.h} viewBox={viewBox} preserveAspectRatio="none">
        <path d={grid.minor} className="ortho-grid" vectorEffect="non-scaling-stroke"/>
        <path d={grid.major} className="ortho-grid-major" vectorEffect="non-scaling-stroke"/>
        <path d={grid.axes} className="ortho-axes" vectorEffect="non-scaling-stroke"/>
        <path d={normal.filter(it=>!it.entityBrush).map(it=>it.path).join('')} className="ortho-brush" vectorEffect="non-scaling-stroke"/>
        <path d={normal.filter(it=>it.entityBrush).map(it=>it.path).join('')} className="ortho-entity-brush" vectorEffect="non-scaling-stroke"/>
        <path d={entities.map(it=>box(it.min[0],it.min[1],4*cam.scale)).join('')} className="ortho-entity" vectorEffect="non-scaling-stroke"/>
        <g transform={offset?`translate(${offset[0]} ${offset[1]})`:undefined}>
          <path d={chosen.map(it=>it.kind==='entity'?box(it.min[0],it.min[1],5*cam.scale):it.path).join('')} className="ortho-selected" vectorEffect="non-scaling-stroke"/>
        </g>
        {handleBox&&!offset&&!rect&&<path d={handles.map(hd=>{const [x,y]=handlePos(hd,handleBox);return box(x,y,handleSize);}).join('')} className="ortho-handle" vectorEffect="non-scaling-stroke"/>}
        {clipLine&&<path d={`M${clipLine.a[0]} ${clipLine.a[1]}L${clipLine.b[0]} ${clipLine.b[1]}`} className="ortho-clip-line" vectorEffect="non-scaling-stroke"/>}
        {rect&&<path d={rectPath(rect)} className={`ortho-rect ortho-rect-${rect.kind}`} vectorEffect="non-scaling-stroke"/>}
      </svg>
      {offset&&<span className="ortho-move-readout">{`Δ ${offset[0]} , ${-offset[1]}`}</span>}
      {rectSize&&<span className="ortho-move-readout">{rectSize}</span>}
      {notice&&<span className="ortho-notice">{notice}</span>}
      {clipMode&&!clipLine&&!notice&&<span className="ortho-notice ortho-clip-hint">{t('Free clip: drag a line across the selected brushes.')}</span>}
      {clipInfo&&<div className="ortho-clip-bar" onPointerDown={e=>e.stopPropagation()}>
        <button type="button" onClick={()=>applyClip('both')}>{t('Keep both')}</button>
        <button type="button" onClick={()=>applyClip('front')}>{t(sideNames[clipInfo.front])}</button>
        <button type="button" onClick={()=>applyClip('back')}>{t(sideNames[clipInfo.back])}</button>
        <button type="button" onClick={()=>setClipLine(null)}>{t('Cancel')}</button>
      </div>}
    </div>
  </section>;
}

export function OrthoViews(){
  return <>{ORTHO_VIEWS.map(view=><OrthoPanel key={view} view={view}/>)}</>;
}
