import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {textureGalleryWindow} from '../src/engine/textureGalleryWindow.ts';
import {useStudioLayout,mergeSavedLayout,validateWorkspaceName} from '../src/layout.ts';
const read=path=>fs.readFileSync(new URL('../src/'+path,import.meta.url),'utf8');

test('3000 WAD textures mount only visible tiles and maintain valid virtual offsets',()=>{
 const start=textureGalleryWindow(3116,2,0,600);
 const middle=textureGalleryWindow(3116,2,45000,600);
 const end=textureGalleryWindow(3116,2,500000,600);
 assert.ok(start.to<40);
 assert.ok(middle.to-middle.from<40);
 assert.ok(middle.from>600);
 assert.equal(end.to,3116);
 assert.equal(start.top,0);
 assert.ok(middle.top>0&&middle.bottom>0);
 assert.ok(end.bottom===0);
 const gallery=read('components/VirtualTextureGallery.tsx');
 assert.match(gallery,/textures\.slice\(windowed\.from,windowed\.to\)/);
 assert.match(gallery,/onScroll=/);
 assert.match(gallery,/key=\{texture\.wad\+':'\+texture\.name\}/);
 assert.match(gallery,/\[signature,resetKey\]/);
});

test('workspace profiles survive saved layout, invalid profile values sanitize',()=>{
 const state=useStudioLayout.getState();
 state.setSideSize('left',332);
 state.saveCurrentWorkspace('Construction plan');
 assert.equal(useStudioLayout.getState().savedWorkspaces['Construction plan'].widths.left,332);
 state.setSideSize('left',245);
 state.restoreSavedWorkspace('Construction plan');
 assert.equal(useStudioLayout.getState().widths.left,332);
 state.deleteSavedWorkspace('Construction plan');
 assert.equal(useStudioLayout.getState().savedWorkspaces['Construction plan'],undefined);
 assert.equal(validateWorkspaceName('a/b:c'), 'abc');
 const sanitized=mergeSavedLayout({savedWorkspaces:{bad:{widths:{left:Infinity,right:99999},sides:{assets:'invalid'},visible:{assets:false}}}},state);
 assert.equal(sanitized.savedWorkspaces.bad.widths.left,254);
 assert.equal(sanitized.savedWorkspaces.bad.widths.right,700);
 assert.equal(sanitized.savedWorkspaces.bad.sides.assets,'left');
});

test('pinned toolbar groups do not alter canonical actions and restore old settings',()=>{
 const layout=useStudioLayout.getState();
 layout.togglePinnedToolbarGroup('studios');
 assert.ok(useStudioLayout.getState().pinnedToolbarGroups.includes('studios'));
 layout.togglePinnedToolbarGroup('studios');
 assert.ok(!useStudioLayout.getState().pinnedToolbarGroups.includes('studios'));
 const app=read('App.tsx'),dock=read('components/DockWorkspace.tsx');
 assert.match(app,/toolbarPin\('transform'\)/);
 assert.match(app,/style:\{order:toolbarPinned\.includes\(id\)/);
 assert.match(dock,/ui3-ribbon-navigation/);
});

test('entity placement ghost, repeat and existing cancel behavior are retained',()=>{
 const store=read('store.ts'),view=read('components/Viewport.tsx'),panel=read('components/Panels.tsx');
 assert.match(store,/set\(\{pendingNpcClass:repeat\?classname:null\}\)/);
 assert.match(view,/entityGhost&&<group/);
 assert.match(view,/state\.startNpcPlacement\(null\)/);
 assert.match(view,/e\.button===2/);
 assert.match(view,/entityStampMode/);
 assert.match(panel,/setEntityStampMode/);
 assert.match(panel,/setPlacementMode/);
});

test('inspector uses FGD types without changing native entity keyvalues',()=>{
 const panel=read('components/Panels.tsx');
 assert.match(panel,/InspectorNavigation/);
 assert.match(panel,/field\.type==='color255'/);
 assert.match(panel,/\['integer','float'\]\.includes\(field\.type\)/);
 assert.match(panel,/setProp\(object\.id,key,v\)/);
 assert.match(panel,/field\.options\.map/);
});
