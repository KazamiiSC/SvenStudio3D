import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const panel = readFileSync(new URL('../src/components/LinkedPrefabsPanel.tsx', import.meta.url), 'utf8');

// A missing optional `linkedPrefabs` field is normal for HF9–HF14 projects.
// React 19/Zustand 5 require external-store selectors to return a stable
// value for an unchanged store. `s.project.linkedPrefabs ?? []` allocates a
// different array on every read, causing Maximum update depth exceeded.
test('HF15 panel subscribes to the optional field without allocating a fallback array in the selector', () => {
  assert.match(panel, /const\s+records\s*=\s*useEditor\(s\s*=>\s*s\.project\.linkedPrefabs\)\s*\?\?\s*EMPTY_LINKED_PREFABS\s*;/);
  assert.match(panel, /const\s+EMPTY_LINKED_PREFABS[^=]*=\s*Object\.freeze\(\[\]\)/);
  assert.doesNotMatch(panel, /useEditor\(\s*s\s*=>\s*s\.project\.linkedPrefabs\s*\?\?\s*\[\]\s*\)/);
});

test('the selector returns a stable snapshot for legacy projects, empty HF15 projects and populated HF15 projects', () => {
  const subscribedSelector = s => s.project.linkedPrefabs;
  const legacyProject = {project:{objects:[]}};
  const empty = {project:{linkedPrefabs:[],objects:[]}};
  const linked = {project:{linkedPrefabs:[{id:'prefab1'}],objects:[]}};
  for (const state of [legacyProject,empty,linked]) {
    const a=subscribedSelector(state),b=subscribedSelector(state);
    assert.strictEqual(a,b);
  }
  // An empty array literal inside the selector would not be stable.
  const oldBug = s => s.project.linkedPrefabs ?? [];
  assert.notStrictEqual(oldBug(legacyProject), oldBug(legacyProject));
});
