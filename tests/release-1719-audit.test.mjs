import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
const base=new URL('../',import.meta.url);
const get=f=>readFileSync(new URL(f,base),'utf8');
const meta=JSON.parse(get('package.json'));
test('1.7.19 metadata, BAT, help and status agree',()=>{
 assert.equal(meta.version,'1.7.19');
 assert.equal(JSON.parse(get('package-lock.json')).version,meta.version);
 for(const f of ['src/App.tsx','SvenStudio3D.bat'])assert.match(get(f),/v1\.7\.19/);
});
test('help describes real SC/SDHLT True Lighting and exit keys',()=>{
 for(const key of ['SC-RAD','SDHLT','WASD','F8'])assert.ok(get('src/engine/editorManual.ts').includes(key));
 for(const lang of ['es','en','ru','ko','zh','pt'])assert.ok(existsSync(new URL(`docs/guias/TRUE_LIGHTING_${lang}.md`,base)));
});
test('default editor shortcuts keep G/R/C and do not assign Ctrl+D',()=>{
 const src=get('src/engine/controls.ts');
 for(const key of ["move:'KeyG'","rotate:'KeyR'","scale:'KeyC'"])assert.ok(src.includes(key));
 assert.ok(!src.includes("duplicate:'Ctrl+KeyD'"));
});
test('BuildTogether revision selector and historic files organized',()=>{
 assert.match(get('src/components/BuildTogether.tsx'),/revision:s\.revision/);
 assert.ok(readdirSync(new URL('docs/historico/',base)).length>=50);
});
