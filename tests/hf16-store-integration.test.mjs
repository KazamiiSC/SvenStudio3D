import test from 'node:test';
import assert from 'node:assert/strict';
import {useEditor} from '../src/store.ts';
const cube=(id,position=[0,0,0])=>({id,kind:'brush',name:id,primitive:'box',position,rotation:[0,0,0],scale:[1,1,1],vertices:[[-64,-64,-64],[64,-64,-64],[64,64,-64],[-64,64,-64],[-64,-64,64],[64,-64,64],[64,64,64],[-64,64,64]],faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(indices=>({indices,texture:'BRICK',uScale:1,vScale:1,uShift:0,vShift:0})),locked:false,hidden:false});
test('HF16 preview panel is closed by default, has no effect writing project and includes six languages', async()=>{
  const {readFileSync}=await import('node:fs');
  const code=readFileSync(new URL('../src/components/SeamlessUvPanel.tsx',import.meta.url),'utf8');
  for(const locale of ['es','en','ru','ko','zh','pt'])assert.match(code,new RegExp(` ${locale}:\\{`));
  assert.match(code,/useState\(false\),\[showPreview/);
  assert.match(code,/apply\(\{copyTexture\}\)/);
});
test('one store Apply changes only selected faces and Undo restores all UV data',()=>{
  const store=useEditor;
  const snapshot=store.getState();
  try{
    const a=cube('a'),b=cube('b',[128,0,0]);a.faces[1].uShift=79;
    const original=JSON.stringify([a,b]);
    store.setState({project:{...snapshot.project,objects:[a,b]},selected:'a',selectedIds:['a','b'],selectedFace:null,faceMode:true,textureFaceSelection:[{id:'a',face:1},{id:'b',face:1}],history:[],future:[]});
    const before=store.getState().history.length;
    store.getState().applySeamlessTextureAlignment({copyTexture:false});
    const result=store.getState();
    assert.equal(result.history.length,before+1);
    const updated=result.project.objects;
    assert.equal(updated[0].faces[1].uShift,79);
    assert.equal(updated[1].faces[1].uShift,79);
    assert.equal(updated[1].faces[0].uShift,0);
    assert.deepEqual(updated[1].vertices,b.vertices);
    result.undo();
    assert.equal(JSON.stringify(store.getState().project.objects),original);
  } finally {store.setState(snapshot,true)}
});
test('disconnected faces and identical source do not generate empty undo frames',()=>{
 const snapshot=useEditor.getState();
 try{
  const a=cube('a'),b=cube('b',[3000,0,0]);
  useEditor.setState({project:{...snapshot.project,objects:[a,b]},selectedIds:['a','b'],selected:'a',selectedFace:null,faceMode:true,textureFaceSelection:[{id:'a',face:1},{id:'b',face:1}],history:[],future:[]});
  useEditor.getState().applySeamlessTextureAlignment({copyTexture:false});
  assert.equal(useEditor.getState().history.length,0);
 }finally{useEditor.setState(snapshot,true)}
});
