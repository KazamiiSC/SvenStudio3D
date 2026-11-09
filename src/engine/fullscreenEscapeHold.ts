/** Editor-side long-press escape handling for fullscreen Keyboard Lock.
 * Chrome owns its security notification and native emergency-escape timeout.
 * This adds a 1.5s app exit when key events are delivered; it cannot override
 * browser refusal of Keyboard Lock or shorten Chrome's internal timer.
 */
export const FULLSCREEN_ESCAPE_HOLD_MS=1500;

export function bindFullscreenEscapeHold(
  doc:Document,
  win:Window,
  holdMs=FULLSCREEN_ESCAPE_HOLD_MS,
):()=>void{
  let timer:ReturnType<typeof setTimeout>|null=null;
  const cancel=()=>{if(timer!==null){clearTimeout(timer);timer=null;}};
  const down=(event:KeyboardEvent)=>{
    if(event.key!=='Escape'&&event.code!=='Escape')return;
    if(!doc.fullscreenElement){cancel();return;}
    if(event.repeat||timer!==null)return;
    // Other app listeners still receive short Esc and can cancel active tools.
    timer=setTimeout(()=>{
      timer=null;
      if(doc.fullscreenElement)void doc.exitFullscreen().catch(()=>{});
    },holdMs);
  };
  const up=(event:KeyboardEvent)=>{if(event.key==='Escape'||event.code==='Escape')cancel();};
  win.addEventListener('keydown',down,true);
  win.addEventListener('keyup',up,true);
  win.addEventListener('blur',cancel);
  doc.addEventListener('fullscreenchange',cancel);
  return()=>{
    cancel();
    win.removeEventListener('keydown',down,true);
    win.removeEventListener('keyup',up,true);
    win.removeEventListener('blur',cancel);
    doc.removeEventListener('fullscreenchange',cancel);
  };
}
