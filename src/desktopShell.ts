/** Desktop app integration (Electron). Does nothing in the browser version.
 * Marks <html> with .sven-desktop so the app header acts as the window title bar (drag to move,
 * double-click to maximize). The window buttons are drawn by DesktopWindowControls (v2.4),
 * so there is no native overlay to recolour anymore.
 */
type SvenDesktop={isDesktop:true;platform:string;setTitleBarColors?:(color:string,symbolColor:string)=>Promise<boolean>};
declare global{interface Window{svenDesktop?:SvenDesktop}}

export const isDesktopApp=()=>typeof window!=='undefined'&&window.svenDesktop?.isDesktop===true;

export function startDesktopShell(){
  if(!window.svenDesktop?.isDesktop)return;
  document.documentElement.classList.add('sven-desktop');
}
