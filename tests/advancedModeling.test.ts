import {describe,it,expect} from 'vitest';
import {createBrush} from '../src/engine/geometry';
import {validateBrush,exportMap,validateProject} from '../src/engine/exportMap';
import {importMap} from '../src/engine/importMap';
import {bevelEdge,extrudeFaceBrush,intersectConvex,subtractConvex,taperInsetFace,unionConvex} from '../src/engine/advancedModeling';
import {uniqueBrushEdges} from '../src/engine/modeling';

const box=(at:[number,number,number],size:[number,number,number]=[128,128,128])=>createBrush('box',at,size);
const valid=(brushes:ReturnType<typeof box>[])=>brushes.forEach(b=>expect(validateBrush(b)).toEqual([]));
describe('Advanced Building Studio 0.7.0',()=>{
 it('intersects and subtracts overlapping convex solids, exporting valid GoldSrc brushes',()=>{
  const a=box([0,0,0]),b=box([64,0,0]);
  const i=intersectConvex(a,b);expect(i).not.toBeNull();valid([i!]);
  const subtraction=subtractConvex(a,b);expect(subtraction.length).toBeGreaterThan(0);valid(subtraction);
  const union=unionConvex(a,b);expect(union.length).toBeGreaterThan(1);valid(union);
  const project={version:1 as const,target:'svengine' as const,name:'booleans',objects:[...subtraction,{id:'s',kind:'entity' as const,classname:'info_player_start',name:'spawn',position:[0,0,0] as [number,number,number],props:{}}],world:{classname:'worldspawn'},wadNames:[]};
  expect(validateProject(project)).toEqual([]);
  const reloaded=importMap(exportMap(project),'test.map');expect(validateProject(reloaded)).toEqual([]);
 });
 it('handles disjoint, containment and rotations',()=>{
  const a=box([0,0,0]),b=box([1000,0,0]);
  expect(intersectConvex(a,b)).toBeNull();
  valid(subtractConvex(a,b));
  expect(subtractConvex(a,box([0,0,0],[256,256,256]))).toHaveLength(0);
  const r=box([25,0,0]);r.rotation=[0,0,35];
  valid(subtractConvex(a,r));valid(unionConvex(a,r));
 });
 it('bevels one real edge and creates a convex tapered inset',()=>{
  const a=box([0,0,0]);const [u,v]=uniqueBrushEdges(a)[0];
  const chamfer=bevelEdge(a,u,v,12);valid([chamfer]);expect(chamfer.faces.length).toBeGreaterThan(a.faces.length);
  const inset=taperInsetFace(a,1,10);valid([inset]);expect(inset.faces.length).toBeGreaterThan(a.faces.length);
  expect(()=>bevelEdge(a,u,v,1000)).toThrow();
 });
 it('extrudes a selected face into a second valid, closed brush',()=>{
  const a=box([64,32,0]);a.rotation=[0,0,20];
  const extrusion=extrudeFaceBrush(a,1,64);valid([a,extrusion]);
  expect(extrusion.faces.length).toBe(a.faces[1].indices.length+2);
  expect(a.id).not.toBe(extrusion.id);
 });
});
