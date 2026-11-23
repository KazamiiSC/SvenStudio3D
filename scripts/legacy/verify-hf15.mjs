/** HF15 verification: source TypeScript + all test suites, no browser assumptions. */
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=args=>{const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);
};
console.log('\n=== HF15 Preview 2 / TypeScript ===');
run(['node_modules/typescript/bin/tsc','-b','--pretty','false']);
console.log('\n=== HF15 Preview 2 / all regression tests ===');
const tests=readdirSync(path.join(root,'tests')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>path.join('tests',name));
run(['--experimental-strip-types','--test',...tests]);
console.log('\n=== HF15 Preview 2: TypeScript + all tests PASS ===');
