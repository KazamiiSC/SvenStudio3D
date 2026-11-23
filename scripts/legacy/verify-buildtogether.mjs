import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
const root=new URL('../',import.meta.url);
const run=(label,args)=>{
 console.log(`\n== ${label} ==`);
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',shell:false});
 if(result.error||result.status!==0){console.error(`FAILED: ${label}`,result.error||result.status);process.exit(result.status||1)}
};
run('TypeScript',['node_modules/typescript/bin/tsc','--noEmit']);
const tests=readdirSync(new URL('../tests/',import.meta.url)).filter(file=>file.endsWith('.test.mjs')).map(file=>join('tests',file));
run('Node regression + BuildTogether WebSocket integration',['--experimental-strip-types','--test',...tests]);
if(process.argv.includes('--build'))run('Vite production build',['node_modules/vite/bin/vite.js','build']);
console.log('\nBuildTogether static and server checks passed. Visual 2-PC test remains necessary.');
