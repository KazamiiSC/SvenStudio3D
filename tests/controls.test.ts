import {beforeEach,describe,expect,it} from 'vitest';
import {DEFAULT_CONTROLS,displayBinding,keyEventBinding,shortcutAction} from '../src/engine/controls';
import {demoProject,useEditor} from '../src/store';

describe('v0.2.2 configurable Blender controls',()=>{
  beforeEach(()=>{useEditor.setState({project:demoProject(),selected:null,selectedIds:[],mode:'select',flyMode:false,history:[],future:[]});useEditor.getState().resetControls()});
  it('pressing the same G/R/C tool again toggles it off',()=>{
    const state=useEditor.getState();
    for(const [key,mode] of [['KeyG','translate'],['KeyR','rotate'],['KeyC','scale']] as const){
      expect(shortcutAction(state.controls,key)).toBe(mode==='translate'?'move':mode==='rotate'?'rotate':'scale');
      state.setMode(mode);expect(useEditor.getState().mode).toBe(mode);
      state.setMode(mode);expect(useEditor.getState().mode).toBe('select');
    }
  });
  it('records shortcuts with modifiers and prevents duplicates',()=>{
    expect(keyEventBinding({code:'KeyF',shiftKey:true,altKey:false,ctrlKey:false,metaKey:false})).toBe('Shift+KeyF');
    expect(displayBinding(DEFAULT_CONTROLS.shortcuts.frame)).toBe('Num .');
    useEditor.getState().setShortcut('move','KeyM');
    useEditor.getState().setShortcut('scale','KeyM');
    expect(useEditor.getState().controls.shortcuts.move).toBe('');
    expect(useEditor.getState().controls.shortcuts.scale).toBe('KeyM');
  });
  it('WASD fly mode and tool mode do not remain active at once',()=>{
    useEditor.getState().setMode('translate');
    useEditor.getState().toggleFly();
    expect(useEditor.getState().mode).toBe('select');
    expect(useEditor.getState().flyMode).toBe(true);
    useEditor.getState().setMode('scale');
    expect(useEditor.getState().flyMode).toBe(false);
  });
  it('rotates and scales a multi-selection in one history step with valid MAP geometry',async()=>{
    const state=useEditor.getState(),ids=state.project.objects.filter(o=>o.kind==='brush').slice(0,2).map(o=>o.id);
    state.selectObject(ids[0],false);state.selectObject(ids[1],true);
    const changed=Object.fromEntries(state.project.objects.filter(o=>ids.includes(o.id)).map(o=>[o.id,{position:o.position,rotation:[0,0,45] as [number,number,number],scale:[1.25,1,1] as [number,number,number]}]));
    state.transformSelection(changed);
    expect(useEditor.getState().history).toHaveLength(1);
    const {validateProject}=await import('../src/engine/exportMap');
    expect(validateProject(useEditor.getState().project)).toEqual([]);
    state.undo();
    expect(useEditor.getState().project.objects.filter(o=>ids.includes(o.id)&&o.kind==='brush').every(o=>o.kind==='brush'&&o.scale[0]===1)).toBe(true);
  });
});
