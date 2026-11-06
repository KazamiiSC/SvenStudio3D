import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');
test('Ctrl+D / Cmd+D do not duplicate map brushes or entities',async()=>{
  const app=await read('src/App.tsx');
  assert.doesNotMatch(app,/\(e\.ctrlKey\|\|e\.metaKey\)\s*&&\s*e\.key\.toLowerCase\(\)\s*===\s*['"]d['"]/);
  assert.doesNotMatch(app,/e\.code\s*===\s*['"]KeyD['"][^\n]*duplicate\(/);
});
test('Duplicate stays available from UI without advertising Ctrl+D',async()=>{
  const app=await read('src/App.tsx');
  const context=await read('src/components/ViewportExtras.tsx');
  const properties=await read('src/components/Panels.tsx');
  assert.match(app,/onClick=\{duplicate\}/);
  assert.match(context,/store\.duplicateSelected,undefined,!selectedActive/);
  assert.match(properties,/onClick=\{duplicate\}/);
  assert.doesNotMatch(context,/Ctrl\+D/);
});
