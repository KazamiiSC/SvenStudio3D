import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {useStudioLayout,mergeSavedLayout,REDESIGNED_TOOLBAR_ORDER,TOOLBAR_GROUPS} from '../src/layout.ts';

const root = new URL('../', import.meta.url);
const source = filename => readFileSync(new URL(filename,root),'utf8');

// The light appearance was retired (see ui-preview2-consolidation): the editor is dark-only,
// visual variety comes from accents and the six interface themes.
test('dark theme is the default and accents work without changing geometry',()=>{
  const editor = useStudioLayout.getState();
  editor.resetLayout();
  assert.equal(useStudioLayout.getState().appearance,'dark');
  editor.setAccent('ice');
  assert.equal(useStudioLayout.getState().appearance,'dark');
  assert.equal(useStudioLayout.getState().accent,'ice');
});

test('appearance survives presets and layout reset',()=>{
  const editor = useStudioLayout.getState();
  editor.usePreset('classic');
  assert.equal(useStudioLayout.getState().appearance,'dark');
  editor.usePreset('organized');
  assert.equal(useStudioLayout.getState().appearance,'dark');
  editor.resetLayout();
  assert.equal(useStudioLayout.getState().appearance,'dark');
});

test('legacy settings hydrate safely and keep a manual toolbar ordering',()=>{
  const current = useStudioLayout.getState();
  assert.equal(mergeSavedLayout({appearance:'light'},current).appearance,'dark');
  assert.equal(mergeSavedLayout({appearance:'hacked'},current).appearance,'dark');
  assert.deepEqual(mergeSavedLayout({toolbarGroups:[...TOOLBAR_GROUPS]},current).toolbarGroups,REDESIGNED_TOOLBAR_ORDER);
  const custom=['studios','view','transform','tools','grid','geometry','edit'];
  assert.deepEqual(mergeSavedLayout({toolbarGroups:custom},current).toolbarGroups,['studios','view','transform','tools','grid','geometry','modeling','textures','edit'],'v2.4 groups land next to Geometry');
  assert.deepEqual(mergeSavedLayout({toolbarGroups:null},current).toolbarGroups,REDESIGNED_TOOLBAR_ORDER);
});

test('appearance UI supports all editor languages without replacing existing tools',()=>{
  const modal=source('src/components/DockWorkspace.tsx');
  const app=source('src/App.tsx');
  for(const lang of ['es','en','ru','ko','zh','pt'])assert.match(modal,new RegExp(`\\b${lang}:\\{title:`));
  for(const id of ['transform','edit','view','geometry','tools','grid','studios'])assert.match(app,new RegExp(`toolbarGroupProps\\('${id}'\\)`));
  assert.doesNotMatch(modal,/setAppearance\('light'\)/);
  assert.match(app,/appearance-\$\{appearance\}/);
});
