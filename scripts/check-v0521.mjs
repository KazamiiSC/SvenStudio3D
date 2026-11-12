import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const model=read('src/components/ModelBrowser.tsx');
const viewport=read('src/components/Viewport.tsx');
const css=read('src/style.css');
assert.match(model,/filtered\.slice\(0,visibleLimit\)/,'Model list must render only a bounded number of cards');
assert.match(model,/useState\(48\)/,'Default thumbnail page size must remain limited');
assert.match(model,/root:element\.closest\('\.model-results'\)/,'Observer must be relative to the scrolled model list');
assert.match(model,/setFailed\(true\)/,'Thumbnail errors must have an explicit fallback');
assert.match(model,/Show more models/,'Users must be able to display additional models');
assert.match(css,/\.model-results\.model-grid\{[^\n]*grid-auto-rows:166px/,'Grid must have fixed track heights');
assert.match(css,/\.model-grid \.model-result\{[^\n]*height:166px/,'Cards must never collapse to narrow lines');
assert.match(viewport,/starterTextures\.has\(texture\.toUpperCase\(\)\)/,'Starter WAD textures need an immediate fallback');
assert.match(viewport,/\/starter-textures\/\$\{texture\.toUpperCase\(\)\}\.png/,'Fallback URI is missing');
const names=['SV_BRICK01','SV_CONCRET','SV_TILE01','SV_METAL01','SV_GRID01'];
for(const name of names){
 const png=fs.readFileSync(path.join(root,'public/starter-textures',name+'.png'));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name+' has invalid PNG header');
 assert.equal(png.readUInt32BE(16),128,name+' has wrong width');
 assert.equal(png.readUInt32BE(20),128,name+' has wrong height');
}
const pkg=JSON.parse(read('package.json'));
assert.match(pkg.version,/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/,'npm package version must be valid semver');
console.log('PASS: bounded model thumbnails, scroll-root lazy loading, fixed grid dimensions, fallback thumbnails, 5 WAD texture fallback PNGs and valid package version.');
