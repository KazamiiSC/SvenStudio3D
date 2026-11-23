import {beforeEach,describe,expect,it} from 'vitest';
import {demoProject,useEditor} from '../src/store';
import type {Brush,PointEntity} from '../src/engine/types';

const entities=()=>useEditor.getState().project.objects.filter((o):o is PointEntity=>o.kind==='entity');
const brushes=()=>useEditor.getState().project.objects.filter((o):o is Brush=>o.kind==='brush');

describe('entity report actions (store)',()=>{
  beforeEach(()=>{useEditor.getState().loadProject(demoProject());});
  it('renames a targetname and its references in one undo step',()=>{
    const [a,b]=entities();
    useEditor.getState().setEntityKeyvalues([a.id],'targetname','door_a');
    useEditor.getState().setEntityKeyvalues([b.id],'target','door_a');
    const history=useEditor.getState().history.length;
    const plan=useEditor.getState().renameTargetname('door_a','gate_a');
    expect(plan.renamedEntities).toBe(1);
    expect(plan.updatedReferences).toBe(1);
    expect(useEditor.getState().history.length).toBe(history+1);
    expect(entities().find(e=>e.id===b.id)!.props.target).toBe('gate_a');
    useEditor.getState().undo();
    expect(entities().find(e=>e.id===a.id)!.props.targetname).toBe('door_a');
  });
  it('bulk edit without changes leaves history alone',()=>{
    const history=useEditor.getState().history.length;
    expect(useEditor.getState().setEntityKeyvalues([],'health','10')).toBe(0);
    expect(useEditor.getState().history.length).toBe(history);
  });
});

describe('linear array (store)',()=>{
  beforeEach(()=>{useEditor.getState().loadProject(demoProject());});
  it('adds copies as one undo step and selects them',()=>{
    const first=brushes()[0];
    useEditor.getState().selectObjectIds([first.id]);
    const count=brushes().length;
    useEditor.getState().linearArraySelected({offset:[128,0,0],copies:3,yawStep:0});
    expect(brushes().length).toBe(count+3);
    expect(useEditor.getState().selectedIds).toHaveLength(3);
    useEditor.getState().undo();
    expect(brushes().length).toBe(count);
  });
});

describe('view settings',()=>{
  it('4 views and editor skybox are opt-in settings',()=>{
    const settings=useEditor.getState().settings;
    expect(!!settings.quadView).toBe(false);
    expect(!!settings.editorSkybox).toBe(false);
    useEditor.getState().setSettings({quadView:true});
    expect(useEditor.getState().settings.quadView).toBe(true);
    useEditor.getState().setSettings({quadView:false});
  });
});
