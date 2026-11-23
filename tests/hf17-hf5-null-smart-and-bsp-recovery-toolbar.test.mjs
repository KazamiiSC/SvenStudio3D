import {legacyI18nSource} from './support/legacyI18n.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isRecoveredBspProject} from '../src/engine/recoveredBspPreview.ts';
import {validateProjectFile} from '../src/engine/projectValidation.ts';
import {exportMap} from '../src/engine/exportMap.ts';

const text=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const blank=(name='test')=>({version:1,target:'svengine',name,world:{classname:'worldspawn',mapversion:'220',wad:''},wadNames:[],objects:[]});

test('HF17 HF5: only recovered BSP maps activate NULL-aware preview; old names still work',()=>{
  assert.equal(isRecoveredBspProject({...blank('Osprey'),recoveredFromBsp:true}),true);
  assert.equal(isRecoveredBspProject(blank('osprey_recovered.map')),true);
  assert.equal(isRecoveredBspProject(blank('osprey_recovered')),true);
  assert.equal(isRecoveredBspProject({...blank('My custom renamed map'),world:{wad:'C:\\maps\\osprey_recovered.wad'}}),true);
  assert.equal(isRecoveredBspProject(blank('ordinary_map')),false);
  assert.equal(isRecoveredBspProject(blank('not_recovered_more')),false);
  assert.equal(isRecoveredBspProject({...blank('unrelated'),world:{wad:'C:\\foo\\mystuff.wad'}}),false);
  assert.equal(isRecoveredBspProject({...blank('ordinary'),recoveredFromBsp:false}),false);
});

test('HF17 HF5: recovered flag survives project JSON but never goes to Valve 220 MAP',()=>{
  const project={...blank('Renamed Osprey'),recoveredFromBsp:true};
  const normalized=validateProjectFile(JSON.parse(JSON.stringify(project)));
  assert.equal(normalized.recoveredFromBsp,true);
  const original=JSON.stringify(normalized);
  assert.doesNotMatch(exportMap(normalized),/recoveredFromBsp/i);
  assert.equal(JSON.stringify(normalized),original);
  assert.throws(()=>validateProjectFile({...project,recoveredFromBsp:'yes'}),/invalid BSP recovery preview flag/i);
});

test('HF17 HF5: BSP→MAP direct open stores provenance but never edits MAP files',()=>{
  const app=text('src/App.tsx');
  assert.match(app,/loadProject\(\{\.\.\.next,recoveredFromBsp:true[,}]/);
  const viewport=text('src/components/Viewport.tsx');
  assert.equal((viewport.match(/useEditor\(s=>isRecoveredBspProject\(s\.project\)\)/g)||[]).length,3);
  assert.match(viewport,/const \[hideRecoveryNull,setHideRecoveryNull\]=useState\(true\)/);
  assert.match(viewport,/if\(recoveredMapKey\)setHideRecoveryNull\(true\)/);
  assert.match(viewport,/visible:false,side:THREE\.DoubleSide/);
  assert.match(viewport,/Hide NULL faces \(improves recovered MAP performance\)/);
});

test('HF17 HF5: recovery CTA is labelled and only rendered in BSP viewer, never BSP editor',()=>{
  const bsp=text('src/components/BspViewer.tsx');
  assert.match(bsp,/\{!entityEdit&&<button type="button" className="bsp-recovery-cta"/);
  assert.match(bsp,/aria-label=\{t\('Recover BSP to MAP'\)\}/);
  assert.match(bsp,/<ShieldCheck size=\{15\}\/><span>\{t\('Recover BSP to MAP'\)\}<\/span><\/button>\}/);
  assert.doesNotMatch(bsp,/<button title=\{t\('BSP Recovery'\)\} disabled=\{!source\|\|entityEdit\}/);
  assert.match(bsp,/setRecoveryOpen\(true\)/);
  const css=text('src/style.css');
  assert.match(css,/\.bsp-toolbar-end \.bsp-recovery-cta span\{display:inline!important/);
  const i18n=legacyI18nSource();
  for(const locale of ['es','ru','ko','zh','pt'])assert.match(i18n,new RegExp(`Object\\.assign\\(${locale},\\{'Recover BSP to MAP':`));
  assert.match(i18n,/Recuperar BSP → MAP/);
});

test('HF17 HF5: diagnostic recommendations distinguish hidden and shown NULL faces',()=>{
  const report=text('src/engine/mapRenderDiagnostics.ts');
  assert.match(report,/b\.nullFaces>=300/);
  assert.match(report,/b\.hiddenNullFaces>0/);
  assert.match(report,/do not|never/i); // report confirms no map/game modifications.
});
