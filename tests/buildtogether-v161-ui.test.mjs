import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('BuildTogether 3.1 camera markers are inside the existing 3D scene without a second render or raycast',()=>{
 const viewport=read('src/components/Viewport.tsx');
 const camera=read('src/components/RemoteBuildTogetherCameras.tsx');
 assert.match(viewport,/<RemoteBuildTogetherCameras\/>/);
 assert.match(viewport,/sendBuildTogetherCamera/);
 assert.match(camera,/useFrame/);
 assert.match(camera,/Matrix4\(\)\.lookAt/);
 assert.doesNotMatch(camera,/<Html\b[^>]*distanceFactor=/, 'remote names must never scale with camera distance or orthographic zoom');
 assert.match(camera,/<Html\b[^>]*transform=\{false\}/, 'screen-space HTML label must use fixed CSS pixels');
 assert.match(camera,/zIndexRange=\{\[100,100\]\}/, 'world labels must not obscure viewport controls');
 assert.match(camera,/pointerEvents="none"/);
 assert.match(camera,/raycast=\{\(\)=>\{\}\}/);
 assert.doesNotMatch(camera,/new THREE\.WebGLRenderer|<Canvas|<RenderTexture|new THREE\.WebGLRenderTarget/);
});

test('BuildTogether 3.1 displays an accessible side Ping dock with per-user activity and view controls',()=>{
 const viewport=read('src/components/Viewport.tsx');
 const panel=read('src/components/BuildTogether.tsx');
 const css=read('src/style.css');
 assert.match(viewport,/<BuildTogetherPresenceDock\/>/);
 for(const field of ['Ping · BuildTogether','bt-presence-ping','bt-presence-activity','bt-presence-follow','setBuildTogetherCameraVisibility','setBuildTogetherViewCones'])assert.ok(panel.includes(field),field);
 assert.match(css,/\.bt-presence-dock\{position:absolute/);
 assert.match(css,/\.bt-presence-members\{[^}]*overflow-y:auto/);
});

test('BuildTogether 3.1 presence is separate from the map revision and cannot block geometry messages',()=>{
 const client=read('src/engine/buildTogetherClient.ts');
 const server=read('server/buildTogether.js');
 assert.match(client,/type:'member-status'/);
 assert.match(client,/send\(\{type:'camera',pose\},true\)/);
 assert.match(client,/bufferedAmount>128\*1024/);
 assert.match(server,/message\.type==='member-status'/);
 assert.match(server,/peer\.lastStatusAt<350/);
 assert.match(server,/pose:peer\.pose/);
 assert.match(server,/const STATUS_CODES=new Set/);
});
