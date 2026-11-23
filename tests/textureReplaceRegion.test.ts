import {beforeEach,describe,expect,it} from 'vitest';
import {demoProject,useEditor} from '../src/store';
import type {Brush} from '../src/engine/types';

const brushes=()=>useEditor.getState().project.objects.filter((o):o is Brush=>o.kind==='brush');
const textures=()=>brushes().flatMap(b=>b.faces.map(f=>f.texture.toLowerCase()));

describe('find & replace texture (store)',()=>{
  beforeEach(()=>{useEditor.getState().loadProject(demoProject());});

  it('replaces every matching face in one undo step and keeps alignment',()=>{
    const used=textures();
    const find=used[0];
    const before=brushes().flatMap(b=>b.faces.filter(f=>f.texture.toLowerCase()===find).map(f=>({u:f.uShift,v:f.vShift,s:f.uScale,a:f.uAxis})));
    const history=useEditor.getState().history.length;
    const plan=useEditor.getState().replaceTextures({find:find.toUpperCase(),replace:'NEWTEX'});
    expect(plan.faces).toBe(used.filter(t=>t===find).length);
    expect(textures()).not.toContain(find);
    const after=brushes().flatMap(b=>b.faces.filter(f=>f.texture==='NEWTEX').map(f=>({u:f.uShift,v:f.vShift,s:f.uScale,a:f.uAxis})));
    expect(after).toEqual(before);
    expect(useEditor.getState().history.length).toBe(history+1);
    useEditor.getState().undo();
    expect(textures()).toEqual(used);
  });

  it('leaves the map and history untouched when nothing matches',()=>{
    const project=useEditor.getState().project,history=useEditor.getState().history.length;
    const plan=useEditor.getState().replaceTextures({find:'DOES_NOT_EXIST',replace:'X'});
    expect(plan.faces).toBe(0);
    expect(useEditor.getState().project).toBe(project);
    expect(useEditor.getState().history.length).toBe(history);
  });

  it('selection scope only touches selected brushes; locked brushes are skipped',()=>{
    const [first,second]=brushes();
    const find=first.faces[0].texture;
    useEditor.getState().updateObject(second.id,{locked:true});
    useEditor.getState().selectObjectIds([first.id]);
    useEditor.getState().replaceTextures({find,replace:'ONLYFIRST',scope:'selection'});
    const now=brushes();
    expect(now.find(b=>b.id===first.id)!.faces.some(f=>f.texture==='ONLYFIRST')).toBe(true);
    expect(now.filter(b=>b.id!==first.id).some(b=>b.faces.some(f=>f.texture==='ONLYFIRST'))).toBe(false);
  });

  it('rejects invalid GoldSrc texture names',()=>{
    expect(()=>useEditor.getState().replaceTextures({find:textures()[0],replace:'has space'})).toThrow();
    expect(()=>useEditor.getState().replaceTextures({find:textures()[0],replace:'A_NAME_LONGER_THAN_15'})).toThrow();
  });

  it('selects brushes that use a texture',()=>{
    const find=textures()[0];
    const count=useEditor.getState().selectBrushesWithTexture(find);
    expect(count).toBeGreaterThan(0);
    expect(useEditor.getState().selectedIds).toHaveLength(count);
  });
});

describe('compile region (store)',()=>{
  beforeEach(()=>{useEditor.getState().loadProject(demoProject());});
  it('is set from the selection, never touches the project, and resets with a new project',()=>{
    const project=useEditor.getState().project;
    expect(useEditor.getState().setCompileRegionFromSelection()).toBe(false);
    useEditor.getState().selectObjectIds([brushes()[0].id]);
    expect(useEditor.getState().setCompileRegionFromSelection()).toBe(true);
    const region=useEditor.getState().compileRegion!;
    expect(region.max.every((v,i)=>v-region.min[i]>=64)).toBe(true);
    expect(useEditor.getState().project).toBe(project);
    useEditor.getState().loadProject(demoProject());
    expect(useEditor.getState().compileRegion).toBeNull();
  });
});
