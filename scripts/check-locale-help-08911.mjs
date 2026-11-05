/** v0.8.9.11 — Language detection, persisted overrides and Help translations. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

function loadTs(path, deps = {}, globals = {}) {
  const source = fs.readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}}).outputText;
  const mod = {exports:{}};
  const context = {module:mod,exports:mod.exports,require:(name)=>{assert.ok(name in deps,`${path}: unexpected import ${name}`);return deps[name]},...globals};
  vm.runInNewContext(output,context,{filename:path});
  return mod.exports;
}

const storage=new Map();
const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
const nav={language:'en-US',languages:['en-US']};
const localeApi=loadTs('src/i18n.ts',{'react':{useCallback:f=>f},'./store':{}}, {navigator:nav,localStorage});
const {detectSystemLocale,systemLocale,preferredLocale,readLocalePreference,saveLocalePreference}=localeApi;

for(const [tags,want] of [
  [['es-AR','en-US'],'es'],[['ru-RU'],'ru'],[['ko-KR'],'ko'],[['en-GB'],'en'],
  [['pt-BR'],'en'],[['fr-FR','ko-KR'],'ko'],[['ja-JP','de-DE'],'en'],
  [[], 'en'],[['ES_AR'],'es'],[[' EN-us '],'en']
]) assert.equal(detectSystemLocale(tags),want);
assert.equal(readLocalePreference(),'auto');
for(const [language,want] of [['es-AR','es'],['en-US','en'],['ru-RU','ru'],['ko-KR','ko'],['pt-BR','en']]){
  nav.languages=[language];nav.language=language;
  assert.equal(systemLocale(),want);
  assert.equal(preferredLocale(),want);
}
nav.languages=['ko-KR'];
saveLocalePreference('ru');
assert.equal(readLocalePreference(),'ru');
assert.equal(preferredLocale(),'ru','manual selection must override system language');
saveLocalePreference('auto');
assert.equal(readLocalePreference(),'auto');
assert.equal(preferredLocale(),'ko','auto must honor system again');
for(const bad of ['','pt','auto','ja']){
  storage.set('svenstudio-locale',bad);
  assert.equal(readLocalePreference(),'auto');
}
storage.clear();

const tApi=localeApi;
const translate=tApi.translate;
const source=fs.readFileSync('src/App.tsx','utf8');
const pairs=[...source.matchAll(/\['(Quick start|Camera and views|Building geometry|Advanced modeling|Texture browser|Entity browser and FGD|Groups, layers and prefabs|Lighting and sky|Saving and compiling|Automatic recovery|Map Doctor and errors|Large map performance|Useful shortcuts)','(Help [^']+)'\]/g)];
assert.equal(pairs.length,13,'Help should expose all 13 sections');
const keys=['Sven Studio guide','Help introduction','Editor summary','Help summary','Project credits','This project was made with the help of GPT-6 Astra.','Automatic (system language)',...pairs.flatMap(p=>[p[1],p[2]])];
for (const lang of ['en','es','ru','ko']){
  for(const key of keys){
    const value=translate(lang,key);
    assert.ok(typeof value==='string' && value.trim().length>0,`empty ${lang}: ${key}`);
    assert.ok(!/^Help\s(?:quick|camera|geometry|advanced|textures|entities|organization|lighting|compiling|recovery|diagnosis|performance|shortcuts|summary|introduction)$/.test(value),`untranslated Help placeholder ${lang}: ${key}`);
    if(lang==='en'){
      assert.ok(!/^\d+\.\s/.test(value),`numbering reintroduced ${lang}: ${key}`);
    }
    if(lang!=='en' && key!=='Sven Studio guide' && key!=='Project credits'){
      assert.notEqual(value,key,`missing translation ${lang}: ${key}`);
    }
  }
  console.log(`PASS ${lang.toUpperCase()}: ${keys.length} Help/title/auto translation checks`);
}
assert.ok(!source.includes('{index+1}.'),'Help headings must not be numbered');
assert.ok(source.includes('value={localePreference}') && source.includes('<option value="auto">'),'auto selection missing from UI');

// Audit all direct static translation usages across the source tree.
const staticKeys=new Set();
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=`${dir}/${entry.name}`;
  if(entry.isDirectory())walk(file);
  else if(/\.tsx?$/.test(file) && !file.endsWith('/i18n.ts')){
    const source=fs.readFileSync(file,'utf8');
    for(const m of source.matchAll(/\bt\(\s*(['\"])([^\r\n'\"]{1,220})\1\s*\)/g))staticKeys.add(m[2]);
  }
}}
walk('src');
// Technical engine names remain English intentionally; they are not ordinary UI text.
const technical=new Set(['Targetname','Spawnflags','classname','brushes','color','Gizmo','WAD','FGD']);
for(const lang of ['es','ru','ko']){
  const missing=[...staticKeys].filter(key=>!technical.has(key)&&translate(lang,key)===key);
  assert.deepEqual(missing,[],`${lang}: untranslated direct UI strings`);
  console.log(`PASS ${lang.toUpperCase()}: ${staticKeys.size} direct translation keys reviewed; technical names preserved`);
}
console.log('PASS language detection: English fallback, ES/RU/KO system, saved override, Auto reset');

