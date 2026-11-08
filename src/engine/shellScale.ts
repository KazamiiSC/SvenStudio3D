/** MAP Editor chrome alone follows Workspace UI scale. Home/BSP are pixel-perfect. */
export function resolveShellScale(uiScale:number,welcomeOpen:boolean,bspMode:boolean):number {
  if(welcomeOpen||bspMode)return 1;
  return Number.isFinite(uiScale)&&uiScale>=0.5&&uiScale<=2?uiScale:1;
}
