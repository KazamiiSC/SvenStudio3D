import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {groupMapRenderSegments,reuseMapRenderSegments,selectMapPreviewBudget,previewBudget,samePreviewSets,isObjectSelected} from '../src/engine/mapViewportPerformance.ts';
const order=[ 'quality','balanced','large'];
const original=(candidates,camera,preset,optimizedLabels)=>{
  const near=candidates.map(({entity,point})=>({entity,dist:(point.x-camera.x)**2+(point.y-camera.y)**2+(point.z-camera.z)**2})).sort((a,b)=>a.dist-b.dist);
  const budgets=previewBudget(preset);
  return {labels:optimizedLabels?new Set():new Set(near.slice(0,budgets[0]).map(x=>x.entity.id)),
    lights:new Set(near.filter(x=>x.entity.classname.startsWith('light')).slice(0,budgets[1]).map(x=>x.entity.id)),
    models:new Set(near.filter(x=>x.entity.props.model?.startsWith('models/')||x.entity.classname.startsWith('monster_')).slice(0,budgets[2]).map(x=>x.entity.id))};
};
function data(count,seed=12345){
  let state=seed;const rnd=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  return Array.from({length:count},(_,i)=>{
    const cls=i%17===0?'light_spot':i%13===0?'monster_zombie':i%19===0?'light':'info_target';
    return {entity:{id:`e${i}`,classname:cls,props:{model:i%11===0?'models/example.mdl':undefined}},point:{x:Math.floor(rnd()*64)*16,y:Math.floor(rnd()*64)*16,z:Math.floor(rnd()*10)*64}};
  });
}
function verifySame(a,b){
  for(const type of ['labels','lights','models'])assert.deepEqual([...a[type]],[...b[type]],`${type}: same ordered IDs, no new culling artifacts`);
}
test('HF17 bounded nearest selection matches full stable distance sort for all quality presets',()=>{
  for(const size of [0,1,3,40,250,695,1500,5000]){
    for(const preset of order){
      for(const optimize of [false,true]){
        const candidates=data(size,size+42);
        for(const camera of [{x:0,y:0,z:0},{x:320,y:400,z:64},{x:-100,y:4096,z:-128}]){
          verifySame(selectMapPreviewBudget(candidates,camera,preset,optimize),original(candidates,camera,preset,optimize));
        }
      }
    }
  }
});
test('HF17 tie-breaking preserves document order, even with many identical-distance entities',()=>{
  const candidates=data(2500).map((item,i)=>({...item,point:{x:Math.floor(i%4)*16,y:0,z:0}}));
  for(const preset of order)verifySame(selectMapPreviewBudget(candidates,{x:0,y:0,z:0},preset,false),original(candidates,{x:0,y:0,z:0},preset,false));
});
test('HF17 computed preview sets only change on actual visible-ID changes',()=>{
  const a=selectMapPreviewBudget(data(100),{x:0,y:0,z:0},'balanced',false);
  const b=selectMapPreviewBudget(data(100),{x:0,y:0,z:0},'balanced',false);
  assert.equal(samePreviewSets(a,b),true);
  b.lights.add('different');assert.equal(samePreviewSets(a,b),false);
});
test('HF17 selection-membership cache stays correct across immutable selections and large multi-select',()=>{
  const ids=Array.from({length:900},(_,i)=>`brush-${i}`);
  assert.equal(isObjectSelected(ids,'brush-899'),true);
  assert.equal(isObjectSelected(ids,'brush-900'),false);
  assert.equal(isObjectSelected(ids.slice(0,899),'brush-899'),false);
  assert.equal(isObjectSelected(['one'],'one'),true);
  assert.equal(isObjectSelected([],'one'),false);
  for(let i=0;i<ids.length;i++)assert.equal(isObjectSelected(ids,`brush-${i}`),true);
});
test('HF17 scene keeps all edit-able brushes while budgeting previews only',async()=>{
  const src=await readFile(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
  assert.match(src,/const MapBrushLayer=memo\(function MapBrushLayer/);
  assert.match(src,/<MapBrushLayer key=\{`brush-run-\$\{index\}`\} brushes=\{segment\.objects\} optimizedLabels=\{optimizedLabels\}\/>/);
  assert.match(src,/segment\.objects\.map\(obj=>/);
  assert.match(src,/selectMapPreviewBudget\(cullCandidates,origin,preset,optimizedLabels\)/);
  assert.doesNotMatch(src,/buildMeshGeometry\(.*performancePreset/);
  assert.match(src,/const \{labels:visibleLabels,lights:activeLights,models:activeModels\}=previewSets/);
});

test('HF17 contiguous brush runs preserve original scene object order',()=>{
  const input=['brush','entity','entity','brush','brush','entity','brush','entity'].map((kind,i)=>({kind,id:String(i)}));
  const parts=groupMapRenderSegments(input);
  assert.deepEqual(parts.map(group=>[group.kind,group.objects.length]),[['brush',1],['entity',2],['brush',2],['entity',1],['brush',1],['entity',1]]);
  assert.deepEqual(parts.flatMap(group=>group.objects.map(o=>o.id)),input.map(o=>o.id));
  assert.notStrictEqual(parts[2].objects,parts[0].objects);
});

test('HF17 changing an entity reuses neighboring brushes without rerendering their groups',()=>{
  const brush={kind:'brush',id:'brush-A'},entity={kind:'entity',id:'entity-A'};
  const original=groupMapRenderSegments([brush,entity,brush]);
  const modified=groupMapRenderSegments([brush,{...entity,name:'changed'},brush]);
  const reused=reuseMapRenderSegments(original,modified);
  assert.strictEqual(reused[0],original[0]);
  assert.notStrictEqual(reused[1],original[1]);
  assert.strictEqual(reused[2],original[2]);
  const modifiedBrush=groupMapRenderSegments([{...brush,name:'updated'},entity,brush]);
  const afterBrush=reuseMapRenderSegments(original,modifiedBrush);
  assert.notStrictEqual(afterBrush[0],original[0]);
  assert.strictEqual(afterBrush[1],original[1]);
  assert.strictEqual(afterBrush[2],original[2]);
});
