import {describe,it,expect} from 'vitest';
import {useStudioLayout} from '../src/layout';
describe('Movable SvenStudio 3D workspace',()=>{
  it('can dock the Explorer on the left and restore the default layout',()=>{
    const api=useStudioLayout.getState();
    api.resetLayout();
    api.movePanel('explorer','left','assets');
    expect(useStudioLayout.getState().sides.explorer).toBe('left');
    expect(useStudioLayout.getState().order.indexOf('explorer')).toBeLessThan(useStudioLayout.getState().order.indexOf('assets'));
    api.resetLayout();
    expect(useStudioLayout.getState().sides.explorer).toBe('right');
  });
  it('keeps toolbar side, scale and theme editable independently of map data',()=>{
    const api=useStudioLayout.getState();api.resetLayout();
    api.setToolbarDock('bottom');api.setScale(.9);api.setAccent('ice');
    const state=useStudioLayout.getState();
    expect(state.toolbarDock).toBe('bottom');expect(state.uiScale).toBe(.9);expect(state.accent).toBe('ice');
    api.resetLayout();
  });
  it('resizes a split without erasing the other panel weight',()=>{
    const api=useStudioLayout.getState();api.resetLayout();
    api.setWeights('explorer',1.3,'properties',.7);
    const state=useStudioLayout.getState();
    expect(state.weights.explorer).toBe(1.3);expect(state.weights.properties).toBe(.7);
    api.resetLayout();
  });
});
