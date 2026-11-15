import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../src/components/SmartConnectPanel.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/components/smartConnect.css',import.meta.url),'utf8');

test('HF20 HF3 opening controls keep their height and their own scroll, without clipping the footer',()=>{
 assert.match(css,/\.sc-options>\*\s*\{\s*flex:\s*0\s+0\s+auto\s*\}/);
 assert.match(css,/\.sc-options\{[^}]*min-height:0;[^}]*overflow-y:auto;/);
 assert.match(css,/\.sc-layout\{[^}]*overflow:hidden;/);
 assert.match(css,/\.sc-opening-controls\{[^}]*flex-shrink:0;[^}]*max-height:[^;]+;[^}]*overflow-y:auto;/);
 assert.match(css,/\.sc-previews\{[^}]*min-height:0;[^}]*overflow-y:auto;/);
 assert.match(css,/@media\(max-width:840px\)\{[^}]*\.sc-layout\{[^}]*overflow-y:auto;/);
 assert.match(ui,/<footer className="sc-footer">/);
});

test('HF20 HF3 makes the cutting list reachable with a shortcut that focuses a real fieldset',()=>{
 assert.match(ui,/const openingSection=useRef<HTMLFieldSetElement>\(null\)/);
 assert.match(ui,/cuttingCandidates\.length&&<button type="button" className="sc-opening-shortcut" aria-controls="sc-opening-controls"/);
 assert.match(ui,/openingSection\.current\?\.scrollIntoView\(\{behavior:'smooth',block:'start',inline:'nearest'\}\)/);
 assert.match(ui,/openingSection\.current\?\.focus\(\{preventScroll:true\}\)/);
 assert.match(ui,/id="sc-opening-controls" ref=\{openingSection\} tabIndex=\{-1\}/);
 assert.match(ui,/\.map\(brush=>\{/);
 assert.match(ui,/className="sc-cut-label"/);
});

test('HF20 HF3 includes translated shortcut text for all six existing locales',()=>{
 const block=ui.split('const ROUTE_TEXT=')[1].split('} satisfies Record')[0];
 for(const key of ['es','en','ru','ko','zh','pt']){
  assert.match(block,new RegExp(`\\b${key}:\\{[^\\n]*jump:'[^']+'`),`${key}: missing opening shortcut label`);
 }
});
