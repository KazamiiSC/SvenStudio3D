const {withSplitParts}=require('./support/splitParts.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('v1.9 uses a single, consistent public version',()=>{
 const pkg=JSON.parse(read('package.json'));
 const lock=JSON.parse(read('package-lock.json'));
 const label=`v${pkg.version.split('.').slice(0,2).join('.')}`;
 assert.equal(lock.version,pkg.version);
 assert.equal(lock.packages[''].version,pkg.version);
 const app=withSplitParts(read('src/App.tsx'),'App');
 assert.ok(app.includes(`SvenStudio 3D ${label}<`));
 assert.ok(app.includes(`className="version-label">${label}<`));
 assert.match(app,/guide.*releaseGuide|releaseGuide\(locale\)/s);
 assert.ok(read('SvenStudio3D.bat').includes(`SvenStudio 3D ${label}`));
});

test('Help includes updated core features and is navigable',()=>{
 const app=withSplitParts(read('src/App.tsx'),'App');
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
   assert.ok(guide.title.includes(`v${JSON.parse(read('package.json')).version.split('.').slice(0,2).join('.')}`),lang);
   assert.ok(guide.intro.length>40,lang);
   assert.ok(guide.cards.length>=6,lang); // the release guide grows with each version
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
 // v2.3 layout: only README.md and the first-install note live at the root; everything else in docs/.
 const rootDocs=files.filter(name=>/\.(md|txt)$/i.test(name));
 assert.deepEqual(rootDocs.sort(),['LEEME_PRIMERA_INSTALACION_WINDOWS.md','README.md'],files.join(','));
 assert.ok(fs.statSync(path.join(root,'docs/V2_3_RELEASE_AND_AUDIT.md')).size>200);
});
