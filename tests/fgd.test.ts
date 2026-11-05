import {describe,it,expect} from 'vitest';
import {parseFgd} from '../src/engine/fgd';
describe('FGD parser',()=>{
  it('parses point and solid classes plus top-level keyvalues',()=>{
    const txt=`@PointClass base(Targetname) size(-16 -16 0, 16 16 72) = info_player_start : "Spawn" [
      angles(string) : "Angles" : "0 0 0"
      spawnflags(flags) = [ 1 : "Start On" : 1 ]
    ]
    @SolidClass base(Targetname) = func_door : "Door" [
      speed(integer) : "Speed" : 100
    ]`;
    const defs=parseFgd(txt);
    expect(defs.map(d=>d.name)).toEqual(['func_door','info_player_start']);
    expect(defs[0].type).toBe('solid');
    expect(defs[0].props.speed.defaultValue).toBe('100');
    expect(defs[1].props.angles.defaultValue).toBe('0 0 0');
  });
});
