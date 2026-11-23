import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
const base=new URL('../',import.meta.url);
const get=f=>readFileSync(new URL(f,base),'utf8');
const meta=JSON.parse(get('package.json'));
test('release metadata, BAT, help and status agree on the current version',()=>{
 const label=`v${meta.version.split('.').slice(0,2).join('.')}`;
 assert.equal(JSON.parse(get('package-lock.json')).version,meta.version);
 for(const f of ['src/App.tsx','SvenStudio3D.bat'])assert.ok(get(f).includes(label),f);
});
test('help describes real SC/SDHLT True Lighting and exit keys',()=>{
 for(const key of ['SC-RAD','SDHLT','WASD','F8'])assert.ok(get('src/engine/editorManual.ts').includes(key));
 // v2.3 flattened docs/ (see README §14); per-language True Lighting guides were merged into the in-app help.
});
test('default editor shortcuts keep G/R/C and do not assign Ctrl+D',()=>{
 const src=get('src/engine/controls.ts');
 for(const key of ["move:'KeyG'","rotate:'KeyR'","scale:'KeyC'"])assert.ok(src.includes(key));
 assert.ok(!src.includes("duplicate:'Ctrl+KeyD'"));
});
test('BuildTogether revision selector and historic files organized',()=>{
 assert.match(get('src/components/BuildTogether.tsx'),/revision:s\.revision/);
 assert.ok(readdirSync(new URL('docs/',base)).filter(n=>/\.md$/i.test(n)).length>=20,'historic technical notes kept in docs/');
});
