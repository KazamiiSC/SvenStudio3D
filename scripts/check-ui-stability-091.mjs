import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import {createRequire} from 'node:module';
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('src/App.tsx');
const rail=read('src/components/QuickToolRail.tsx');
const explorer=read('src/components/ExplorerOrganized.tsx');
const assets=read('src/components/Panels.tsx');
const layout=read('src/components/DockWorkspace.tsx');
const build=read('src/components/ArchitectureBuilder.tsx');
const i18n=read('src/i18n.ts');
const version=JSON.parse(read('package.json')).version;
assert.ok(['0.9.1','0.9.2','0.9.3','0.9.4','0.9.5','1.0.0-rc.1','1.0.0'].includes(version));
assert.ok(app.includes(version==='1.0.0-rc.1'?'v1.0.0 RC1':`v${version}`));
assert.ok(!app.includes('v0.8.10.4'));
for(const mode of ['translate','rotate','scale'])assert.ok(app.includes(`onClick={()=>activateGizmoMode('${mode}')}`),`classic ${mode} must match floating rail`);
assert.ok(rail.includes('editor.activateGizmoMode(mode)'));
assert.ok(rail.includes("editor.setGeometryMode('object');editor.setMode('select')"));
const guard=app.indexOf("if(document.querySelector('.modal-backdrop')){");
const ctrlDuplicate=app.indexOf("e.key.toLowerCase()==='d'");
const ctrlUndo=app.indexOf("e.key.toLowerCase()==='z'");
assert.ok(guard>0&&guard<ctrlDuplicate&&guard<ctrlUndo,'modal must block map-transform hotkeys');
assert.match(app,/e\.code==='KeyS'[\s\S]*saveProject\(useEditor\.getState\(\)\.project\);return;/);
for(const picker of ['projectInput','mapInput','bspInput'])assert.ok(app.includes(`setFileMenu(false);${picker}.current?.click()`),`${picker} must close dropdown when picker is canceled`);
assert.ok(rail.includes('requestRouteFocus(type=>document.dispatchEvent(new Event(type)))'));
assert.ok(explorer.includes("id={key==='routes'?'sven-ai-routes-tree':undefined}"));
assert.ok(explorer.includes('consumeRouteFocus()'));
assert.ok(explorer.includes("setCollapsed(previous=>({...previous,routes:false}))"));
assert.ok(explorer.includes("setQuery('')"));
assert.ok(assets.includes("useEffect(()=>{setQuery('');setTexturePage(1);},[resource]);"));
assert.ok(assets.includes("FGD import failed (${file.name})"));
assert.ok(assets.includes("finally{e.target.value='';}"));
assert.ok(layout.includes('layout.compactTools===false?<>'),'docking options visible only for classic toolbar');
assert.ok(layout.includes('Move floating tools with Edit HUD. Toolbar docking applies to Classic ribbon only.'));
assert.ok(build.includes('disabled={!canUnmerge}'));
assert.ok(!rail.includes("menu==='modeling'?'Advanced Building Studio'"));
assert.ok(rail.includes("{id!=='console'&&<span>{layout.visible[id]?'✓':'+'}</span>}"));
for(const language of ['es','ru','ko']){
  const marker=`const ${language}:Record<string,string>={`;
  assert.ok(i18n.indexOf(marker)>=0);
  const block=i18n.slice(i18n.indexOf(marker));
  assert.ok(block.includes("'Move floating tools with Edit HUD. Toolbar docking applies to Classic ribbon only.'"));
}
// One-shot navigation works whether the Explorer already exists or mounts later.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-ui-091-'));
try{
  const nav=ts.transpileModule(read('src/engine/uiNavigation.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  fs.writeFileSync(path.join(tmp,'ui.cjs'),nav);
  const {requestRouteFocus,consumeRouteFocus}=createRequire(path.join(tmp,'test.cjs'))('./ui.cjs');
  let events=[];
  requestRouteFocus(type=>events.push(type));
  assert.deepEqual(events,['svenstudio:focus-routes']);
  assert.equal(consumeRouteFocus(),true);
  assert.equal(consumeRouteFocus(),false);
  requestRouteFocus(type=>events.push(type));
  assert.equal(consumeRouteFocus(),true);
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
// AST scan of all TSX button controls. Drag-only HUD handles are legitimate.
let buttonCount=0,dragButtons=0;
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):/\.tsx$/i.test(e.name)?[path.join(dir,e.name)]:[])}
for(const file of walk(path.join(root,'src'))){
  const source=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const traverse=n=>{
    if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
      if(n.tagName.getText(sf)==='button'){
        buttonCount++;
        const props=n.attributes.properties;
        const has=name=>props.some(p=>p.name?.getText(sf)===name);
        assert.ok(has('onClick')||has('onPointerDown')||has('type')&&has('onMouseDown'),`Button with no action: ${file}:${sf.getLineAndCharacterOfPosition(n.pos).line+1}`);
        if(!has('onClick'))dragButtons++;
      }
    }
    ts.forEachChild(n,traverse);
  };traverse(sf);
}
assert.ok(buttonCount>=265);
assert.equal(dragButtons,2,'HUD move+resize handles have pointer drag handlers instead of onClick');
console.log(`PASS v0.9.1 UI stability: ${buttonCount} buttons audited, ${dragButtons} drag-only HUD controls; route focus, safe keyboard, classic gizmo, file pickers, dock controls, library search, 4 locales`);
