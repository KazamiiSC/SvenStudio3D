import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createBrush,createArch,transformedVertices,buildMeshGeometry,brushDimensions,resizeBrush,boxFromGroundDrag} from '../src/engine/geometry';
import {demoProject} from '../src/store';
import {exportMap,exportBrush,validateBrush,validateProject} from '../src/engine/exportMap';
import {importMap} from '../src/engine/importMap';

describe('real GoldSrc brush geometry',()=>{
  it.each(['box','wedge','cylinder'] as const)('%s has outward convex faces',type=>{
    const b=createBrush(type,[0,0,0],[128,128,128]);
    const center=new THREE.Vector3();b.vertices.forEach(v=>center.add(new THREE.Vector3(...v)));center.divideScalar(b.vertices.length);
    for(const f of b.faces){
      expect(f.indices.length).toBeGreaterThanOrEqual(3);
      const a=new THREE.Vector3(...b.vertices[f.indices[0]]),c=new THREE.Vector3(...b.vertices[f.indices[1]]),d=new THREE.Vector3(...b.vertices[f.indices[2]]);
      const n=c.clone().sub(a).cross(d.clone().sub(a));
      expect(n.dot(a.clone().sub(center))).toBeGreaterThan(0);
    }
  });
  it('builds render geometry for every brush without unsupported Vector3 methods',()=>{
    for(const kind of ['box','wedge','cylinder'] as const){
      const brush=createBrush(kind,[0,0,64],[128,128,128]);
      const renderGeometry=buildMeshGeometry(brush);
      expect(renderGeometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(renderGeometry.index?.count).toBeGreaterThan(0);
      expect(renderGeometry.userData.trianglesToFaces.length).toBe((renderGeometry.index?.count||0)/3);
      renderGeometry.dispose();
    }
  });
  it('builds an arch from individual convex brushes',()=>{
    const arch=createArch([0,0,128]);expect(arch.length).toBe(8);
    expect(arch.every(x=>x.faces.length===6)).toBe(true);
  });
  it('transforms vertices without modifying source data',()=>{
    const b=createBrush('box',[25,30,20],[100,80,60]);
    const orig=structuredClone(b.vertices);b.rotation=[0,0,90];b.scale=[2,1,1];
    expect(transformedVertices(b)).toHaveLength(8);
    expect(b.vertices).toEqual(orig);
  });
});
describe('GoldSrc MAP format',()=>{
  it('exports world, six brushes, spawn, and light',()=>{
    const p=demoProject();const text=exportMap(p,['C:/Steam/svencoop/svstudio.wad']);
    expect(validateProject(p)).toEqual([]);
    expect(text).toContain('"classname" "worldspawn"');
    expect(text).toContain('"classname" "info_player_start"');
    expect(text).toContain('"classname" "light"');
    expect(text).toContain('"wad" "C:/Steam/svencoop/svstudio.wad;"');
    expect(text.match(/SV_BRICK01/g)?.length).toBeGreaterThan(4);
  });
  it('can re-import the exported starter room',()=>{
    const source=demoProject();const loaded=importMap(exportMap(source),'roundtrip.map');
    expect(loaded.objects.filter(o=>o.kind==='brush')).toHaveLength(6);
    expect(loaded.objects.filter(o=>o.kind==='entity')).toHaveLength(2);
    expect(loaded.world.classname).toBe('worldspawn');
  });
});

describe('GoldSrc compiler plane winding regression (SC-CSG)',()=>{
  const inwardPlanes=(b:ReturnType<typeof createBrush>)=>{
    const text=exportBrush(b);
    const lines=text.split('\n').filter(l=>l.startsWith('('));
    expect(lines).toHaveLength(b.faces.length);
    const verts=transformedVertices(b);
    const center=new THREE.Vector3();
    verts.forEach(v=>center.add(new THREE.Vector3(...v)));
    center.divideScalar(verts.length);
    for(const line of lines){
      const points=[...line.matchAll(/\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\)/g)].slice(0,3)
        .map(m=>new THREE.Vector3(Number(m[1]),Number(m[2]),Number(m[3])));
      expect(points).toHaveLength(3);
      const n=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
      expect(n.dot(center.clone().sub(points[0]))).toBeGreaterThan(0);
    }
  };
  it('every primitive writes inward-facing MAP planes (not outward mesh winding)',()=>{
    for(const kind of ['box','wedge','cylinder'] as const){
      const b=createBrush(kind,[0,0,0],[128,96,64]);
      expect(validateBrush(b)).toEqual([]);
      inwardPlanes(b);
    }
    for(const b of createArch([0,0,128])){
      expect(validateBrush(b)).toEqual([]);
      inwardPlanes(b);
    }
  });
  it('mirrored / negatively scaled brushes still export inward planes',()=>{
    const b=createBrush('box',[80,20,50],[128,48,96]);
    b.scale=[-1,1,1];
    expect(validateBrush(b)).toEqual([]);
    inwardPlanes(b);
  });
  it('rejects non-planar solids before reaching SC-BSP',()=>{
    const b=createBrush('box',[0,0,0],[128,128,128]);
    b.vertices[0][2]+=20;
    expect(validateBrush(b).some(msg=>msg.includes('non-planar'))).toBe(true);
  });
  it('round-trips the correctly wound starter room',()=>{
    const src=demoProject();
    const map=exportMap(src);
    const back=importMap(map);
    expect(back.objects.filter(o=>o.kind==='brush')).toHaveLength(6);
    expect(back.objects.filter(o=>o.kind==='entity')).toHaveLength(2);
    expect(validateProject(back)).toEqual([]);
  });
});


describe('v0.2 geometry tools and safe Valve 220 export',()=>{
  it('creates a closed box from snapped mouse points, with a paintable material',()=>{
    const b=boxFromGroundDrag([3,15,0],[109,71,0],96,16,'CUSTOM_WALL');
    expect(b.position).toEqual([56,40,48]);
    expect(brushDimensions(b)).toEqual([112,48,96]);
    expect(b.faces.every(f=>f.texture==='CUSTOM_WALL')).toBe(true);
    expect(validateBrush(b)).toEqual([]);
    expect(exportBrush(b)).toContain('CUSTOM_WALL');
  });
  it('resizes without corrupting topology, including a rotated and scaled brush',()=>{
    const b=createBrush('wedge',[64,8,32],[128,96,64]);b.rotation=[0,0,30];
    const resized=resizeBrush(b,[256,48,192]);
    expect(brushDimensions(resized)).toEqual([256,48,192]);
    expect(validateBrush(resized)).toEqual([]);
    expect(b.vertices).toEqual(resized.vertices);
    expect(exportBrush(resized).split('\n').filter(x=>x.startsWith('('))).toHaveLength(b.faces.length);
  });
  it('rejects zero thickness boxes before compilation',()=>{
    const b=createBrush('box');
    expect(()=>resizeBrush(b,[0,120,120])).toThrow();
    expect(()=>boxFromGroundDrag([0,0,0],[64,64,0],0,16,'WALL')).toThrow();
  });
});
