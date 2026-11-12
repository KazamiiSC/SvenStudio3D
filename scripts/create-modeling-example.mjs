/** Generates a real example Svengine .map and an editable .svenstudio.json. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');const dir=path.join(root,'.make-example');
await fs.mkdir(dir,{recursive:true});
try{
  for(const name of ['types','geometry','exportMap','modeling']){
    const content=await fs.readFile(path.join(root,'src/engine',name+'.ts'),'utf8');
    const js=ts.transpileModule(content,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from ['"]\.\/(types|geometry|exportMap|modeling)['"]/g,(_a,n)=>`from './${n}.mjs'`);
    await fs.writeFile(path.join(dir,name+'.mjs'),js);
  }
  const g=await import(pathToFileURL(path.join(dir,'geometry.mjs')).href),m=await import(pathToFileURL(path.join(dir,'modeling.mjs')).href),out=await import(pathToFileURL(path.join(dir,'exportMap.mjs')).href);
  const shell=g.createBrush('box',[0,0,128],[512,512,256],'Room');
  const walls=m.hollowBox(shell,24);
  walls.forEach((b,i)=>b.faces.forEach(f=>f.texture=i===0?'SV_TILE01':i===1?'SV_CONCRET':'SV_BRICK01'));
  const steps=m.splitBrush(g.createBrush('box',[144,100,48],[64,128,96],'Demo pillar'),0,144);
  steps.forEach(b=>b.faces.forEach(f=>f.texture='SV_CONCRET'));
  const objects=[...walls,...steps,
    {id:'spawn',kind:'entity',name:'info_player_start',classname:'info_player_start',position:[0,0,48],props:{angles:'0 0 0'},layer:'Gameplay'},
    {id:'light',kind:'entity',name:'light',classname:'light',position:[0,0,210],props:{_light:'255 250 220 350'},layer:'Lighting'}];
  const project={version:1,target:'svengine',name:'Svengine Modeling Demo',world:{classname:'worldspawn',mapversion:'220',skyname:'desert',message:'SvenStudio 3D Svengine modeling example'},wadNames:['svstudio.wad'],objects};
  const issues=out.validateProject(project);if(issues.length)throw Error(issues.join('; '));
  await fs.writeFile(path.join(root,'examples','svengine_modeling_demo.map'),out.exportMap(project));
  await fs.writeFile(path.join(root,'examples','svengine_modeling_demo.svenstudio.json'),JSON.stringify(project,null,2));
  console.log('Wrote Svengine example: 8 convex solids, spawn and light.');
}finally{await fs.rm(dir,{recursive:true,force:true})}
