import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const source=fs.readFileSync(path.join(process.cwd(),'src/components/ArchitectureBuilder.tsx'),'utf8');
const ast=ts.createSourceFile('ArchitectureBuilder.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function initializerFor(name){
  let expr;
  function visit(node){
    if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name)expr=node.initializer;
    ts.forEachChild(node,visit);
  }
  visit(ast);
  assert.ok(expr,`missing declaration: ${name}`);
  return expr;
}
function actualSelector(name){
  const call=initializerFor(name);
  assert.ok(ts.isCallExpression(call),'Zustand selector must be an explicit useEditor(...) call');
  assert.equal(call.expression.getText(ast),'useEditor');
  assert.equal(call.arguments.length,1);
  const arg=call.arguments[0];
  assert.ok(ts.isArrowFunction(arg),'Zustand selector must be an arrow function');
  const text=arg.getText(ast);
  return Function(`return (${text})`)();
}

test('Smart Build selectors return stable snapshots on a new project without optional arrays',()=>{
  const state={project:{version:1,objects:[],world:{},wadNames:[],name:'Untitled Map'}};
  for(const id of ['storedOpenings','storedAssemblies']){
    const selector=actualSelector(id);
    assert.equal(selector(state),undefined,id);
    assert.strictEqual(selector(state),selector(state),`${id} must not allocate a new array from a Zustand selector`);
  }
});

test('Smart Build selectors preserve the exact stored array reference across reads',()=>{
  const openings=[];
  const assemblies=[];
  const state={project:{architectureOpenings:openings,architectureAssemblies:assemblies}};
  assert.strictEqual(actualSelector('storedOpenings')(state),openings);
  assert.strictEqual(actualSelector('storedAssemblies')(state),assemblies);
});

test('empty fallbacks are stable module-level constants, not allocated during render',()=>{
  for(const id of ['EMPTY_OPENINGS','EMPTY_ASSEMBLIES']){
    const declaration=initializerFor(id);
    assert.ok(ts.isArrayLiteralExpression(declaration));
    let foundTopLevel=false;
    for(const statement of ast.statements){
      if(!ts.isVariableStatement(statement))continue;
      foundTopLevel ||= statement.declarationList.declarations.some(d=>d.name.getText(ast)===id);
    }
    assert.ok(foundTopLevel,`${id} must be outside the React component`);
  }
  assert.match(source,/const openings=storedOpenings\?\?EMPTY_OPENINGS;/);
  assert.match(source,/const assemblies=storedAssemblies\?\?EMPTY_ASSEMBLIES;/);
});

test('Smart Build still connects every existing non-destructive architecture operation',()=>{
  for(const property of ['buildArchitecture','editArchitectureOpening','removeArchitectureOpening',
    'detachArchitectureWall','repeatArchitectureOpening','editArchitectureAssembly',
    'deleteArchitectureAssembly','detachArchitectureAssembly']){
    assert.ok(source.includes(`s=>s.${property}`),`missing ${property}`);
  }
});
