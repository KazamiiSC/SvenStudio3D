import test from 'node:test';
import assert from 'node:assert/strict';
import {findUnusedCss} from '../scripts/unused-css.mjs';

test('style.css has no rules for classes that no component renders',()=>{
  const {dead,unusedClasses}=findUnusedCss();
  assert.deepEqual(dead,[],`Remove with: node scripts/unused-css.mjs --write\nUnused classes: ${unusedClasses.join(' ')}`);
});
