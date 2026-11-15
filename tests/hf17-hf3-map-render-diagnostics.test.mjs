import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {updateBrushChunkReadout,clearBrushChunkReadout,getBrushBatchSummary,formatMapRenderReport} from '../src/engine/mapRenderDiagnostics.ts';

test('read-only summary reports actual brush batching coverage and small chunks',()=>{
 const a=Symbol('a'),b=Symbol('b');
 updateBrushChunkReadout(a,{brushes:96,batchedBrushes:75,batchDrawMeshes:12,sourceTriangles:600,eligibleForChunk:true,batchingEnabled:true});
 updateBrushChunkReadout(b,{brushes:8,batchedBrushes:0,batchDrawMeshes:0,sourceTriangles:0,eligibleForChunk:false,batchingEnabled:true});
 const read=getBrushBatchSummary();
 assert.deepEqual(read,{brushChunks:2,smallChunks:1,brushes:104,batchedBrushes:75,notBatchedBrushes:29,batchDrawMeshes:12,batchedTriangles:600,batchingEnabled:true,nullFaces:0,hiddenNullFaces:0});
 clearBrushChunkReadout(a);assert.equal(getBrushBatchSummary().brushes,8);
 clearBrushChunkReadout(b);assert.equal(getBrushBatchSummary().brushes,0);
});
test('diagnostic report clearly distinguishes draw-call counters from GPU timing',()=>{
 const b={brushChunks:1,smallChunks:0,brushes:1125,batchedBrushes:150,notBatchedBrushes:975,batchDrawMeshes:42,batchedTriangles:1234,batchingEnabled:true,nullFaces:2300,hiddenNullFaces:1700};
 const data={timestamp:'2026-11-13T23:00:00.000Z',fps:12,frameMs:83.33,drawCalls:997,triangles:128000,lines:0,
   geometries:1120,gpuTextures:219,wadAssets:3126,pixelWidth:1500,pixelHeight:800,dpr:1.25,renderer:'Intel',browser:'Chrome',brushes:1125,entities:695,mode:'Textured',batchReturn:b};
 const original=JSON.stringify(data),report=formatMapRenderReport(data);
 assert.match(report,/FPS \(wall clock\): 12/);
 assert.match(report,/WebGL draw calls \(complete previous frame, all passes\): 997/);
 assert.match(report,/Brush chunks: 1, too small to batch: 0/);
 assert.match(report,/batched: 150, not batched: 975/);
 assert.match(report,/NOT GPU execution time/);
 assert.match(report,/NULL tool faces in brush chunks: 2300 \(skipped by hidden-NULL mode: 1700\)/);
 assert.match(report,/No map, BSP, WAD, texture or game file was modified/);
 assert.equal(JSON.stringify(data),original);
});
test('monitor avoids expensive GPU readbacks and changes no project files',()=>{
 const monitor=readFileSync(new URL('../src/components/MapPerformanceMonitor.tsx',import.meta.url),'utf8');
 const viewport=readFileSync(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
 assert.match(monitor,/gl\.info\.render\.calls/);
 assert.match(monitor,/gl\.info\.memory\.textures/);
 assert.match(monitor,/formatMapRenderReport/);
 assert.match(monitor,/onKey/);
 assert.doesNotMatch(monitor.replace(/\/\*[\s\S]*?\*\//g,''),/\.readPixels\(|setState\(|gl\.render\(/);
 assert.match(monitor,/gl\.info\.autoReset=false/);
 assert.match(monitor,/gl\.info\.reset\(\)/);
 assert.match(viewport,/updateBrushChunkReadout/);
 assert.match(viewport,/clearBrushChunkReadout/);
});

test('MAP FPS remains discoverable by keyboard and diagnostics are available in six languages',()=>{
 const ui=readFileSync(new URL('../src/components/MapPerformanceMonitor.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 for(const lang of ['es','en','ru','ko','zh','pt'])assert.match(ui,new RegExp(`\\b${lang}:\\{title:`));
 assert.match(ui,/const badge=document.createElement\('button'\)/);
 assert.match(ui,/badge.setAttribute\('aria-expanded'/);
 assert.match(ui,/badge.addEventListener\('click'/);
 assert.match(css,/\.map-render-diagnostic\[hidden\]\{display:none!important\}/);
 assert.match(css,/overflow:auto/);
});
