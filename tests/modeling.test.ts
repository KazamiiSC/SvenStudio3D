import {describe,it,expect} from 'vitest';
import {createBrush,createArch} from '../src/engine/geometry';
import {editBrushVertices,splitBrush,hollowBox,pushPullFace,uniqueBrushEdges} from '../src/engine/modeling';
import {validateBrush,exportMap,validateProject} from '../src/engine/exportMap';
import {importMap} from '../src/engine/importMap';
import {translate} from '../src/i18n';

describe('Svengine v0.3 convex modeling',()=>{
  const valid=(b:ReturnType<typeof createBrush>)=>expect(validateBrush(b)).toEqual([]);
  it('rebuilds planar convex faces after vertex and edge transforms',()=>{
    const box=createBrush('box',[0,0,0],[128,128,128]);
    expect(uniqueBrushEdges(box)).toHaveLength(12);
    valid(editBrushVertices(box,[6],[15,15,10]));
    valid(editBrushVertices(box,[6,7],[0,0,15]));
    expect(box.vertices[6]).toEqual([64,64,64]); // original is not mutated
  });
  it('keeps push/pull convex and closed',()=>{
    const box=createBrush('box',[0,0,0],[128,128,128]);
    valid(pushPullFace(box,1,48));
  });
  it('clips a brush into two valid closed objects',()=>{
    const box=createBrush('box',[0,0,0],[128,128,128]);
    const halves=splitBrush(box,0,0);
    expect(halves).toHaveLength(2);
    halves.forEach(valid);
    const large=splitBrush(box,2,16,'positive');
    expect(large).toHaveLength(1);large.forEach(valid);
  });
  it('hollows a rotated box into six GoldSrc/Svengine solids',()=>{
    const box=createBrush('box',[0,0,0],[128,128,128]);box.rotation=[0,0,30];
    const shells=hollowBox(box,12);
    expect(shells).toHaveLength(6);shells.forEach(valid);
  });
  it('rejects zero-thickness shells and cuts outside the solid',()=>{
    const box=createBrush('box',[0,0,0],[128,128,128]);
    expect(()=>hollowBox(box,65)).toThrow();
    expect(()=>splitBrush(box,0,256,'both')).toThrow();
  });
  it('exports and imports clipped solids as real .map brushes',()=>{
    const base=createBrush('box',[0,0,0],[128,128,128]);
    const clipped=splitBrush(base,0,0);
    const project={version:1 as const,target:'svengine' as const,name:'cliptest',objects:[...clipped,
      {id:'spawn',kind:'entity' as const,name:'info_player_start',classname:'info_player_start',position:[0,0,0] as [number,number,number],props:{}}],world:{classname:'worldspawn'},wadNames:[]};
    expect(validateProject(project)).toEqual([]);
    const loaded=importMap(exportMap(project),'cliptest.map');
    expect(loaded.objects.filter(o=>o.kind==='brush')).toHaveLength(2);
    expect(validateProject(loaded)).toEqual([]);
  });
  it('recognizes Svengine large-map coordinates above GoldSrc limits',()=>{
    const b=createBrush('box',[40000,0,0],[128,128,128]);
    valid(b);
    const outside=createBrush('box',[140000,0,0],[128,128,128]);
    expect(validateBrush(outside)).not.toEqual([]);
  });
});

describe('four UI translations',()=>{
  it('selects Spanish, English, Russian and Korean labels',()=>{
    expect(translate('en','Compile Map')).toBe('Compile Map');
    expect(translate('es','Compile Map')).toBe('Compilar mapa');
    expect(translate('ru','Compile Map')).toBe('Скомпилировать карту');
    expect(translate('ko','Compile Map')).toBe('맵 컴파일');
  });
  it('never changes unrecognized FGD classnames',()=>{
    for(const l of ['en','es','ru','ko'] as const)expect(translate(l,'info_player_start')).toBe('info_player_start');
  });
});
