import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/RemoteBuildTogetherCameras.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const viewport=readFileSync(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');

test('remote participant name has a fixed-size HTML label in perspective and orthographic views',()=>{
 const html=source.match(/<Html\b[\s\S]*?\>/)?.[0];
 assert.ok(html,'camera marker must include a nameplate');
 assert.ok(html.includes('transform={false}'),'nameplate should not be CSS3D transformed');
 assert.ok(!html.includes('distanceFactor'),'nameplate must not inherit projection-dependent scaling');
 assert.match(source,/<span className="bt-camera-label"/);
 assert.match(css,/\.bt-camera-label\{[^}]*max-width:160px/);
 assert.match(css,/\.bt-camera-label\{[^}]*text-overflow:ellipsis/);
});
test('remote camera world-space geometry and gaze still work, with no extra render and no raycast',()=>{
 assert.match(viewport,/<RemoteBuildTogetherCameras\/>/);
 assert.match(source,/Matrix4\(\)\.lookAt/);
 assert.match(source,/useFrame/);
 assert.match(source,/showViewCones/);
 assert.match(source,/raycast=\{\(\)=>\{\}\}/);
 assert.doesNotMatch(source,/WebGLRenderTarget|new THREE\.WebGLRenderer/);
});
