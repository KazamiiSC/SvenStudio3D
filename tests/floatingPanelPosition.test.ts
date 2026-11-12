import {describe,it,expect} from 'vitest';
import {clampFloatingPanelPosition as clamp} from '../src/components/floatingPanelPosition';
describe('floating UI positions',()=>{
 it('keeps a saved panel visible after reducing resolution',()=>{expect(clamp({x:1700,y:900},{width:1024,height:768},320)).toEqual({x:696,y:548})});
 it('preserves valid positions instead of recentering on every open',()=>{expect(clamp({x:120,y:160},{width:1920,height:1080},310)).toEqual({x:120,y:160})});
 it('handles malformed positions and narrow viewports',()=>{expect(clamp({x:NaN,y:Infinity},{width:280,height:300},320)).toEqual({x:8,y:8})});
 it('leaves room for controls and scroll on a short screen',()=>{expect(clamp({x:-100,y:999},{width:1280,height:720},310)).toEqual({x:8,y:500})});
});
