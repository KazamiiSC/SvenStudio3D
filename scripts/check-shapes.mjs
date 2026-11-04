/** Native, dependency-light Svengine shape/export roundtrip regression. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
const tmp=await fs.mkdtemp(path.join(root,'.shapes-test-'));
try{
  for(const name of ['types','geometry','exportMap','importMap']){
    const source=await fs.readFile(path.join(root,'src/engine',name+'.ts'),'utf8');
    const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
      .replace(/from ['"]\.\/(types|geometry|exportMap|importMap)['"]/g,(_,f)=>`from './${f}.mjs'`);
    await fs.writeFile(path.join(tmp,name+'.mjs'),js);
  }
  const geometry=await import(pathToFileURL(path.join(tmp,'geometry.mjs')).href);
  const exportMap=await import(pathToFileURL(path.join(tmp,'exportMap.mjs')).href);
  const importMap=await import(pathToFileURL(path.join(tmp,'importMap.mjs')).href);
  const types=['box','wedge','cylinder','arch','cone','pyramid','icosphere','stairs','pipe'];
  let checked=0;
  for(const type of types){
    const brushes=geometry.createPlaceableShape(type,[128,-64,64],'SV_CONCRET');
    if(!brushes.length)throw Error(`${type}: no brushes generated`);
    for(const [i,b] of brushes.entries()){
      const errors=exportMap.validateBrush(b);
      if(errors.length)throw Error(`${type} part ${i}: ${errors.join(' / ')}`);
      const v=geometry.transformedVertices(b);
      const x=Math.min(...v.map(p=>p[0])),y=Math.min(...v.map(p=>p[1]));
      if(x<-200||y<-300)throw Error(`${type} unexpected placement: ${x},${y}`);
      checked++;
    }
    const project={version:1,target:'svengine',name:type,objects:[...brushes,{id:'spawn',kind:'entity',name:'info_player_start',classname:'info_player_start',position:[128,-64,120],props:{}}],world:{classname:'worldspawn'},wadNames:[]};
    const source=exportMap.exportMap(project);
    const round=importMap.importMap(source,type+'.map');
    const back=round.objects.filter(o=>o.kind==='brush');
    if(back.length!==brushes.length)throw Error(`${type}: roundtrip lost ${brushes.length-back.length} brushes`);
    back.forEach((b,i)=>{const errors=exportMap.validateBrush(b);if(errors.length)throw Error(`${type} roundtrip ${i}: ${errors[0]}`)});
  }
  console.log(`PASS: ${types.length} shapes, ${checked} convex Svengine brushes, Valve 220 export/import roundtrip.`);
}catch(error){console.error('FAIL:',error);process.exitCode=1}
finally{await fs.rm(tmp,{recursive:true,force:true})}
