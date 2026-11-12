import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {useStudioLayout,mergeSavedLayout,REDESIGNED_TOOLBAR_ORDER,TOOLBAR_GROUPS} from '../src/layout.ts';

const root = new URL('../', import.meta.url);
const source = filename => readFileSync(new URL(filename,root),'utf8');

test('dark theme is the default and both theme modes work without changing geometry',()=>{
  const editor = useStudioLayout.getState();
  editor.resetLayout();
  assert.equal(useStudioLayout.getState().appearance,'dark');
  editor.setAppearance('light');
  assert.equal(useStudioLayout.getState().appearance,'light');
  editor.setAccent('ice');
  assert.equal(useStudioLayout.getState().appearance,'light');
  assert.equal(useStudioLayout.getState().accent,'ice');
  editor.setAppearance('dark');
  assert.equal(useStudioLayout.getState().appearance,'dark');
});

test('saved appearance survives presets and layout reset',()=>{
  const editor = useStudioLayout.getState();
  editor.setAppearance('light');
  editor.usePreset('classic');
  assert.equal(useStudioLayout.getState().appearance,'light');
  editor.usePreset('organized');
  assert.equal(useStudioLayout.getState().appearance,'light');
  editor.resetLayout();
  assert.equal(useStudioLayout.getState().appearance,'light');
  editor.setAppearance('dark');
});

test('legacy settings hydrate safely and keep a manual toolbar ordering',()=>{
  const current = useStudioLayout.getState();
  assert.equal(mergeSavedLayout({appearance:'light'},current).appearance,'light');
  assert.equal(mergeSavedLayout({appearance:'hacked'},current).appearance,'dark');
  assert.deepEqual(mergeSavedLayout({toolbarGroups:[...TOOLBAR_GROUPS]},current).toolbarGroups,REDESIGNED_TOOLBAR_ORDER);
  const custom=['studios','view','transform','tools','grid','geometry','edit'];
  assert.deepEqual(mergeSavedLayout({toolbarGroups:custom},current).toolbarGroups,custom);
  assert.deepEqual(mergeSavedLayout({toolbarGroups:null},current).toolbarGroups,REDESIGNED_TOOLBAR_ORDER);
});

test('appearance UI supports all editor languages without replacing existing tools',()=>{
  const modal=source('src/components/DockWorkspace.tsx');
  const app=source('src/App.tsx');
  const css=source('src/style.css');
  for(const lang of ['es','en','ru','ko','zh','pt'])assert.match(modal,new RegExp(`\\b${lang}:\\{title:`));
  for(const id of ['transform','edit','view','geometry','tools','grid','studios'])assert.match(app,new RegExp(`toolbarGroupProps\\('${id}'\\)`));
  assert.match(modal,/setAppearance\('light'\)/);
  assert.match(modal,/setAppearance\('dark'\)/);
  assert.match(app,/appearance-\$\{appearance\}/);
  assert.match(css,/\.app-shell\.appearance-light \.studio-body \.dock-workspace/);
  assert.match(css,/\.app-shell\.appearance-light \.titlebar/);
  assert.match(css,/\.app-shell\.appearance-light \.statusbar/);
});
