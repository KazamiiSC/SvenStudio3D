import {beforeEach,describe,expect,it} from 'vitest';
import {demoProject,useEditor} from '../src/store';

const hidden=()=>useEditor.getState().project.objects.filter(o=>o.hidden).map(o=>o.id).sort();

describe('viewport "show hidden" toggle',()=>{
  beforeEach(()=>{
    useEditor.getState().loadProject(demoProject());
    const [a,b]=useEditor.getState().project.objects;
    useEditor.getState().selectObjectIds([a.id,b.id]);
    useEditor.getState().hideSelection();
  });
  it('reveals hidden objects and hides exactly the same ones again',()=>{
    const before=hidden();
    expect(before).toHaveLength(2);
    useEditor.getState().toggleRevealHidden();
    expect(hidden()).toEqual([]);
    useEditor.getState().toggleRevealHidden();
    expect(hidden()).toEqual(before);
    expect(useEditor.getState().revealedHiddenIds).toBeNull();
  });
  it('after undo re-hides them, the next press reveals again instead of doing nothing',()=>{
    const before=hidden();
    useEditor.getState().toggleRevealHidden();
    useEditor.getState().undo();
    expect(hidden()).toEqual(before);
    useEditor.getState().toggleRevealHidden();
    expect(hidden()).toEqual([]);
  });
  it('opening another project forgets the remembered ids',()=>{
    useEditor.getState().toggleRevealHidden();
    useEditor.getState().loadProject(demoProject());
    expect(useEditor.getState().revealedHiddenIds).toBeNull();
  });
});
