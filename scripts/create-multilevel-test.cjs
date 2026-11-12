const fs=require('node:fs');const path=require('node:path');
const ts=require('../node_modules/typescript/lib/typescript.js');
require.extensions['.ts']=(module,filename)=>{const src=fs.readFileSync(filename,'utf8');module._compile(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename)};
const {initialBlueprint,addBlueprintOpening,buildBlueprintBrushes,saveBlueprintToProject,exportBlueprintAsset}=require('../src/engine/blueprintToMap.ts');
const {exportMap,validateBrush}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {uid}=require('../src/engine/types.ts');
const out=path.resolve(__dirname,'../examples/multilevel-v1814');fs.mkdirSync(out,{recursive:true});
const p=initialBlueprint();Object.assign(p,{name:'Black Mesa - Two Floor Building',imageWidth:800,imageHeight:800,origin:[0,0],unitsPerPixel:1,wallHeight:224,wallThickness:16,slabThickness:16,texture:'SV_BRICK01',levels:[{id:'ground',name:'Planta baja',offsetZ:0},{id:'upper',name:'Piso 2',offsetZ:240}]});
const room=(id,name,points,levelId)=>({id,name,kind:'room',levelId,points,openings:[],floor:true,ceiling:true});
p.strokes=[room('lab0','Ground laboratory',[[80,100],[600,100],[600,700],[80,700]],'ground'),room('store0','Ground storage',[[600,100],[760,100],[760,700],[600,700]],'ground'),room('lab1','Upper laboratory',[[80,100],[600,100],[600,700],[80,700]],'upper'),room('store1','Upper storage',[[600,100],[760,100],[760,700],[600,700]],'upper')];
let next=addBlueprintOpening(p,'lab0',1,{kind:'door',t:.65,width:80,height:112,sill:0});
next=addBlueprintOpening(next,'lab1',1,{kind:'door',t:.65,width:80,height:112,sill:0});
next.stairs=[{id:'stair_main',name:'Main staircase',fromLevelId:'ground',toLevelId:'upper',start:[160,350],direction:0,width:88,length:320,steps:16}];
next.strokes.find(s=>s.id==='lab1').roof={kind:'gable',rise:80};
const proj={version:1,target:'svengine',name:'sv_multilevel_validation',objects:[
{id:uid(),kind:'entity',classname:'info_player_start',name:'Player spawn',position:[-240,-80,40],props:{angles:'0 0 0'}},
{id:uid(),kind:'entity',classname:'light',name:'Ground light',position:[-90,0,150],props:{_light:'255 230 200 550'}},
{id:uid(),kind:'entity',classname:'light',name:'Upper light',position:[-90,0,395],props:{_light:'235 240 255 550'}}
],world:{classname:'worldspawn',wad:'svstudio.wad;',message:'Blueprint two-floor stairwell validation'},wadNames:['svstudio.wad']};
const result=saveBlueprintToProject(proj,next),map=exportMap(result.project),brushes=buildBlueprintBrushes(next);
const imported=inspectMapImport(map,'sv_multilevel_validation');
if(imported.report.importedBrushes!==brushes.length)throw Error('MAP round-trip does not preserve brushes!');
if(brushes.some(b=>validateBrush(b).length))throw Error('One or more brushes are invalid!');
fs.writeFileSync(path.join(out,'sv_multilevel_validation.map'),map);
fs.writeFileSync(path.join(out,'sv_multilevel_validation.svenstudio.json'),JSON.stringify(result.project,null,2));
fs.writeFileSync(path.join(out,'sv_multilevel_validation.svenblueprint.json'),JSON.stringify(exportBlueprintAsset(next),null,2));
fs.writeFileSync(path.join(out,'VALIDATION_REPORT.json'),JSON.stringify({brushes:brushes.length,stairs:next.stairs.length,levels:next.levels.length,rooms:next.strokes.length,mapImportedBrushes:imported.report.importedBrushes,verifiedInSvenCoop:false},null,2));
const wad=path.resolve(__dirname,'../examples/blueprint-to-map-v1813/svstudio.wad');if(fs.existsSync(wad))fs.copyFileSync(wad,path.join(out,'svstudio.wad'));
fs.writeFileSync(path.join(out,'LEEME.txt'),`SVENSTUDIO 3D v1.8.14 - MULTI-LEVEL TEST\n\n1. Open the .svenstudio.json project or .svenblueprint.json as an editable blueprint.\n2. Check two levels and the editable main staircase in Blueprint to Map.\n3. Toggle Normal / Fade / Hide front walls while orbiting the camera.\n4. Switch to Ground floor and verify stair position and size.\n5. Inspect the upper floor: the stairwell should pass through floor and ceiling.\n6. Export / compile sv_multilevel_validation.map with Sven Co-op's SC compilers.\n7. Test the BSP in the game: map sv_multilevel_validation\n\nThe BSP is not precompiled; in-game traversal and lighting have NOT been verified in this environment.\nThe pitched roof covers only the large upper laboratory room; the small upper room uses its flat ceiling.\n`);
console.log('created',out,'brushes',brushes.length,'roundtrip',imported.report.importedBrushes);
