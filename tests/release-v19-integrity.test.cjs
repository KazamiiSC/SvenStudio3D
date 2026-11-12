const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('v1.9 uses a single, consistent public version',()=>{
 const pkg=JSON.parse(read('package.json'));
 const lock=JSON.parse(read('package-lock.json'));
 assert.equal(pkg.version,'1.9.0');
 assert.equal(lock.version,pkg.version);
 assert.equal(lock.packages[''].version,pkg.version);
 const app=read('src/App.tsx');
 assert.match(app,/SvenStudio 3D v1\.9</);
 assert.match(app,/className="version-label">v1\.9</);
 assert.match(app,/guide.*releaseGuide|releaseGuide\(locale\)/s);
 assert.match(read('SvenStudio3D.bat'),/SvenStudio 3D v1\.9/);
});

test('Help includes updated core features and is navigable',()=>{
 const app=read('src/App.tsx');
 const base=read('src/engine/editorManual.ts');
 const release=read('src/engine/editorReleaseGuide.ts');
 assert.match(app,/manual-current/);
 assert.match(app,/manual-guide-grid/);
 for(const label of ['Brush Workshop','Smart Brush Fusion','World Builder','Free 3D','Libre 3D']){
   assert.ok(base.includes(label)||release.includes(label),label);
 }
});

test('six languages provide current-release help and localized basic manual',async()=>{
 const {releaseGuide}=await import('../src/engine/editorReleaseGuide.ts');
 const {localizeManual,localizedActionTitle}=await import('../src/engine/editorManualIntl.ts');
 const english={contact:'Discord: kzsheez'};
 for(const lang of ['es','en','ru','ko','zh','pt']){
   const guide=releaseGuide(lang);
   assert.ok(guide.title.includes('v1.9'),lang);
   assert.ok(guide.intro.length>40,lang);
   assert.equal(guide.cards.length,6,lang);
   assert.ok(guide.cards.every(card=>card.title.length>2&&card.description.length>35),lang);
   if(lang!=='es'&&lang!=='en'){
     const manual=localizeManual(lang,english);
     assert.ok(manual.camera.length>0&&manual.first.length>0,lang);
     assert.equal(manual.studios.length,18,lang);
     assert.notEqual(localizedActionTitle(lang,'move','Move'),'Move',lang);
   }
 }
});

test('GitHub-style Windows portable launcher keeps binaries local',()=>{
 const launcher=read('SvenStudio3D.bat');
 assert.match(launcher,/runtime\\node\.exe/);
 assert.match(launcher,/prepare-portable-node\.ps1/);
 assert.doesNotMatch(launcher,/^\s*(?:call\s+)?npm(?:\.cmd)?\s+(?:install|ci)\b/im);
 for(const name of ['node_modules/@esbuild/win32-x64/esbuild.exe', 'node_modules/@rollup/rollup-win32-x64-msvc/rollup.win32-x64-msvc.node','scripts/launcher-i18n.ps1','scripts/prepare-portable-node.ps1']){
  assert.ok(fs.existsSync(path.join(root,name)),name);
 }
 assert.ok(!fs.existsSync(path.join(root,'node_modules/node_modules')));
});

test('legacy docs are stored separately, not scattered at program root',()=>{
 const files=fs.readdirSync(root);
 assert.ok(files.every(name=>!/^LEEME|^LEER_ANTES|^README\.md$|^CHANGELOG\.md$/.test(name)),files.join(','));
 for(const doc of ['docs/README.md','docs/CHANGELOG.md','docs/GUIA_VERSION_1_9_ES.md','docs/ESTADO_VALIDACION_V1_9_ES.md']){
   assert.ok(fs.statSync(path.join(root,doc)).size>200,doc);
 }
 assert.ok(fs.existsSync(path.join(root,'docs/Historial/LEEME_HF1.txt')));
});
