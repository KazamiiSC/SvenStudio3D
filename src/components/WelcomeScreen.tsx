import {Box, Layers3, Paintbrush, UsersRound, Gamepad2, Cpu, Lightbulb, AudioLines, Boxes, Zap, Settings2, Database, Play, Sparkles, CheckCircle2, Map, ArrowRight} from 'lucide-react';
import {useEditor} from '../store';
import {useEffect,useRef} from 'react';
import {easeHomePointer,normalizeHomePointer} from '../engine/homeParallax';

/**
 * Real DOM home screen: no stretched screenshots, scenery, or painted text.
 * Its language intentionally stays English, independently of editor locale.
 * The editor, viewport and BuildTogether stay mounted behind this view.
 */
const studios = [
  {name:'Map Editor',detail:'3D construction',Icon:Box},
  {name:'Texture Studio',detail:'Textures & UVs',Icon:Layers3},
  {name:'Decal Studio',detail:'Surface details',Icon:Paintbrush},
  {name:'BuildTogether',detail:'Collaborative mapping',Icon:UsersRound,featured:true},
  {name:'Gameplay Studio',detail:'Logic & objectives',Icon:Gamepad2},
  {name:'NPC & AI Studio',detail:'NPCs & navigation',Icon:Cpu},
  {name:'Lighting Studio',detail:'Lights & skyboxes',Icon:Lightbulb},
  {name:'Sound Studio',detail:'Sound & ambience',Icon:AudioLines},
  {name:'Prefabs & Assets',detail:'Reusable content',Icon:Boxes},
];
const capabilities = [
  {name:'Integrated Compilation',detail:'SC-CSG · SC-BSP · SC-VIS · SC-RAD',Icon:Zap},
  {name:'Map Doctor',detail:'Diagnostics & optimization',Icon:Settings2},
  {name:'BSP Viewer',detail:'Inspect compiled maps',Icon:Database},
];

export function WelcomeScreen({onStart}:{onStart:()=>void}){
  const project=useEditor(s=>s.project);
  const homeRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const home=homeRef.current;
    if(!home)return;
    // Animate the welcome DOM only. No React state updates or WebGL camera work.
    // The RAF exists only while the position is changing; it is cancelled on unmount.
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine=window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame=0;
    let target={x:0,y:0};
    let actual={x:0,y:0};
    let enabled=!reduced.matches&&fine.matches;
    const interactive=Array.from(home.querySelectorAll<HTMLElement>('.ss-home-tool, .ss-home-capability, .ss-home-start'));
    const paint=()=>{
      home.style.setProperty('--ss-px',actual.x.toFixed(4));
      home.style.setProperty('--ss-py',actual.y.toFixed(4));
      home.style.setProperty('--ss-cursor-x',`${((actual.x+1)*50).toFixed(2)}%`);
      home.style.setProperty('--ss-cursor-y',`${((actual.y+1)*50).toFixed(2)}%`);
    };
    const tick=()=>{
      frame=0;
      actual=easeHomePointer(actual,target,0.12);
      if(Math.abs(actual.x-target.x)<0.001&&Math.abs(actual.y-target.y)<0.001){actual={...target};paint();return;}
      paint();
      frame=window.requestAnimationFrame(tick);
    };
    const schedule=()=>{if(!frame&&enabled)frame=window.requestAnimationFrame(tick);};
    const reset=()=>{target={x:0,y:0};schedule();};
    const resetInteractive=(element?:HTMLElement|null)=>{
      if(!element)return;
      element.style.setProperty('--ss-local-x','0');
      element.style.setProperty('--ss-local-y','0');
      element.style.setProperty('--ss-spot-x','50%');
      element.style.setProperty('--ss-spot-y','50%');
      element.classList.remove('ss-home-tilt-active');
    };
    const updateInteractive=(element:HTMLElement,e:PointerEvent)=>{
      // This element is a stationary hitbox; only its pointer-inert child
      // face tilts. Mouse coordinates therefore cannot oscillate with tilt.
      const box=element.getBoundingClientRect();
      const nx=Math.max(-1,Math.min(1,((e.clientX-box.left)/Math.max(box.width,1)-.5)*2));
      const ny=Math.max(-1,Math.min(1,((e.clientY-box.top)/Math.max(box.height,1)-.5)*2));
      element.style.setProperty('--ss-spot-x',`${e.clientX-box.left}px`);
      element.style.setProperty('--ss-spot-y',`${e.clientY-box.top}px`);
      element.style.setProperty('--ss-local-x',nx.toFixed(3));
      element.style.setProperty('--ss-local-y',ny.toFixed(3));
      element.classList.add('ss-home-tilt-active');
    };
    const onPointerMove=(e:PointerEvent)=>{
      if(!enabled||e.pointerType==='touch')return;
      const point=normalizeHomePointer(e.clientX,e.clientY,home.getBoundingClientRect());
      // Keep the global scene subtle. Most of the depth should be perceived via
      // local card motion, the holographic logo and the background lighting.
      target={x:point.x*.5,y:point.y*.5};
      schedule();
    };
    const onModeChange=()=>{
      enabled=!reduced.matches&&fine.matches;
      if(!enabled){
        if(frame)window.cancelAnimationFrame(frame);
        frame=0;target={x:0,y:0};actual={x:0,y:0};paint();
        interactive.forEach((el)=>resetInteractive(el));
      }
    };
    const onVisibilityChange=()=>{if(document.hidden)reset();};
    home.addEventListener('pointermove',onPointerMove,{passive:true});
    home.addEventListener('pointerleave',reset);
    home.addEventListener('pointercancel',reset);
    const localHandlers=interactive.map((element)=>{
      const localMove=(e:PointerEvent)=>{if(enabled&&e.pointerType!=='touch')updateInteractive(element,e);};
      const localLeave=()=>resetInteractive(element);
      element.addEventListener('pointerenter',localMove,{passive:true});
      element.addEventListener('pointermove',localMove,{passive:true});
      element.addEventListener('pointerleave',localLeave);
      element.addEventListener('pointercancel',localLeave);
      return {element,localMove,localLeave};
    });
    window.addEventListener('blur',reset);
    document.addEventListener('visibilitychange',onVisibilityChange);
    reduced.addEventListener('change',onModeChange);
    fine.addEventListener('change',onModeChange);
    return ()=>{
      home.removeEventListener('pointermove',onPointerMove);
      home.removeEventListener('pointerleave',reset);
      home.removeEventListener('pointercancel',reset);
      window.removeEventListener('blur',reset);
      document.removeEventListener('visibilitychange',onVisibilityChange);
      reduced.removeEventListener('change',onModeChange);
      fine.removeEventListener('change',onModeChange);
      localHandlers.forEach(({element,localMove,localLeave})=>{
        element.removeEventListener('pointerenter',localMove);
        element.removeEventListener('pointermove',localMove);
        element.removeEventListener('pointerleave',localLeave);
        element.removeEventListener('pointercancel',localLeave);
        resetInteractive(element);
      });
      if(frame)window.cancelAnimationFrame(frame);
      home.style.removeProperty('--ss-px');home.style.removeProperty('--ss-py');
      home.style.removeProperty('--ss-cursor-x');home.style.removeProperty('--ss-cursor-y');
    };
  },[]);
  const brushCount=project.objects.filter(o=>o.kind==='brush').length;
  const entityCount=project.objects.filter(o=>o.kind==='entity').length;
  return <section ref={homeRef} className="sven-welcome sven-welcome-solid ss-home-parallax" aria-label="SvenStudio 3D home">
    <div className="ss-home-depth-field" aria-hidden="true"/>
    <div className="ss-home-hologrid" aria-hidden="true"/>
    <div className="ss-home-backscatter" aria-hidden="true"/>
    <div className="ss-home-ambient-rings" aria-hidden="true"/>
    <div className="ss-home-particles" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i}/>)}</div>
    <div className="ss-home-cursor-aura" aria-hidden="true"/>
    <div className="ss-home-motion-light ss-home-motion-light-left" aria-hidden="true"/>
    <div className="ss-home-motion-light ss-home-motion-light-right" aria-hidden="true"/>
    <div className="ss-home-content">
      <div className="ss-home-topline">
        <span className="ss-home-kicker"><Sparkles size={13} aria-hidden="true"/> WELCOME TO SVENSTUDIO 3D</span>
        <span className="ss-home-network"><UsersRound size={14} aria-hidden="true"/> BuildTogether · Multiplayer Mapping</span>
      </div>
      <div className="ss-home-hero">
        <div className="ss-home-symbol-wrap" aria-hidden="true"><div className="ss-home-symbol-orbit"/><div className="ss-home-symbol-orbit ss-home-symbol-orbit-inner"/><div className="ss-home-symbol-glass"/><div className="ss-home-symbol"><Box size={61} strokeWidth={1.65}/></div></div>
        <h1>SVEN<span>STUDIO</span><b>3D</b></h1>
        <div className="ss-home-subtitle"><span/>ADVANCED MAPPING STUDIO FOR SVEN CO-OP<span/></div>
        <p>Create, edit, compile and share Sven Co-op maps with powerful, intuitive tools.</p>
      </div>
      <div className="ss-home-tools" aria-label="Mapping tools">
        {studios.map(({name,detail,Icon,featured})=><div key={name} className={`ss-home-tool ${featured?'ss-home-tool-featured':''}`}>
          <div className="ss-home-tool-face" aria-hidden="true">
            <Icon size={32} strokeWidth={1.8}/>
            <strong>{name}</strong>
            <small>{detail}</small>
          </div>
        </div>)}
      </div>
      <div className="ss-home-capabilities" aria-label="Editor capabilities">
        {capabilities.map(({name,detail,Icon})=><div key={name} className="ss-home-capability">
          <div className="ss-home-capability-face" aria-hidden="true">
            <Icon size={30} strokeWidth={1.9}/>
            <div><strong>{name}</strong><small>{detail}</small></div>
          </div>
        </div>)}
      </div>
      <div className="ss-home-bottom">
        <div className="ss-home-project" title={project.name||'Untitled Map'}>
          <Map size={19} aria-hidden="true"/><span><strong>{project.name||'Untitled Map'}</strong><small>{brushCount} brushes · {entityCount} entities</small></span>
        </div>
        <div className="ss-home-action">
          <button type="button" className="ss-home-start" onClick={onStart} aria-label="Start: return to the 3D editor">
            <span className="ss-home-start-face" aria-hidden="true">
              <Play size={29} fill="currentColor" strokeWidth={1}/> Start <ArrowRight size={24}/>
            </span>
          </button>
          <span>OPEN 3D EDITOR</span>
        </div>
        <div className="ss-home-preserved"><CheckCircle2 size={16} aria-hidden="true"/> Your map and editor state are preserved</div>
      </div>
    </div>
  </section>;
}
