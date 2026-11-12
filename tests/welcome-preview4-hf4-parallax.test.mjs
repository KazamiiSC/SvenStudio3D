import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeHomePointer,easeHomePointer} from '../src/engine/homeParallax.ts';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('pointer normalization centers the welcome and clamps any out-of-bounds mouse',()=>{
 const r={left:100,top:80,width:1000,height:600};
 assert.deepEqual(normalizeHomePointer(600,380,r),{x:0,y:0});
 assert.deepEqual(normalizeHomePointer(100,80,r),{x:-1,y:-1});
 assert.deepEqual(normalizeHomePointer(1100,680,r),{x:1,y:1});
 assert.deepEqual(normalizeHomePointer(-100,-100,r),{x:-1,y:-1});
 assert.deepEqual(normalizeHomePointer(1200,900,r),{x:1,y:1});
 assert.deepEqual(normalizeHomePointer(100,80,{...r,width:0}),{x:0,y:0});
});
test('spring damping smooths motion and converges toward neutral',()=>{
 assert.deepEqual(easeHomePointer({x:0,y:0},{x:1,y:-1},.2),{x:.2,y:-.2});
 let p={x:1,y:-1};
 for(let i=0;i<75;i++)p=easeHomePointer(p,{x:0,y:0});
 assert.ok(Math.abs(p.x)<.001&&Math.abs(p.y)<.001);
 assert.deepEqual(easeHomePointer({x:0,y:0},{x:2,y:2},1),{x:1,y:1});
});
test('parallax uses real DOM layers, avoids rerenders and cleans up after unmount',()=>{
 const s=read('src/components/WelcomeScreen.tsx');
 for(const x of ['useRef<HTMLElement>','requestAnimationFrame','cancelAnimationFrame','pointermove','pointerleave','pointercancel','removeEventListener','matchMedia','prefers-reduced-motion: reduce','easeHomePointer','normalizeHomePointer'])assert.ok(s.includes(x),x);
 assert.match(s,/homeRef/);
 assert.match(s,/onClick={onStart}/);
 assert.doesNotMatch(s,/<img|setState|setMouse/);
});
test('CSS layers are perspective-based but reduced-motion and touch users stay still',()=>{
 const css=read('src/style.css');
 for(const selector of ['.ss-home-parallax .ss-home-hero','.ss-home-parallax .ss-home-symbol','.ss-home-parallax .ss-home-tools','.ss-home-parallax .ss-home-capabilities','.ss-home-parallax .ss-home-bottom','.ss-home-parallax .ss-home-start::before'])assert.ok(css.includes(selector),selector);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\),\(hover:none\),\(pointer:coarse\)/);
 assert.match(css,/transform:none!important/);
 assert.match(css,/background:#071827/);
});
