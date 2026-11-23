// Finds style rules whose every selector needs a class that no source file produces.
// usage: node scripts/unused-css.mjs [css=src/style.css] [--write]
// A class counts as used when its exact name appears in src/**/*.{ts,tsx,js,jsx,html} or index.html,
// or when it starts with a prefix that the source builds dynamically (`is-${x}`, 'theme-'+x).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'package.json'));

export function findUnusedCss(cssFile=path.join(root,'src','style.css'),{write=false}={}){
  const postcss=require('postcss');
  const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
  const files=[...walk(path.join(root,'src')).filter(f=>/\.(tsx?|jsx?|html)$/.test(f)),path.join(root,'index.html')].filter(f=>fs.existsSync(f));
  const corpus=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
  const dynamic=new Set([...corpus.matchAll(/([a-zA-Z][\w-]*-)(?:\$\{|'\s*\+|"\s*\+)/g)].map(m=>m[1]));
  const cache=new Map();
  const used=name=>{
    if(cache.has(name))return cache.get(name);
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    let ok=new RegExp(`(^|[^\\w-])${escaped}($|[^\\w-])`).test(corpus);
    if(!ok)for(const prefix of dynamic)if(name.startsWith(prefix)){ok=true;break;}
    cache.set(name,ok);return ok;
  };
  const ast=postcss.parse(fs.readFileSync(cssFile,'utf8'));
  const deadSelector=s=>[...s.replace(/:(not|is|where|has)\([^)]*\)/g,'').matchAll(/\.([a-zA-Z_][\w-]*)/g)].some(m=>!used(m[1]));
  const dead=[];
  ast.walkRules(rule=>{
    if(rule.parent.type==='atrule'&&/keyframes$/i.test(rule.parent.name))return;
    const flags=rule.selectors.map(deadSelector);
    if(flags.every(Boolean)){dead.push(rule.selector);if(write)rule.remove();}
    else if(write&&flags.some(Boolean))rule.selectors=rule.selectors.filter((_,i)=>!flags[i]);
  });
  if(write){
    let again=true;while(again){again=false;ast.walkAtRules(a=>{if(a.nodes&&!a.nodes.length){a.remove();again=true;}});}
    fs.writeFileSync(cssFile,ast.toString().replace(/\n{3,}/g,'\n\n'));
  }
  return {dead,unusedClasses:[...cache].filter(([,ok])=>!ok).map(([name])=>name).sort()};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  const css=args.find(a=>!a.startsWith('--'));
  const result=findUnusedCss(css?path.resolve(css):undefined,{write:args.includes('--write')});
  console.log(`${result.dead.length} unused rule(s)`);
  if(result.unusedClasses.length)console.log('Unused classes:',result.unusedClasses.join(' '));
  process.exitCode=result.dead.length&&!args.includes('--write')?1:0;
}
