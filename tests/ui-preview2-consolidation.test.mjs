import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {useStudioLayout,mergeSavedLayout} from '../src/layout.ts';
import {guideForClass} from '../src/engine/entityGuide.ts';
const read=name=>fs.readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8');

test('appearance is dark-only, including older saved light values',()=>{
 const editor=useStudioLayout.getState();
 assert.equal(mergeSavedLayout({appearance:'light'},editor).appearance,'dark');
 editor.setAppearance('dark');
 assert.equal(useStudioLayout.getState().appearance,'dark');
 const modal=read('components/DockWorkspace.tsx');
 assert.doesNotMatch(modal,/onClick=\{\(\)=>layout\.setAppearance\('light'\)\}/);
 const app=read('App.tsx');
 assert.equal((app.match(/setDialog\('layout'\)/g)||[]).length,1,'one appearance icon entry point');
});

test('studio menu has prefab first and no duplicate events/puzzle entries',()=>{
 const app=read('App.tsx');
 const start=app.indexOf('<TopDropdown anchor={studiosButton}');
 const end=app.indexOf('</TopDropdown>',start);
 const menu=app.slice(start,end);
 assert.ok(menu.indexOf("setDialog('prefabs')")<menu.indexOf("setDialog('blueprint')"));
 assert.ok(menu.indexOf("setDialog('prefabs')")<menu.indexOf("setDialog('mission')"));
 assert.doesNotMatch(menu,/setDialog\('events'\)|setDialog\('puzzle'\)/);
 const missions=read('components/MissionEventsStudio.tsx');
 assert.match(missions,/switchMode\('events'\)/);
 assert.match(missions,/onOpenPuzzle/);
});

test('output is only a navigation item beneath advanced in build config',()=>{
 const app=read('App.tsx');
 const settings=read('components/SmartBuildSettingsModal.tsx');
 assert.ok(settings.indexOf("['advanced',Settings2,words.advanced]")<settings.indexOf('className="sb-output-nav"'));
 assert.match(settings,/onClick=\{onOpenOutput\}/);
 assert.doesNotMatch(app,/setDialog\('output'\);setWorkspaceMenu/);
});

test('WAD texture selection never updates recent-first sort or changes tile order',()=>{
 const panel=read('components/Panels.tsx');
 assert.match(panel,/\.sort\(\(a,b\)=>a\.name\.localeCompare\(b\.name\)/);
 assert.doesNotMatch(panel,/setRecent\(/);
 assert.match(read('components/VirtualTextureGallery.tsx'),/key=\{texture\.wad\+':'\+texture\.name\}/);
});

test('entity list arms placement for point entities and supports right click cancellation',()=>{
 const panel=read('components/Panels.tsx');
 const viewport=read('components/Viewport.tsx');
 assert.match(panel,/cls\.type==='point'\?startNpc\(/);
 assert.match(viewport,/if\(e\.button===2\)\{e\.preventDefault\(\)/);
 assert.match(viewport,/state\.startNpcPlacement\(null\)/);
 assert.match(viewport,/state\.placePendingNpc\(at,useStudioLayout\.getState\(\)\.entityStampMode\)/);
 assert.doesNotMatch(panel,/onClick=\{\(\)=>addEntity\(cls\)\}/);
});

test('library does not expose layers tab and expanded entity guide uses FGD',()=>{
 const panel=read('components/Panels.tsx');
 const guide=read('components/EntityAssistant.tsx');
 assert.doesNotMatch(panel,/setResource\('layers'\)/);
 assert.match(guide,/Object\.entries\(definition\.props\)/);
 assert.match(guide,/f\.defaultValue/);
 assert.match(guide,/f\.options/);
 const g=guideForClass('info_target');
 assert.match(g.example,/trigger_camera|mira_camara/);
 const unknown=guideForClass('custom_thing',{name:'custom_thing',type:'point',description:'Custom test',props:{target:{label:'Target',type:'string'},targetname:{label:'Name',type:'string'}}});
 assert.match(unknown.example,/targetname/);
});
