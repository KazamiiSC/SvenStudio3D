/** Test helper: compile src/engine modules plus every engine module they import (recursively)
 * into a temporary CommonJS tree. Replaces hand-written file lists that went stale whenever
 * the engine gained a new dependency.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ts=require('./typescript.cjs');
const IMPORT=/(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"](\.\/[^'"]+)['"]/g;

function engineClosure(root,names){
  const dir=path.join(root,'src','engine'),seen=new Set(),queue=[...names];
  while(queue.length){
    const name=queue.shift().replace(/\.(ts|js)$/,'');
    if(seen.has(name))continue;
    const file=path.join(dir,`${name}.ts`);
    if(!fs.existsSync(file))continue; // non-engine or JSON import: the test stubs it
    seen.add(name);
    for(const m of fs.readFileSync(file,'utf8').matchAll(IMPORT))queue.push(m[1].slice(2));
  }
  return [...seen];
}
function compileEngine(root,tmp,names){
  const all=engineClosure(root,names);
  for(const name of all){
    const input=fs.readFileSync(path.join(root,'src','engine',`${name}.ts`),'utf8');
    const output=ts.transpileModule(input,{fileName:`${name}.ts`,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
      .replace(/require\((['"])(\.\/[^'"]+?)(?:\.ts|\.js)?\1\)/g,'require($1$2.js$1)');
    const file=path.join(tmp,'src','engine',`${name}.js`);
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,output);
  }
  return all;
}
module.exports={engineClosure,compileEngine};
