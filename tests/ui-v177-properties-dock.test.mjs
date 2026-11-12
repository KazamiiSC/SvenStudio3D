import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const rule=css.slice(css.indexOf('/* v1.7.10 — One grid'));
test('there is only one vertical scroll in the properties dock',()=>{
 assert.match(rule,/\.dock-pane\[data-pane="properties"\]\s*\{[^}]*overflow:hidden!important/s);
 assert.match(rule,/\.dock-pane\[data-pane="properties"\]>\.dock-pane-body\s*\{[^}]*overflow:hidden!important/s);
 assert.match(rule,/\.properties>\.property-scroll\s*\{[^}]*overflow-y:auto!important/s);
});
test('headers remain fixed while the inspector scrolls and short mode has correct offset',()=>{
 assert.match(rule,/grid-template-rows:max-content minmax\(0,1fr\)!important/);
 assert.match(rule,/\.adaptive-short \.dock-pane\[data-pane="properties"\]>\.dock-pane-titlebar\s*\{[^}]*flex-basis:29px!important/s);
});
