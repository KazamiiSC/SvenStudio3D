/** Cross-platform HF14 verification; use `npm run verify:hf14`. */
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(args){
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
console.log('\n=== HF14 / TypeScript ===');
run(['node_modules/typescript/bin/tsc','-b']);
console.log('\n=== HF14 / tests .mjs ===');
const tests=readdirSync(path.join(root,'tests')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>path.join('tests',name));
run(['--experimental-strip-types','--test',...tests]);
console.log('\n=== HF14 PASS: TypeScript + all regression tests ===');
