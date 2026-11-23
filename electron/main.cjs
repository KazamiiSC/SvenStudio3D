/** SvenStudio 3D desktop app (Electron).
 * Same editor and same local server as the browser version:
 *  - starts server/index.js inside this process (Electron bundles Node), serving dist/ on
 *    http://127.0.0.1:49177 so the API guard, BuildTogether and every route work unchanged;
 *  - opens one window with the app's own dark title bar (native min/max/close overlay);
 *  - no browser shortcuts in the way (Ctrl+W, Ctrl+R, F5 belong to the editor);
 *  - asks before closing with unsaved changes; links open in the default browser.
 */
'use strict';
const {app,BrowserWindow,dialog,shell,Menu,nativeTheme,ipcMain}=require('electron');
const path=require('node:path');
const net=require('node:net');
const {pathToFileURL}=require('node:url');

const ROOT=path.resolve(__dirname,'..');
const API_PORT=Number(process.env.SVEN_API_PORT||49177);
const BT_PORT=Number(process.env.SVEN_BUILDTOGETHER_PORT||49178);

// Tests and support can run an isolated profile: SVEN_USER_DATA=<folder>.
if(process.env.SVEN_USER_DATA)app.setPath('userData',process.env.SVEN_USER_DATA);
if(!app.requestSingleInstanceLock()){app.quit();}

function portFree(port){
  return new Promise(resolve=>{
    const probe=net.createServer();
    probe.once('error',()=>resolve(false));
    probe.once('listening',()=>probe.close(()=>resolve(true)));
    probe.listen(port,'127.0.0.1');
  });
}

async function startServer(){
  for(const port of [API_PORT,BT_PORT]){
    if(!(await portFree(port))){
      const busy=port===API_PORT?'49177':'49178';
      throw new Error(`El puerto ${busy} está en uso. Probablemente SvenStudio 3D ya está abierto (versión navegador o otra ventana). Cerralo y volvé a abrir la app.\n\nPort ${busy} is in use: SvenStudio 3D seems to be running already.`);
    }
  }
  process.env.SVEN_SERVE_DIST='1';
  process.env.SVEN_API_PORT=String(API_PORT);
  const server=await import(pathToFileURL(path.join(ROOT,'server','index.js')).href);
  await server.serverReady;
}

let win=null;
function createWindow(){
  nativeTheme.themeSource='dark';
  win=new BrowserWindow({
    width:1600,height:900,minWidth:1000,minHeight:620,show:false,
    title:'SvenStudio 3D',backgroundColor:'#0d1520',
    icon:path.join(ROOT,'SvenStudio3D.ico'),
    titleBarStyle:'hidden',
    // v2.4: no native overlay buttons. The app draws compact, themed window buttons inside its own header,
    // so nothing floats above the studios (the overlay used to cover their top-right corner).
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false,backgroundThrottling:false}
  });
  win.once('ready-to-show',()=>{win.maximize();win.show();});
  win.loadURL(`http://127.0.0.1:${API_PORT}/`);
  // Only our own local page is shown inside the window; everything else opens in the system browser.
  win.webContents.setWindowOpenHandler(({url})=>{if(/^https?:\/\//.test(url))void shell.openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(`http://127.0.0.1:${API_PORT}/`)){event.preventDefault();if(/^https?:\/\//.test(url))void shell.openExternal(url);}});
  // The editor's "unsaved changes" guard (beforeunload) becomes a real question instead of a silent block.
  win.webContents.on('will-prevent-unload',event=>{
    const choice=dialog.showMessageBoxSync(win,{type:'warning',buttons:['Salir sin guardar','Cancelar'],defaultId:1,cancelId:1,
      title:'SvenStudio 3D',message:'Hay cambios sin guardar.',detail:'Si salís ahora se pierden los cambios que no guardaste (Ctrl+S guarda el proyecto). La copia automática del navegador interno se conserva.'});
    if(choice===0)event.preventDefault();
  });
  // DevTools stay available for support with Ctrl+Shift+I; nothing else is bound by the app shell.
  win.webContents.on('before-input-event',(event,input)=>{
    if(input.type==='keyDown'&&input.control&&input.shift&&input.key.toLowerCase()==='i'){win.webContents.toggleDevTools();event.preventDefault();}
  });
  const sendMax=()=>{if(win&&!win.isDestroyed())win.webContents.send('sven-desktop:maximized',win.isMaximized());};
  win.on('maximize',sendMax);win.on('unmaximize',sendMax);win.on('enter-full-screen',sendMax);win.on('leave-full-screen',sendMax);
  win.on('closed',()=>{win=null;});
}

// Kept for older pages: the native overlay is gone, so there is nothing to recolour.
ipcMain.handle('sven-desktop:titlebar',()=>true);
ipcMain.handle('sven-desktop:window',(_event,action)=>{
  if(!win)return false;
  if(action==='minimize')win.minimize();
  else if(action==='maximize'){if(win.isMaximized())win.unmaximize();else win.maximize();}
  else if(action==='close')win.close();
  return win.isMaximized();
});
ipcMain.handle('sven-desktop:is-maximized',()=>!!win&&win.isMaximized());

app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
app.on('window-all-closed',()=>app.quit());
app.whenReady().then(async()=>{
  Menu.setApplicationMenu(null);
  try{await startServer();}
  catch(error){dialog.showErrorBox('SvenStudio 3D',String(error&&error.message||error));app.quit();return;}
  createWindow();
});
