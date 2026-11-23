/** Short first-run tour (v2.3 HF9): five steps that point at the real controls.
 * It starts once, after the welcome screen and any open dialog are closed, can be skipped,
 * and can be replayed from Help ("svenstudio:start-tour"). It never changes the map or settings.
 */
import {useEffect,useLayoutEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {useT} from '../i18n';

const STORAGE_KEY='svenstudio-first-run-tour-v1';
type Step={target:string;title:string;body:string};
const STEPS:Step[]=[
  {target:'.ribbon',title:'Tools bar',body:'Editing lives here: move, rotate, scale, undo/redo, duplicate, what is drawn (wireframe, labels, gizmo) and geometry editing (object, vertex, edge, face). Workspace → Toolbar groups shows or hides groups.'},
  {target:'.viewport-frame .hud-view',title:'Viewport bar',body:'How you look at the map: perspective, grid and snap, framing, 4 views, hidden objects, skybox, compile region and UV. When space is short, the rest goes into the ··· button.'},
  {target:'.studio-menu-button:not(.workspace-menu-button)',title:'Studios',body:'Every studio, grouped by task: Construction, Gameplay, Lighting & sound and Check (Map Doctor, Entity report).'},
  {target:'.top-compile',title:'Compile and play',body:'Build configuration sets the game and compilers. After compiling, the output window offers Play (opens the game on your map) and Go to leak.'},
  {target:'.titlebar-more',title:'Help and more',body:'More → Help has "What is new and where everything is" and every keyboard shortcut. Shortcuts can be changed in Workspace → Camera & Gizmo Controls.'},
];

export function FirstRunTour({blocked}:{blocked:boolean}){
  const t=useT();
  const [step,setStep]=useState<number|null>(null);
  const [box,setBox]=useState<DOMRect|null>(null);
  // Start once, when nothing else is in front (welcome screen, help or another dialog).
  useEffect(()=>{
    let seen=false;try{seen=localStorage.getItem(STORAGE_KEY)==='done';}catch{/* private mode: show once per session */}
    if(seen||blocked)return;
    const timer=window.setInterval(()=>{
      if(document.querySelector('.modal-backdrop,[role="dialog"]'))return;
      if(!document.querySelector('.ribbon'))return;
      setStep(0);window.clearInterval(timer);
    },700);
    return()=>window.clearInterval(timer);
  },[blocked]);
  useEffect(()=>{
    const start=()=>setStep(0);
    document.addEventListener('svenstudio:start-tour',start);
    return()=>document.removeEventListener('svenstudio:start-tour',start);
  },[]);
  useLayoutEffect(()=>{
    if(step===null)return;
    const measure=()=>{
      const el=[...document.querySelectorAll<HTMLElement>(STEPS[step].target)].find(e=>e.getBoundingClientRect().width>0);
      setBox(el?el.getBoundingClientRect():null);
    };
    measure();
    window.addEventListener('resize',measure);
    const timer=window.setInterval(measure,500);
    return()=>{window.removeEventListener('resize',measure);window.clearInterval(timer);};
  },[step]);
  useEffect(()=>{
    if(step===null)return;
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();finish();}};
    window.addEventListener('keydown',key,true);
    return()=>window.removeEventListener('keydown',key,true);
  });
  const finish=()=>{setStep(null);try{localStorage.setItem(STORAGE_KEY,'done');}catch{/* ignore */}};
  if(step===null)return null;
  const current=STEPS[step];
  const pad=6;
  // Bubble below the target when there is room, otherwise above; clamped to the window.
  const bubbleWidth=Math.min(340,window.innerWidth-24);
  const below=!box||box.bottom+190<window.innerHeight;
  const left=box?Math.max(12,Math.min(window.innerWidth-bubbleWidth-12,box.left)):window.innerWidth/2-bubbleWidth/2;
  const top=box?(below?box.bottom+pad+10:Math.max(12,box.top-pad-10-180)):window.innerHeight/2-90;
  return createPortal(<div className="first-run-tour" role="dialog" aria-modal="false" aria-labelledby="first-run-tour-title">
    {box&&<div className="first-run-tour-spot" style={{left:box.left-pad,top:box.top-pad,width:box.width+pad*2,height:box.height+pad*2}}/>}
    <section className="first-run-tour-bubble" style={{left,top,width:bubbleWidth}}>
      <small>{step+1} / {STEPS.length}</small>
      <h3 id="first-run-tour-title">{t(current.title)}</h3>
      <p>{t(current.body)}</p>
      <div className="first-run-tour-actions">
        <button type="button" className="first-run-tour-skip" onClick={finish}>{t('Skip tour')}</button>
        {step>0&&<button type="button" onClick={()=>setStep(step-1)}>{t('Back')}</button>}
        {step<STEPS.length-1?<button type="button" className="first-run-tour-next" onClick={()=>setStep(step+1)}>{t('Next')}</button>:<button type="button" className="first-run-tour-next" onClick={finish}>{t('Done')}</button>}
      </div>
    </section>
  </div>,document.body);
}
