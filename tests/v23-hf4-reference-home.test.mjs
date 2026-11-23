import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(root+p,'utf8');

test('HF4 home is a fixed design canvas fitted to the window',()=>{
 const ui=read('src/components/WelcomeScreen.tsx');
 assert.match(ui,/DESIGN_W=1672, DESIGN_H=825/);
 assert.match(ui,/new ResizeObserver\(fit\)/);
 assert.match(ui,/style=\{\{zoom:scale\}/);
 assert.match(ui,/import '\.\/WelcomeScreen\.css'/);
});

test('HF4 keeps real actions, real history and profile switching',()=>{
 const ui=read('src/components/WelcomeScreen.tsx');const app=read('src/App.tsx');
 assert.match(ui,/listProjectHistory\(\)/);
 assert.match(ui,/openHistoryCheckpoint\(entry\.id\)/);
 assert.match(ui,/switchProfile\('svengine'\)/);
 assert.match(ui,/switchProfile\('cs16'\)/);
 assert.match(ui,/setPendingCsMap\(true\)/,'CS Map Studio from the Sven profile switches profile first');
 assert.match(ui,/onAction\('settings'\)/);assert.match(ui,/onAction\('history'\)/);
 for(const action of ['new','open','import','settings','editor','csMap','bspViewer','bspEditor','world','connect','texture','sound','prefabs','doctor','together','resources','help','appearance','history'])assert.match(app,new RegExp(`case '${action}'`));
 assert.match(app,/const \[welcomeOpen,setWelcomeOpen\]=useState\(true\)/,'every load starts at home');
 assert.match(read('src/engine/shellScale.ts'),/if\(welcomeOpen\|\|bspMode\)return 1/);
});

test('HF4 recent projects show no map thumbnails',()=>{
 const ui=read('src/components/WelcomeScreen.tsx');const css=read('src/components/WelcomeScreen.css');
 assert.doesNotMatch(ui,/thumb-\d|recent-picture/i);
 const recent=ui.slice(ui.indexOf('ssr-recent-list'),ui.indexOf('{/* CENTER'));
 assert.doesNotMatch(recent,/<img|background/i);
 assert.doesNotMatch(css,/thumb-\d|recent-picture/i);
});

test('HF4 illustrations are text-free crops that exist on disk',()=>{
 const css=read('src/components/WelcomeScreen.css');
 const assets=['hero-art','community','icon-cs','pill-cs',...['editor','bspviewer','bspeditor','csmap','world','connect','texture','sound','prefabs','doctor','together','resources'].map(n=>`tool-${n}`)];
 for(const name of assets){
  const path=`public/home-ref/${name}.webp`;
  assert.ok(existsSync(root+path),`missing ${path}`);
  assert.equal(readFileSync(root+path).subarray(8,12).toString('ascii'),'WEBP');
  assert.ok(statSync(root+path).size>500,`suspiciously empty ${path}`);
  assert.ok(css.includes(`/home-ref/${name}.webp`),`${name} not referenced`);
 }
});

test('HF4 copy exists in six languages and avoids non-GoldSrc formats',()=>{
 const copy=read('src/engine/homeRef.ts');
 for(const id of ['es','en','ru','ko','zh','pt'])assert.match(copy,new RegExp(`const ${id}:HomeRefCopy`));
 assert.doesNotMatch(copy,/VMF|visgroup/i);
});

test('HF4 removed the legacy home styles and assets',()=>{
 assert.doesNotMatch(read('src/style.css'),/\.ss-home|\.ss-approved|\.sven-welcome/);
 assert.ok(!existsSync(root+'public/home-v23-clean'));
 assert.ok(!existsSync(root+'public/home-v23-ref'));
 assert.ok(!existsSync(root+'src/engine/homeReferenceCopy.ts'));
});

test('HF4 game icons come from the local install and decode classic ICO masks',async()=>{
 const {icoToPng}=await import('../server/gameIcons.js');
 // 2x2, 24-bit, AND mask marks the top-left pixel transparent.
 const dib=Buffer.alloc(40+2*8+2*4);dib.writeUInt32LE(40,0);dib.writeInt32LE(2,4);dib.writeInt32LE(4,8);dib.writeUInt16LE(1,12);dib.writeUInt16LE(24,14);
 dib.fill(0xff,40,56);dib[40+16+4]=0x80; // mask row for y=0 (stored last, bottom-up)
 const head=Buffer.alloc(22);head.writeUInt16LE(1,2);head.writeUInt16LE(1,4);head[6]=2;head[7]=2;head.writeUInt32LE(dib.length,14);head.writeUInt32LE(22,18);
 const png=icoToPng(Buffer.concat([head,dib]));
 assert.equal(png.subarray(1,4).toString('ascii'),'PNG');
 assert.equal(png.readUInt32BE(16),2);
 const server=read('server/index.js'),ui=read('src/components/WelcomeScreen.tsx');
 assert.match(server,/app\.get\('\/api\/assets\/game-icon'/);
 assert.match(ui,/onError=\{\(\)=>setFailed\(true\)\}/,'falls back when the game is not installed');
 assert.ok(!existsSync(root+'public/home-ref/game-sven.webp'),'no game logos are bundled');
});
