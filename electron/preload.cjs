/** Minimal, safe bridge for the desktop app. The page gets no Node access:
 * only a flag and the three window buttons (minimize / maximize / close). */
'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('svenDesktop',{
  isDesktop:true,
  platform:process.platform,
  setTitleBarColors:(color,symbolColor)=>ipcRenderer.invoke('sven-desktop:titlebar',{color,symbolColor}),
  windowAction:action=>ipcRenderer.invoke('sven-desktop:window',String(action)),
  isMaximized:()=>ipcRenderer.invoke('sven-desktop:is-maximized'),
  onMaximized:callback=>{const listener=(_event,value)=>callback(!!value);ipcRenderer.on('sven-desktop:maximized',listener);return()=>ipcRenderer.removeListener('sven-desktop:maximized',listener);},
});
