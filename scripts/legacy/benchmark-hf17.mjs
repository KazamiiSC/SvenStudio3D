/** Repeatable CPU-only benchmark for closest entity-preview ID selection.
 * This is NOT a browser FPS or GPU result. Run: node --experimental-strip-types scripts/benchmark-hf17.mjs
 */
import {performance} from 'node:perf_hooks';
import {selectMapPreviewBudget} from '../src/engine/mapViewportPerformance.ts';
const make=(n)=>Array.from({length:n},(_,i)=>({entity:{id:`e${i}`,classname:i%19===0?'light_spot':i%17===0?'monster_scientist':'info_target',props:{model:i%13===0?'models/foo.mdl':''}},point:{x:(i*131)%20000,y:(i*67)%11000,z:(i*17)%600}}));
const legacy=(items,camera)=>{
  const near=items.map(({entity,point})=>({entity,dist:(point.x-camera.x)**2+(point.y-camera.y)**2+(point.z-camera.z)**2})).sort((a,b)=>a.dist-b.dist);
  return [near.slice(0,95),near.filter(x=>x.entity.classname.startsWith('light')).slice(0,10),near.filter(x=>x.entity.props.model?.startsWith('models/')||x.entity.classname.startsWith('monster_')).slice(0,14)];
};
function measure(fn,items,rounds){
  for(let i=0;i<5;i++)fn(items,{x:i*3,y:i*3,z:0});
  const start=performance.now();
  for(let i=0;i<rounds;i++)fn(items,{x:(i*89)%1000,y:(i*53)%800,z:256});
  return (performance.now()-start)/rounds;
}
for(const count of [695,2500,10000]){
  const items=make(count),rounds=count<=695?400:count<=2500?200:70;
  const before=measure(legacy,items,rounds);
  const after=measure((data,camera)=>selectMapPreviewBudget(data,camera,'balanced',false),items,rounds);
  console.log(`${count} entities: old ${before.toFixed(3)} ms/update; HF17 ${after.toFixed(3)} ms/update; CPU-only speedup ${(before/after).toFixed(2)}x`);
}
