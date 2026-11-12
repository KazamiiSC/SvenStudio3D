const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {useEditor,demoProject}=require('../src/store.ts');
const source=fs.readFileSync(require.resolve('../src/components/Viewport.tsx'),'utf8');
const ui=fs.readFileSync(require.resolve('../src/components/UniversalPlacementPanel.tsx'),'utf8');
const css=fs.readFileSync(require.resolve('../src/style.css'),'utf8');
test('all placement modes can be atomically cancelled without touching geometry or history',()=>{
  const state=useEditor.getState();state.loadProject(demoProject());
  const map=JSON.stringify(useEditor.getState().project);
  const history=useEditor.getState().history.length;
  const activeFields=['placementShape','placementPrefabId','terrainPlacement','blueprintPlacementId','audioPlacement','environmentPlacement','pendingNpcClass','routePlacementFor','cinematicPlacementFor','drawMode'];
  const values={placementShape:'box',placementPrefabId:'prefab-test',terrainPlacement:{kind:'terrain'},blueprintPlacementId:'plan-test',audioPlacement:{classname:'ambient_generic'},environmentPlacement:{kind:'light'},pendingNpcClass:'monster_scientist',routePlacementFor:'npc-test',cinematicPlacementFor:'cam-test',drawMode:true};
  for(const field of activeFields){
    useEditor.setState({[field]:values[field],universalPlacementHover:[40,50,60]});
    assert.equal(useEditor.getState().hasPendingPlacement(),true,`${field} should arm placement`);
    useEditor.getState().cancelPendingPlacement();
    for(const key of activeFields)assert.ok(!useEditor.getState()[key],`${key} should cancel`);
    assert.equal(useEditor.getState().universalPlacementHover,null);
    assert.equal(JSON.stringify(useEditor.getState().project),map);
    assert.equal(useEditor.getState().history.length,history);
  }
  assert.equal(useEditor.getState().hasPendingPlacement(),false);
});
test('viewport includes right-click and Escape universal cancellation before camera',()=>{
  assert.match(source,/onPointerDownCapture=\{e=>\{[\s\S]*?e\.button!==2[\s\S]*?hasPendingPlacement\(\)[\s\S]*?cancelPendingPlacement\(\)/);
  assert.match(source,/window\.addEventListener\('keydown',onEscape,true\)/);
  assert.match(source,/onDoubleClickCapture=/);
});
test('ghost survives panel crossings and horizontal ray intersection failure',()=>{
  assert.match(source,/if\(!floor\)\{/);
  assert.match(source,/groundPoint\.y=settings\.planeZ/);
  assert.doesNotMatch(source,/universal-placement-z-handle"/);
  assert.match(source,/Keep the last valid ghost while crossing overlays/);
  assert.match(source,/settings\.lockPosition\|\|settings\.mode==='free'\?anchor:snapPosition\(anchor\)/);
});
test('placement panel is compact and selected DOM text cannot be dragged in viewport',()=>{
  assert.match(ui,/universal-placement-three-modes/);
  assert.match(ui,/onClick=\{cancel\}/);
  assert.match(ui,/Right click or Esc to cancel/);
  assert.match(css,/\.viewport-frame\.is-universal-placing/);
  assert.match(css,/user-select:none/);
  for(const file of ['Viewport.tsx','UniversalPlacementPanel.tsx']){
    const ast=ts.createSourceFile(file,fs.readFileSync(require.resolve('../src/components/'+file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    assert.equal(ast.parseDiagnostics.length,0);
  }
});
