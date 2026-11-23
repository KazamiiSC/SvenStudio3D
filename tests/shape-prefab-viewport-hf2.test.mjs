import {withSplitParts} from './support/splitParts.cjs';
import {extractFunction} from './support/extractFunction.cjs';
import test from 'node:test';
import {normalizedUvAt} from '../src/engine/valve220UV.ts';
import {isBspSyntheticClosure} from '../src/engine/bspPrefabSurfaceFlags.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('./support/typescript.cjs');
const viewport=withSplitParts(fs.readFileSync(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8'),'Viewport');
const geometry=fs.readFileSync(new URL('../src/engine/geometry.ts',import.meta.url),'utf8');
const app=withSplitParts(fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8'),'App');

function traverse(n,fn){fn(n);ts.forEachChild(n,c=>traverse(c,fn));}
const tree=ts.createSourceFile('Viewport.tsx',viewport,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);

test('Preview 2 HF2: updated viewport, geometry, and App parse as TS/TSX',()=>{
 for(const [name,data,kind] of [['Viewport.tsx',viewport,ts.ScriptKind.TSX],['geometry.ts',geometry,ts.ScriptKind.TS],['App.tsx',app,ts.ScriptKind.TSX]]){
  const ast=ts.createSourceFile(name,data,ts.ScriptTarget.Latest,true,kind);
  assert.equal(ast.parseDiagnostics.length,0,`${name}: ${ast.parseDiagnostics.map(x=>x.messageText).join('; ')}`);
 }
});

test('all preview map callbacks pass only the brush, never the map index as textureSizes',{skip:!ts.hasAst&&'needs the TypeScript compiler AST (npm install typescript)'},()=>{
 let fixed=0;
 traverse(tree,node=>{
  if(!ts.isCallExpression(node)||!ts.isPropertyAccessExpression(node.expression)||node.expression.name.text!=='map')return;
  const call=node.arguments[0];
  assert.ok(!(call&&ts.isIdentifier(call)&&call.text==='buildMeshGeometry'),`Unsafe direct .map(buildMeshGeometry): ${node.getText(tree)}`);
  if(!call||!ts.isArrowFunction(call)||!ts.isCallExpression(call.body)||call.body.expression.getText(tree)!=='buildMeshGeometry')return;
  assert.equal(call.body.arguments.length,2);
  assert.equal(call.body.arguments[0].getText(tree),call.parameters[0].name.getText(tree));
  const lookup=call.body.arguments[1];
  assert.ok(ts.isIdentifier(lookup),'Texture dimensions must be passed by identifier, not an .map index');
  const declaration=tree.statements.filter(ts.isFunctionDeclaration).find(fn=>fn.pos<=node.pos&&fn.end>=node.end);
  assert.ok(declaration,'Preview callback must be inside a named component');
  assert.match(declaration.getText(tree),new RegExp(`const\\s+${lookup.text}\\s*=\\s*useMemo\\(\\(\\)\\s*=>\\s*textureSizeLookup\\(`),'Texture lookup must derive from imported WAD assets');
  fixed++;
 });
 assert.equal(fixed,2,'PrimitivePlacement and PrefabClickPlacement must use explicit brush callbacks');
});

test('each preview and normal brush uses WAD texture dimensions; GhostBrush has its own asset hook',()=>{
 assert.match(viewport,/function GhostBrush\([\s\S]*?const assets=useEditor\(s=>s\.textureAssets\);/);
 assert.match(viewport,/function BrushVisual\([\s\S]*?const assetSizes=useMemo\(\(\)=>textureSizeLookup\(assets\),\[assets,wadPriority\]\)/);
 assert.match(viewport,/function PrimitivePlacement\([\s\S]*?initial\.map\(b=>buildMeshGeometry\(b,sizes\)\)/);
 assert.match(viewport,/function PrefabClickPlacement\([\s\S]*?brushes\.map\(b=>buildMeshGeometry\(b,sizes\)\)/);
 assert.match(viewport,/new WeakMap<TextureAsset\[\],\{key:string;sizes:ReadonlyMap/);
});

// Execute the real geometry builder in isolation using a minimal THREE geometry
// adapter, because the full app requires browser/WebGL dependencies.
function compileGeometryBuilder(){
 const fnText=extractFunction(geometry,'buildMeshGeometry');
 assert.ok(fnText,'buildMeshGeometry must exist');
 const code=ts.transpileModule(fnText.replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 class BufferGeometry{
  attributes={};groups=[];userData={};
  setAttribute(name,attribute){this.attributes[name]=attribute;return this;}
  setIndex(indices){this.index=indices;return this;}
  addGroup(...args){this.groups.push(args);}
  computeVertexNormals(){}
 }
 class Float32BufferAttribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;}}
 const context={THREE:{BufferGeometry,Float32BufferAttribute},
  transformedVertices:b=>b.vertices,
  gameToThree:p=>({x:p[0],y:p[2],z:-p[1]}),
  safeFaceTextureAxes:(_points,face)=>({u:[1,0,0],v:[0,1,0],uShift:face.uShift||0,vShift:face.vShift||0}),
  dot3:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],normalizedUvAt,isBspSyntheticClosure};
 return vm.runInNewContext(code+'\nbuildMeshGeometry;',context);
}
const brush={vertices:[[0,0,0],[64,0,0],[64,32,0]],faces:[{texture:'BRICK',indices:[0,1,2],uScale:1,vScale:1}]};

test('geometry builder handles real WAD dimensions for the form/prefab previews',()=>{
 const builder=compileGeometryBuilder();
 const dims=new Map([['BRICK',{width:64,height:32}]]);
 const shapes=[brush,brush];
 const mesh=shapes.map(b=>builder(b,dims));
 assert.equal(mesh.length,2);
 assert.deepEqual(Array.from(mesh[0].attributes.uv.array),[0,1,1,1,1,0]);
});

test('invalid optional size lookup cannot crash the viewport',()=>{
 const builder=compileGeometryBuilder();
 // Regression: Array.map used to send numeric index as the second parameter.
 for(const bad of [0,1,{},undefined]){
  const mesh=builder(brush,bad);
  assert.deepEqual(Array.from(mesh.attributes.uv.array),[0,1,.5,1,.5,.75]);
 }
});

test('version label identifies the current release version',()=>assert.ok(app.includes(`v${JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version.split('.').slice(0,2).join('.')}`)));
