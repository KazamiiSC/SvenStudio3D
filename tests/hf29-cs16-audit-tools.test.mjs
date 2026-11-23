import {test} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {locateZhltCompilers} from '../server/compilerDiscovery.js';
import {resolveCompilerProfile} from '../server/sdhltCompiler.js';
import {discoverInstallations,verifyLocalInstall} from '../server/installationDiscovery.js';
import {prepareCompileWads,readWorldWadList} from '../server/compileWads.js';

const withRoot=async fn=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ss-hf29-'));
 try{await fn(root)}finally{await fs.rm(root,{recursive:true,force:true})}
};
const install=async folder=>{await fs.mkdir(folder,{recursive:true});for(const s of ['csg','bsp','vis','rad'])await fs.writeFile(path.join(folder,`hl${s}.exe`),'fake-native-binary');};

test('automatic tools/ ZHLT compiler discovery is limited to the project and requires all four executables',()=>withRoot(async root=>{
 await install(path.join(root,'tools'));
 const found=locateZhltCompilers({projectRoot:root});
 assert.equal(found.found?.directory,path.join(root,'tools'));
 assert.deepEqual(found.found?.executablePaths.map(p=>path.basename(p)),['hlcsg.exe','hlbsp.exe','hlvis.exe','hlrad.exe']);
}));
test('tools/CS16 and tools/compilers/ZHLT are discovered; manually selected path is preferred',()=>withRoot(async root=>{
 const nested=path.join(root,'tools','compilers','ZHLT');await install(nested);
 const direct=path.join(root,'my own compiler folder');await install(direct);
 const found=locateZhltCompilers({projectRoot:root});
 assert.equal(found.found?.directory,nested);
 assert.equal(resolveCompilerProfile({compilerEngine:'zhlt',compilerDir:direct}).dir,direct);
 assert.equal(resolveCompilerProfile({compilerEngine:'zhlt',compilerDir:path.join(root,'tools')}).dir,nested);
 const discovered=await discoverInstallations({drives:[],steamPaths:[],projectRoot:root});
 assert.deepEqual(discovered.cs16CompilerDirs,[nested]);
 assert.equal(discovered.cs16CompilerStatus.state,'ready');
 assert.equal(await verifyLocalInstall(path.join(root,'tools'),'compiler'),true);
}));
test('incomplete ZHLT never selects Svengine compilers; missing stage is reported',()=>withRoot(async root=>{
 const dir=path.join(root,'tools');await fs.mkdir(dir);
 for(const n of ['hlcsg.exe','hlbsp.exe','hlrad.exe'])await fs.writeFile(path.join(dir,n),'fake');
 const found=locateZhltCompilers({projectRoot:root});
 assert.equal(found.found,null);assert.deepEqual(found.partial?.missing,['hlvis.exe']);
 const d=await discoverInstallations({drives:[],steamPaths:[],projectRoot:root});
 assert.equal(d.cs16CompilerStatus.state,'incomplete');assert.deepEqual(d.cs16CompilerStatus.missing,['hlvis.exe']);
 assert.throws(()=>resolveCompilerProfile({compilerEngine:'zhlt',compilerDir:dir}),/compiler missing.*VIS/);
 assert.throws(()=>resolveCompilerProfile({compilerEngine:'sc',compilerDir:dir}),/SC compiler missing/);
}));
test('CS16 WAD search finds cstrike and sibling valve and never reads from svencoop paths',()=>withRoot(async root=>{
 const cstrike=path.join(root,'Half-Life','cstrike'),valve=path.join(root,'Half-Life','valve'),svencoop=path.join(root,'Half-Life','svencoop');
 await Promise.all([fs.mkdir(cstrike,{recursive:true}),fs.mkdir(valve,{recursive:true}),fs.mkdir(svencoop,{recursive:true})]);
 const wad=Buffer.alloc(12);wad.write('WAD3',0,'ascii');wad.writeInt32LE(0,4);wad.writeInt32LE(12,8);
 await fs.writeFile(path.join(valve,'halflife.wad'),wad);await fs.writeFile(path.join(svencoop,'svexclusive.wad'),wad);
 const world=`{\n"classname" "worldspawn"\n"wad" "halflife.wad;svexclusive.wad;"\n}\n`;
 const result=await prepareCompileWads(world,{gameProfile:'cs16',gameDir:cstrike,compilerDir:path.join(root,'tools'),builtInWad:'',configuredWadPaths:[]});
 assert.deepEqual(result.missingWads,['svexclusive.wad']);
 assert.ok(result.resolvedWadList.some(x=>x===path.join(valve,'halflife.wad')));
 assert.ok(!result.resolvedWadList.some(x=>x.includes('svencoop')));
 assert.equal(readWorldWadList(result.map).length,2);
}));
test('CS profile source UI surfaces native CS text and never calls the Sven-only map doctor preflight',async()=>{
 const read=p=>fs.readFile(p,'utf8');
 const [app,ui,picker,doctor,model]=await Promise.all(['src/App.tsx','src/components/SmartBuildSettingsModal.tsx','src/components/LocalFolderPicker.tsx','src/components/CS16CompatibilityStudio.tsx','src/components/ModelBrowser.tsx'].map(read));
 assert.match(app,/const diagnostic=cs16\?\{issues:\[\]\}:analyzeMap/);
 assert.match(app,/isCS16\?<CS16CompatibilityStudio/);
 // v2.3 HF4: CS 1.6 builds can be installed into cstrike_downloads, so the install button is no longer hidden.
 assert.doesNotMatch(app,/allowInstall=\{!isCS16\}/);
 assert.match(ui,/cs16CompilerDirs/);assert.match(ui,/cs16CompilerStatus/);
 assert.match(picker,/cs16CompilerDirs/);assert.match(doctor,/inspectCS16Project/);
 assert.match(model,/gameProfile==='cs16'.*item_generic/);
});
