import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lightTestSettings, lightTestRadArgs} from '../server/lightingTest.js';

test('Normal compile preserves the exact original map filename and no extra flags',()=>{
  assert.deepEqual(lightTestSettings('maptest1','off'),{name:'maptest1',ambient:null});
  assert.deepEqual(lightTestSettings('osprey'),{name:'osprey',ambient:null});
  assert.deepEqual(lightTestRadArgs(null),[]);
});
test('All three diagnostics have distinct output names and one explicit, bounded RAD flag',()=>{
  for(const [ambient,suffix] of [['0.08','08'],['0.15','15'],['0.25','25']]){
    assert.deepEqual(lightTestSettings('maptest1',ambient),{name:`maptest1_light${suffix}`,ambient});
    assert.deepEqual(lightTestRadArgs(ambient),['-ambient',ambient,ambient,ambient]);
  }
});
test('Disallows invalid or shell-like preset values',()=>{
  for(const bad of ['0.150','-ambient 1 1 1','0.99','0.15\r\n-fake',0.15,{},'']){
    assert.throws(()=>lightTestSettings('maptest1',bad));
  }
});
test('Does not truncate output names or overwrite a long named original BSP',()=>{
  const original='a'.repeat(64);
  assert.equal(lightTestSettings(original,'off').name,original);
  assert.throws(()=>lightTestSettings(original,'0.15'),/too long/);
  assert.throws(()=>lightTestSettings('../osprey','off'),/Invalid map name/);
});
