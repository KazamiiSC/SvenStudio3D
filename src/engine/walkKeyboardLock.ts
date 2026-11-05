/** Optional fullscreen Keyboard Lock for browser-reserved game input.
 * This uses the browser's permission-protected API. Without fullscreen/consent
 * it cannot override Ctrl+W, and Windows always retains emergency shortcuts.
 * The normal editor never attempts to lock keyboard input.
 */
type LockableNavigator=Navigator&{keyboard?:{lock:(keys?:string[])=>Promise<void>;unlock:()=>void}};
let requested=false;
let ownsFullscreen=false;
let locked=false;
const lockable=()=> (navigator as LockableNavigator).keyboard;

export function requestSafeWalkFullscreen(enabled:boolean,report?:(message:string)=>void):void{
  if(!enabled||typeof document==='undefined'||!document.documentElement.requestFullscreen)return;
  requested=true;
  const root=document.documentElement;
  const existing=!!document.fullscreenElement;
  // This function must be called synchronously from a user gesture.
  // Some browsers support the fullscreen option and some require navigator.keyboard.lock().
  let entry:Promise<void>;
  try{entry=existing?Promise.resolve():root.requestFullscreen({keyboardLock:'browser'} as FullscreenOptions)}
  catch(err){report?.(`Safe keyboard mode: fullscreen rejected (${String(err)}). Use C for crouch.`);return;}
  void entry.then(async()=>{
    if(!existing)ownsFullscreen=true;
    if(!requested){releaseSafeWalkFullscreen();return;}
    if(document.fullscreenElement!==root)return;
    const keyboard=lockable();
    if(!keyboard?.lock){report?.('Safe keyboard mode: Keyboard Lock API not available. Use C for crouch.');return;}
    try{
      // No argument: lock all available keys, including modified W (Ctrl+W),
      // subject to OS/browser restrictions and user permission.
      await keyboard.lock();
      if(!requested){keyboard.unlock();return;}
      locked=true;
      report?.('Safe keyboard mode: browser Keyboard Lock enabled in fullscreen.');
    }catch(err){report?.(`Safe keyboard mode: browser refused keyboard lock (${String(err)}). Use C for crouch.`)}
  }).catch(err=>report?.(`Safe keyboard mode: fullscreen unavailable (${String(err)}). Use C for crouch.`));
}
export function releaseSafeWalkFullscreen():void{
  requested=false;
  if(locked){try{lockable()?.unlock()}catch{/* Browser may have already unlocked */}locked=false;}
  const exit=ownsFullscreen&&document.fullscreenElement===document.documentElement;
  ownsFullscreen=false;
  if(exit)void document.exitFullscreen().catch(()=>{});
}
