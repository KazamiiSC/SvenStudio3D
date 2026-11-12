/** Dependency-light test for GoldSrc/Svengine brush modeling, runnable with Node 22.
 * Uses TypeScript's transpileModule so no Windows-only Rollup binary is needed. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
const out=await fs.mkdtemp(path.join(root,'.modeling-check-'));
try{
  for(const name of ['types','geometry','exportMap','importMap','modeling']){
    const text=await fs.readFile(path.join(root,'src','engine',`${name}.ts`),'utf8');
    let result=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    result=result.replace(/from ['"]\.\/(types|geometry|exportMap|importMap|modeling)['"]/g,(_m,n)=>`from './${n}.mjs'`);
    await fs.writeFile(path.join(out,`${name}.mjs`),result);
  }
  const geometry=await import(pathToFileURL(path.join(out,'geometry.mjs')).href);
  const modeling=await import(pathToFileURL(path.join(out,'modeling.mjs')).href);
  const map=await import(pathToFileURL(path.join(out,'exportMap.mjs')).href);
  const importer=await import(pathToFileURL(path.join(out,'importMap.mjs')).href);
  const check=(b,label)=>{const errors=map.validateBrush(b);if(errors.length)throw Error(`${label}: ${errors.join(' | ')}`)};
  const box=geometry.createBrush('box',[0,0,0],[128,128,128]);
  check(box,'box');
  const moved=modeling.editBrushVertices(box,[6],[12,12,8]);check(moved,'moved vertex');
  const edges=modeling.uniqueBrushEdges(box);if(edges.length!==12)throw Error(`Expected 12 box edges, got ${edges.length}`);
  const movedEdge=modeling.editBrushVertices(box,[6,7],[0,0,20]);check(movedEdge,'moved edge');
  const push=modeling.pushPullFace(box,1,20);check(push,'face push/pull');
  const halves=modeling.splitBrush(box,0,0,'both');if(halves.length!==2)throw Error('Split should produce two brushes');halves.forEach((b,i)=>check(b,`split half ${i}`));
  const walls=modeling.hollowBox(box,16);if(walls.length!==6)throw Error('Hollow should produce 6 walls');walls.forEach((b,i)=>check(b,`hollow wall ${i}`));
  const project={version:1,target:'svengine',name:'test',objects:[...walls,{id:'spawn',kind:'entity',name:'info_player_start',classname:'info_player_start',position:[0,0,0],props:{}}],world:{classname:'worldspawn'},wadNames:[]};
  const source=map.exportMap(project);
  if(!source.includes('SV_BRICK01')||source.split('\n').filter(s=>s.startsWith('( ')).length<36)throw Error('Invalid MAP export');
  const imported=importer.importMap(source,'test.map');
  if(imported.objects.filter(o=>o.kind==='brush').length!==6)throw Error('MAP roundtrip lost geometry');
  for(const o of imported.objects)if(o.kind==='brush')check(o,'roundtrip');
  for(const type of ['wedge','cylinder']){
    const solid=geometry.createBrush(type,[0,0,0],[128,128,128]);
    const parts=modeling.splitBrush(solid,0,0,'both');parts.forEach((part,i)=>check(part,`${type} clipped ${i}`));
  }
  console.log('PASS: Svengine convex vertex/edge/face editing, clip, hollow and Valve 220 plane export.');
}catch(error){console.error(error);process.exitCode=1}
finally{await fs.rm(out,{recursive:true,force:true})}
