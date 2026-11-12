/** Regenerate the editable blueprint validation MAP and project from one source. */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>{const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,allowImportingTsExtensions:true}});module._compile(result.outputText,file)};
const root=path.resolve(__dirname,'..'),folder=path.join(root,'examples/blueprint-to-map-v1813');
const {initialBlueprint,saveBlueprintToProject}=require('../src/engine/blueprintToMap.ts');
const {createBrush}=require('../src/engine/geometry.ts');
const {exportMap,validateExportIntegrity}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {uid}=require('../src/engine/types.ts');
const image='data:image/png;base64,'+fs.readFileSync(path.join(folder,'sv_blueprint_validation_reference.png')).toString('base64');
const stroke=(id,name,kind,points,openings=[],floor=false,ceiling=false)=>({id,name,kind,points,openings,floor,ceiling});
const opening=(id,kind,edge,t,width,height,sill)=>({id,kind,edge,t,width,height,sill});
const plan={...initialBlueprint(),id:'demo_blueprint_v1813',name:'Black Mesa · Room & Corridor Blueprint',imageWidth:1024,imageHeight:768,imageDataUrl:image,
   unitsPerPixel:1,origin:[0,0],calibration:{a:[128,128],b:[896,128],units:768},baseZ:0,wallHeight:256,wallThickness:16,slabThickness:16,texture:'SV_BRICK01',strokes:[
   stroke('outer','Exterior · sealed room','room',[[128,128],[896,128],[896,640],[128,640]],[],true,true),
   stroke('center','Central partition + door','wall',[[512,128],[512,640]],[opening('door-center','door',0,.5,96,144,0)]),
   stroke('east','East inspection window','wall',[[512,264],[896,264]],[opening('east-window','window',0,.55,96,80,96)]),
   stroke('west','West access opening','wall',[[128,516],[512,516]],[opening('west-door','door',0,.5,96,144,0)])
 ]};
let project={version:1,target:'svengine',name:'sv_blueprint_validation',world:{classname:'worldspawn',wad:'svstudio.wad;',message:'Blueprint to Map 1.8.13 validation'},wadNames:['svstudio.wad'],objects:[]};
let generated=saveBlueprintToProject(project,plan);project=generated.project;
for(const [i,x,y] of [[0,-300,150],[1,298,-170],[2,-300,-195],[3,320,150]]){
 const box=createBrush('box',[x,y,20],[50,50,40],`Test crate ${i+1}`);box.layer='Geometry';box.faces.forEach(f=>f.texture='SV_METAL01');project.objects.push(box);
}
const entity=(cls,pos,props={})=>({id:uid(),kind:'entity',name:cls,classname:cls,position:pos,props,layer:'Gameplay'});
project.objects.push(entity('info_player_start',[-280,20,40],{angles:'0 0 0'}));
for(const [i,x,y] of [[0,-240,110],[1,250,100],[2,-240,-175],[3,250,-175]])project.objects.push(entity('light',[x,y,202],{_light:'255 236 205 240',targetname:`blueprint_light_${i+1}`}));
const issues=validateExportIntegrity(project);if(issues.length)throw Error(issues.join('\n'));
validateProjectFile(project);
const map=exportMap(project);
const round=inspectMapImport(map,'sv_blueprint_validation');
if(round.report.importedBrushes!==project.objects.filter(o=>o.kind==='brush').length||round.report.skippedBrushes!==0)throw Error('MAP roundtrip lost geometry!');
fs.writeFileSync(path.join(folder,'sv_blueprint_validation.map'),map);
fs.writeFileSync(path.join(folder,'sv_blueprint_validation.svenstudio.json'),JSON.stringify(project,null,2));
fs.writeFileSync(path.join(folder,'BUILD_REPORT.json'),JSON.stringify({version:'1.8.13',brushes:round.report.totalBrushes,entities:project.objects.filter(o=>o.kind==='entity').length,imported:round.report.importedBrushes,skipped:round.report.skippedBrushes,blueprintStrokes:plan.strokes.length,openings:plan.strokes.flatMap(s=>s.openings).length,compiledInSvenCoop:false},null,2));
console.log('Blueprint validation MAP:',round.report,'point entities:',project.objects.filter(o=>o.kind==='entity').length);
