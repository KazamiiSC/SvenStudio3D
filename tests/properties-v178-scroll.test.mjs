import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const code=readFileSync(new URL('../src/components/Panels.tsx',import.meta.url),'utf8');
const rules=css.slice(css.indexOf('/* v1.7.10 — One grid'));
test('v1.7.10 uses the dock body as the single grid to prevent nested height mismatch',()=>{
 assert.match(rules,/\.dock-pane\[data-pane="properties"\]>\.dock-pane-body\s*\{[^}]*display:grid!important/s);
 assert.match(rules,/grid-template-rows:max-content minmax\(0,1fr\)!important/);
 assert.match(rules,/\.dock-pane\[data-pane="properties"\]>\.dock-pane-body>\.properties\s*\{[^}]*display:contents!important/s);
 assert.doesNotMatch(rules,/position:absolute!important/);
});
test('selected object resets the sole scroll region',()=>assert.match(code,/querySelector\('\.property-scroll'\)/));
