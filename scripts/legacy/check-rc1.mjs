// Compatibility test retained for installations updated from RC1.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const app=readFileSync('src/App.tsx','utf8');
assert.equal(pkg.version,'1.0.0');
assert.ok(app.includes('v1.0.0'));
console.log('PASS RC1-to-stable compatibility: version and app identification');
