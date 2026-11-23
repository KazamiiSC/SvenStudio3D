import {withSplitParts} from './support/splitParts.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('v2.3 uses one GoldSrc home with a shared hero, no profile filtering',()=>{
 const home=read('src/components/WelcomeScreen.tsx');
 assert.match(home,/copy\.tagline/);assert.match(home,/copy\.description/);
 assert.doesNotMatch(home,/cs16\s*\?\s*'GOLDSRC MAPPING/);
 assert.doesNotMatch(home,/tools\.filter\(/);
 assert.match(home,/homeRef\(locale\)/);assert.match(home,/ssr-stage/);
});
test('all home cards are real buttons with action routes',()=>{
 const home=read('src/components/WelcomeScreen.tsx');const app=withSplitParts(read('src/App.tsx'),'App');
 assert.match(home,/className=\{`ssr-tool /);
 assert.match(home,/onClick=\{\(\)=>openTool\(id\)\}/);
 assert.match(app,/handleHomeAction=\(action:HomeAction\)/);
 for(const action of ['new','open','import','settings','editor','csMap','bspViewer','bspEditor','world','connect','texture','decals','sound','prefabs','doctor','together','build','resources','help','appearance'])assert.match(app,new RegExp(`case '${action}'`));
});
test('localized copy is provided for six profiles and headings are consistent',()=>{
 const copy=read('src/engine/homeRef.ts');
 for(const id of ['es','en','ru','ko','zh','pt'])assert.match(copy,new RegExp(`const ${id}:HomeRefCopy`));
 assert.match(copy,/GOLDSRC MAPPING FOR SVEN CO-OP & COUNTER-STRIKE 1\.6/);
 assert.match(copy,/MAPAS GOLDSRC PARA SVEN CO-OP Y COUNTER-STRIKE 1\.6/);
});
test('v2.3 help covers both games and preserves differences',()=>{
 const help=read('src/engine/helpV23.ts');const app=withSplitParts(read('src/App.tsx'),'App');
 assert.match(help,/SC-CSG/);assert.match(help,/ZHLT/);assert.match(help,/HF33 HF1/);
 assert.match(app,/id="manual-v23"/);
 assert.match(app,/id="manual-v21"/);
});
test('version and offline portable launcher labels are updated',()=>{
 assert.match(read('package.json'),/"version": "2\.5\.0"/); // v2.5
 assert.match(withSplitParts(read('src/App.tsx'),'App'),/<span className="version-label">v2\.5/);
 assert.match(read('SvenStudio3D.bat'),/title SvenStudio 3D v2\.5/);
 assert.match(read('LEEME_PRIMERA_INSTALACION_WINDOWS.md'),/runtime\/node\.exe/);
});

test('approved dashboard matches the chosen composition with working controls and real history',()=>{
 const home=read('src/components/WelcomeScreen.tsx');const app=withSplitParts(read('src/App.tsx'),'App');
 for(const name of ['ssr-quick','ssr-recent','ssr-profile','ssr-abilities','ssr-tools','ssr-cta','ssr-help','ssr-appearance','ssr-community'])assert.match(home,new RegExp(name));
 assert.match(home,/listProjectHistory\(\)/);assert.match(home,/openHistoryCheckpoint\(entry.id\)/);
 assert.match(home,/onRestoreProject\(\(await openHistoryCheckpoint/);
 assert.match(home,/switchProfile\('svengine'\)/);assert.match(home,/switchProfile\('cs16'\)/);
 assert.match(home,/onAction\('settings'\)/);assert.match(app,/case 'history'/);
 assert.match(read('src/components/WelcomeScreen.css'),/\.ssr-stage\{position:relative;width:1672px;height:825px/);
});
