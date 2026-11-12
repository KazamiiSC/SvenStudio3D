/* UI-only regression checks: workspace/hud persistence and toolbar order. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const cache=new Map();globalThis.localStorage={getItem:key=>cache.get(key)??null,setItem:(key,val)=>cache.set(key,String(val)),removeItem:key=>cache.delete(key)};
function loadTs(relative){
  const file=path.join(root,relative),code=fs.readFileSync(file,'utf8');
  const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mod={exports:{}};new Function('require','module','exports',js)(createRequire(file),mod,mod.exports);return mod.exports;
}
let checks=0;const ok=(name,test)=>{test();checks++;console.log('PASS',name)};
const layout=loadTs('src/layout.ts');
ok('normalizes old saved toolbar configurations',()=>{
  assert.deepEqual(layout.normalizeToolbarGroups(['grid','grid','invalid']),['grid','transform','view','geometry','tools','edit','studios']);
});
ok('reorders sections with stable IDs and no duplicates',()=>{
  const next=layout.moveToolbarGroup(layout.TOOLBAR_GROUPS,'studios','view');
  assert.equal(next[1],'studios');assert.equal(new Set(next).size,layout.TOOLBAR_GROUPS.length);
  assert.deepEqual(layout.moveToolbarGroup(next,'view','view'),next);
});
ok('panel docks and toolbar sections save only layout state',()=>{
  const store=layout.useStudioLayout;
  const initial=store.getState();store.getState().movePanel('assets','top');
  assert.equal(store.getState().sides.assets,'top');
  store.getState().reorderToolbarGroup('grid','transform');
  assert.equal(store.getState().toolbarGroups[0],'grid');
  store.getState().stepToolbarGroup('grid',1);
  assert.equal(store.getState().toolbarGroups[1],'grid');
  store.getState().resetLayout();assert.deepEqual(store.getState().sides,initial.sides);
});
const hud=loadTs('src/hudLayout.ts');
ok('Shapes widget exists in default HUD without affecting old saved items',()=>{
  assert.ok(hud.HUD_IDS.includes('shapes'));
  assert.ok(hud.DEFAULT_HUD.shapes.visible);
  assert.equal(hud.normalizeHudItem({x:14,y:13,scale:1,opacity:1,visible:true},hud.DEFAULT_HUD.status).x,14);
  assert.deepEqual(hud.normalizeHudItem(undefined,hud.DEFAULT_HUD.shapes),hud.DEFAULT_HUD.shapes);
  assert.ok(fs.readFileSync(path.join(root,'src/hudLayout.ts'),'utf8').includes('HUD_IDS.map(id=>[id,normalizeHudItem(old?.items?.[id],DEFAULT_HUD[id])]'));
});
ok('HUD, Shapes, and classic toolbar remain separate from map data',()=>{
  const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
  const viewport=fs.readFileSync(path.join(root,'src/components/Viewport.tsx'),'utf8');
  const shape=fs.readFileSync(path.join(root,'src/components/ShapePalette.tsx'),'utf8');
  assert.ok(viewport.includes('<HudWidget id="shapes"><ShapePalette/></HudWidget>'));
  assert.ok(shape.includes('svenstudio:toggle-shapes'));
  assert.ok(app.includes("toolbarGroupProps('studios')"));
  assert.ok(app.includes('Map Packager Studio'));
});
ok('dock CSS supplies adaptive scroll and narrow container rules',()=>{
  const css=fs.readFileSync(path.join(root,'src/style.css'),'utf8');
  assert.ok(css.includes('@container (max-width:300px)'));
  assert.ok(css.includes('.dock-pane{container-type:inline-size}'));
  assert.ok(css.includes('.shape-palette-above'));
  assert.ok(css.includes('.layout-toolbar-sections'));
});
console.log(`Layout Preview 6 ${checks}/${checks} PASS`);
