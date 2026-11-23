import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('desktop app reuses the same server and only serves dist/ when Electron asks for it',()=>{
  const server=read('server/index.js');
  assert.match(server,/process\.env\.SVEN_SERVE_DIST==='1'\?projectPath\('dist'\):null/);
  assert.match(server,/app\.get\(\/\^\(\?!\\\/api\\\/\)\.\*\/,/,'SPA fallback never hides API routes');
  assert.match(server,/export const serverReady=new Promise/);
  assert.match(server,/if\(!process\.versions\.electron\)serverReady\.catch/,'plain node still exits loudly on a busy port');
});

test('main process: single instance, busy-port message, safe window, unsaved-changes question',()=>{
  const main=read('electron/main.cjs');
  assert.match(main,/requestSingleInstanceLock\(\)/);
  assert.match(main,/portFree\(port\)/);
  assert.match(main,/contextIsolation:true,nodeIntegration:false,sandbox:true/);
  assert.match(main,/'will-prevent-unload'/);
  assert.match(main,/setWindowOpenHandler/);
  assert.match(main,/Menu\.setApplicationMenu\(null\)/,'no default menu: Ctrl+W/Ctrl+R/F5 belong to the editor');
  // v2.4: app-drawn window buttons; no native overlay floating above studios.
  assert.doesNotMatch(main,/titleBarOverlay:/);
  assert.match(main,/ipcMain\.handle\('sven-desktop:window'/);
  const preload=read('electron/preload.cjs');
  assert.match(preload,/contextBridge\.exposeInMainWorld\('svenDesktop'/);
  assert.doesNotMatch(preload,/require\('(fs|child_process|node:fs)'\)/,'the page gets no Node access');
});

test('packaging config: installer + portable, files the server needs, no asar for compilers',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.main,'electron/main.cjs');
  assert.equal(pkg.build.asar,false);
  for(const f of ['electron/**','server/**','dist/**','public/**','tools/**'])assert.ok(pkg.build.files.includes(f),f);
  assert.deepEqual(pkg.build.win.target.map(t=>t.target),['nsis','zip']);
  assert.equal(pkg.build.nsis.perMachine,false,'per-user install: writable, no admin prompt');
  assert.ok(pkg.dependencies.express,'server dependency is packaged');
});

test('renderer: desktop shell is inert in the browser and makes the header the title bar',()=>{
  const shell=read('src/desktopShell.ts');
  assert.match(shell,/if\(!window\.svenDesktop\?\.isDesktop\)return;/);
  assert.match(read('src/boot.tsx'),/startDesktopShell\(\);/);
  const css=read('src/style.css');
  assert.match(css,/\.sven-desktop \.app-shell \.titlebar\{-webkit-app-region:drag;app-region:drag\}/);
  assert.match(read('src/App.tsx'),/<DesktopWindowControls\/>/);
  assert.match(css,/\.desktop-window-controls\{/);
  // The header density check must subtract the padding that holds the native window buttons.
  const hook=read('src/components/useFittingHeaderDensity.ts');
  assert.match(hook,/const right=bounds\.right-\(parseFloat\(style\.paddingRight\)\|\|0\)/);
  assert.match(hook,/return r\.right>right\+1\|\|/,'a group aligned to the edge is not an overflow (otherwise the header collapses to minimal)');
  assert.match(css,/\.sven-desktop \.app-shell \.titlebar :is\(button,input,select/);
});
