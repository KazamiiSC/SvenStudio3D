/** v2.4 Editor Preferences: one window with a side menu that replaces four separate dialogs
 * (Appearance & accent theme, Entity visuals, Camera & Gizmo Controls, Visibility manager).
 * Every setting is the same store value as before; only the organisation changed. */
import {useEffect,useState,type ReactNode} from 'react';
import {Palette,LayoutTemplate,Gauge,Shapes,Move3D,Keyboard,EyeOff,X,SlidersHorizontal} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {ThemeSettings,WorkspaceSettings,ViewportSettings} from './DockWorkspace';
import {EntityAppearanceSettings} from './EntityAppearanceModal';
import {HiddenObjectsSettings} from './VisibilityManager';
import {CameraControlsSettings,ShortcutSettings} from '../app/AppDialogs';

export type PreferencesSection='theme'|'workspace'|'viewport'|'entities'|'camera'|'shortcuts'|'hidden';
const SECTIONS:{id:PreferencesSection;label:string;hint:string;icon:ReactNode}[]=[
  {id:'theme',label:'Theme & colors',hint:'Interface theme, accent color, size and text',icon:<Palette size={17}/>},
  {id:'workspace',label:'Workspace',hint:'Layouts, panels and toolbar',icon:<LayoutTemplate size={17}/>},
  {id:'viewport',label:'3D viewport & performance',hint:'Quality, resolution and FPS',icon:<Gauge size={17}/>},
  {id:'entities',label:'Entities',hint:'Markers, colors and labels',icon:<Shapes size={17}/>},
  {id:'camera',label:'Camera & gizmo',hint:'Navigation, transform and snapping',icon:<Move3D size={17}/>},
  {id:'shortcuts',label:'Keyboard shortcuts',hint:'Change any key combination',icon:<Keyboard size={17}/>},
  {id:'hidden',label:'Hidden objects list',hint:'Show, focus or isolate hidden objects',icon:<EyeOff size={17}/>},
];
export function PreferencesStudio({initial='theme',onClose}:{initial?:PreferencesSection;onClose:()=>void}){
  const t=useT();
  const [section,setSection]=useState<PreferencesSection>(initial);
  const hiddenCount=useEditor(s=>{let n=0;for(const o of s.project.objects)if(o.hidden)n++;return n;});
  useEffect(()=>setSection(initial),[initial]);
  useEffect(()=>{
    // Shortcut recording uses Escape itself; it stops propagation before this listener runs.
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!(e.target instanceof HTMLButtonElement&&e.target.classList.contains('capturing'))){e.preventDefault();onClose();}};
    window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc);
  },[onClose]);
  const current=SECTIONS.find(s=>s.id===section)!;
  return <div className="modal-backdrop prefs-backdrop" onMouseDown={onClose}>
    <section className="prefs-window" role="dialog" aria-modal="true" aria-label={t('Editor preferences')} onMouseDown={e=>e.stopPropagation()}>
      <aside className="prefs-nav">
        <div className="prefs-brand"><SlidersHorizontal size={18}/><div><strong>{t('Editor preferences')}</strong><small>{t('Saved automatically')}</small></div></div>
        <nav>{SECTIONS.map(s=><button type="button" key={s.id} className={section===s.id?'active':''} aria-current={section===s.id?'page':undefined} onClick={()=>setSection(s.id)}>
          {s.icon}<span>{t(s.label)}</span>{s.id==='hidden'&&hiddenCount>0&&<b className="prefs-badge">{hiddenCount}</b>}
        </button>)}</nav>
        <p className="prefs-foot">{t('Preferences change only the editor. They never modify the map or the compiled BSP.')}</p>
      </aside>
      <main className="prefs-main">
        <header className="prefs-head">
          <div>{current.icon}<div><h2>{t(current.label)}</h2><small>{t(current.hint)}</small></div></div>
          <button type="button" className="prefs-close" aria-label={t('Close')} title={t('Close')} onClick={onClose}><X size={18}/></button>
        </header>
        <div className="prefs-body" key={section}>
          {section==='theme'&&<ThemeSettings/>}
          {section==='workspace'&&<WorkspaceSettings/>}
          {section==='viewport'&&<ViewportSettings/>}
          {section==='entities'&&<EntityAppearanceSettings/>}
          {section==='camera'&&<CameraControlsSettings/>}
          {section==='shortcuts'&&<ShortcutSettings/>}
          {section==='hidden'&&<HiddenObjectsSettings onClose={onClose}/>}
        </div>
      </main>
    </section>
  </div>;
}
