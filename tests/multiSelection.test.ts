import {beforeEach,describe,expect,it} from 'vitest';
import {demoProject,useEditor} from '../src/store';
import {validateProject,exportMap} from '../src/engine/exportMap';

const findWall=(name:string)=>useEditor.getState().project.objects.find(o=>o.name===name)!;

describe('v0.2.1 multi-select and grouped movement',()=>{
  beforeEach(()=>useEditor.setState({project:demoProject(),selected:null,selectedIds:[],selectedFace:null,history:[],future:[]}));
  it('preserves two selected brushes when grabbing a selected brush',()=>{
    const left=findWall('West Wall').id,right=findWall('East Wall').id;
    useEditor.getState().selectObject(left,false);
    useEditor.getState().selectObject(right,true);
    useEditor.getState().selectObject(left,false);
    expect(useEditor.getState().selectedIds).toEqual([left,right]);
  });
  it('commits the same translation to both walls in one undo step, without breaking .map',()=>{
    const left=findWall('West Wall'),right=findWall('East Wall');
    useEditor.getState().selectObject(left.id,false);
    useEditor.getState().selectObject(right.id,true);
    const p0=[...left.position],p1=[...right.position];
    useEditor.getState().moveSelection([32,-16,16]);
    expect(findWall('West Wall').position).toEqual([p0[0]+32,p0[1]-16,p0[2]+16]);
    expect(findWall('East Wall').position).toEqual([p1[0]+32,p1[1]-16,p1[2]+16]);
    expect(useEditor.getState().history).toHaveLength(1);
    expect(validateProject(useEditor.getState().project)).toEqual([]);
    expect(exportMap(useEditor.getState().project)).toContain('"classname" "worldspawn"');
    useEditor.getState().undo();
    expect(findWall('West Wall').position).toEqual(p0);
    expect(findWall('East Wall').position).toEqual(p1);
    useEditor.getState().redo();
    expect(findWall('West Wall').position).toEqual([p0[0]+32,p0[1]-16,p0[2]+16]);
    expect(findWall('East Wall').position).toEqual([p1[0]+32,p1[1]-16,p1[2]+16]);
  });
  it('does not add undo history for a zero-length drag',()=>{
    useEditor.getState().selectObject(findWall('West Wall').id,false);
    useEditor.getState().moveSelection([0,0,0]);
    expect(useEditor.getState().history).toHaveLength(0);
  });
});
