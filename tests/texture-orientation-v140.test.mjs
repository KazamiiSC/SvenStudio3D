import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {normalizedUvAt} from '../src/engine/valve220UV.ts';

const source=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const geometry=source('src/engine/geometry.ts');

// Evaluate the real builder without a WebGL context, preserving GoldSrc's
// world points and per-face UV values. No simulated projection implementation.
function createBuilder(){
  const ast=ts.createSourceFile('geometry.ts',geometry,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='buildMeshGeometry');
  assert.ok(fn);
  const js=ts.transpileModule(fn.getText(ast).replace(/^export /,''),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
  }).outputText;
  class BufferGeometry {
    attributes={};groups=[];userData={};
    setAttribute(key,value){this.attributes[key]=value;return this}
    setIndex(value){this.index=value}
    computeVertexNormals(){}
    addGroup(...values){this.groups.push(values)}
  }
  class Float32BufferAttribute {constructor(array,itemSize){this.array=array;this.itemSize=itemSize}}
  return vm.runInNewContext(js+'\nbuildMeshGeometry',{
    THREE:{BufferGeometry,Float32BufferAttribute},
    transformedVertices:brush=>brush.vertices,
    gameToThree:v=>({x:v[0],y:v[2],z:-v[1]}),
    safeFaceTextureAxes:(_vertices,face)=>({u:face.uAxis,v:face.vAxis,uShift:face.uShift??0,vShift:face.vShift??0}),
    normalizedUvAt
  });
}
const build=createBuilder();
const brush=(vScale=1,vShift=0)=>({
  vertices:[[0,0,0],[0,32,0],[32,32,0]],
  faces:[{indices:[0,1,2],texture:'ASYMMETRIC',uAxis:[1,0,0],vAxis:[0,1,0],uScale:1,vScale,vShift}]
});
const dims=new Map([['ASYMMETRIC',{width:32,height:32}]]);
const uvFor=(b)=>Array.from(build(b,dims).attributes.uv.array);
const near=(actual,want)=>assert.ok(Math.abs(actual-want)<1e-6,`${actual} != ${want}`);

test('GoldSrc source image top-left and bottom-left map to Three top-left and bottom-left',()=>{
  const uv=uvFor(brush());
  // WAD pixels use top-first rows. With THREE.TextureLoader.flipY=true,
  // uv.y=1 addresses the top row; uv.y=0 the bottom row.
  assert.deepEqual(uv,[0,1,0,0,1,0]);
});

test('GoldSrc V with offsets and mirrored scales converts without changing texture phase',()=>{
  for(const [scale,shift] of [[.375,-65.0249],[-.375,60],[2.5,18]]){
    const b=brush(scale,shift),uv=uvFor(b);
    for(let i=0;i<3;i++){
      const position=b.vertices[i],goldsrc=normalizedUvAt(position,[0,1,0],scale,shift,32);
      near(uv[i*2+1],1-goldsrc);
    }
  }
});

test('MAP exporter remains unchanged: Valve 220 axes and offsets never inherit preview-only inversion',()=>{
  const map=source('src/engine/exportMap.ts');
  assert.match(map,/safeFaceTextureAxes\(vertices,face\)/);
  assert.match(map,/\[ \$\{v\.map\(fmt\)\.join\(' '\)\} \$\{fmt\(vShift\)\} \]/);
  assert.doesNotMatch(map,/1-goldSrcV|1\s*-\s*normalizedUvAt/);
});

test('no image mutation: WAD extraction and Three TextureLoader retain their original orientation flags',()=>{
  const wad=source('src/engine/wad.ts'),viewport=source('src/components/Viewport.tsx');
  assert.match(wad,/srcY\*w\+srcX/);
  assert.match(viewport,/new THREE\.TextureLoader\(\)\.load/);
  assert.doesNotMatch(viewport,/\.flipY\s*=\s*false/);
});
