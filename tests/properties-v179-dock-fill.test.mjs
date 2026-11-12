import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/Panels.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const {version}=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const r=css.slice(css.indexOf('/* v1.7.10 — One grid'));
test('Properties scroller stretches in the single grid, including horizontal docks',()=>{
 assert.match(r,/\.properties>\.property-scroll\s*\{[^}]*grid-row:2!important;[^}]*align-self:stretch!important;[^}]*height:auto!important;[^}]*overflow-y:auto!important/s);
 assert.match(r,/data-dock-side="bottom"\] \.properties>\.property-scroll/s);
});
test('No nested scroll; header is row one and scroll region row two',()=>{
 assert.match(r,/\.properties>\.panel-header\s*\{[^}]*grid-row:1!important/s);
 assert.match(r,/\.properties>\.property-scroll\s*\{[^}]*grid-row:2!important/s);
 assert.match(panel,/querySelector\('\.property-scroll'\)/);
});
test('Version can be verified in the application rather than relying on a stale label',()=>{
 assert.ok(app.includes(`SvenStudio 3D v${version}`));
 assert.doesNotMatch(app,/SvenStudio 3D v1\.7\.8/);
});
