/** v2.4 desktop app: compact window buttons drawn by the app (themed), part of the header layout,
 * so they never float above studios or dialogs like the native overlay did. Hidden in the browser. */
import {useEffect,useState} from 'react';
import {Minus,Square,Copy,X} from 'lucide-react';
import {useT} from '../i18n';

type Bridge={isDesktop:true;windowAction?:(a:'minimize'|'maximize'|'close')=>Promise<boolean>;isMaximized?:()=>Promise<boolean>;onMaximized?:(cb:(v:boolean)=>void)=>()=>void};
export function DesktopWindowControls(){
  const t=useT();
  const bridge=(typeof window!=='undefined'?(window as unknown as {svenDesktop?:Bridge}).svenDesktop:undefined);
  const [maximized,setMaximized]=useState(true);
  useEffect(()=>{
    if(!bridge?.windowAction)return;
    void bridge.isMaximized?.().then(setMaximized);
    return bridge.onMaximized?.(setMaximized);
  },[bridge]);
  if(!bridge?.isDesktop||!bridge.windowAction)return null;
  const act=(a:'minimize'|'maximize'|'close')=>{void bridge.windowAction!(a).then(v=>{if(a==='maximize')setMaximized(v);});};
  return <div className="desktop-window-controls" role="group" aria-label={t('Window')}>
    <button type="button" title={t('Minimize')} aria-label={t('Minimize')} onClick={()=>act('minimize')}><Minus size={14}/></button>
    <button type="button" title={maximized?t('Restore'):t('Maximize')} aria-label={maximized?t('Restore'):t('Maximize')} onClick={()=>act('maximize')} onDoubleClick={e=>e.stopPropagation()}>{maximized?<Copy size={12}/>:<Square size={12}/>}</button>
    <button type="button" className="is-close" title={t('Close')} aria-label={t('Close')} onClick={()=>act('close')}><X size={15}/></button>
  </div>;
}
