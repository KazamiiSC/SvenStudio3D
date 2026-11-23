import {spawnSync} from 'node:child_process';
import {readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const tsc=join(root,'node_modules','typescript','bin','tsc');
const vite=join(root,'node_modules','vite','bin','vite.js');
const tests=readdirSync(join(root,'tests')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>join(root,'tests',name));
function check(name,args){
  console.log(`\n[HF3] ${name}`);
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0){console.error(`[HF3] ERROR: ${name} (${result.status})`);process.exit(result.status||1)}
}
if(!existsSync(tsc)||!existsSync(vite)){console.error('Missing dependencies. Install with npm install.');process.exit(1)}
check('TypeScript',[tsc,'--noEmit']);
check(`${tests.length} Node test files`,['--experimental-strip-types','--test',...tests]);
check('Vite production build',[vite,'build']);
console.log('\nHF15 Preview 2 HF3: automated verification passed. Test interaction manually in Chrome.');
