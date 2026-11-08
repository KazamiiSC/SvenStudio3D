import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {parseLibraryFolders,discoverInstallations,browseLocalFolder,verifyLocalInstall} from '../server/installationDiscovery.js';
test('Steam libraryfolders.vdf recognizes both new and legacy library roots',()=>{
 const items=parseLibraryFolders('"libraryfolders"\n{\n "0" { "path" "D:\\\\SteamLibrary" }\n "1" "E:\\\\Games\\\\Steam"\n}');
 assert.ok(items.some(v=>v.includes('SteamLibrary')));
 assert.ok(items.some(v=>v.includes('Games')));
});
test('detects game and SDK on non-system Steam library; folder picker is read-only',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'sven-install-v1522-'));
 try{
  const lib=path.join(temp,'external');
  await mkdir(path.join(temp,'steam','steamapps'),{recursive:true});
  await writeFile(path.join(temp,'steam','steamapps','libraryfolders.vdf'),`"libraryfolders" { "1" { "path" "${lib.replaceAll('\\','\\\\')}" } }`);
  const game=path.join(lib,'steamapps','common','Sven Co-op','svencoop');
  const compiler=path.join(lib,'steamapps','common','Sven Co-op SDK','mapping','compilers');
  await mkdir(game,{recursive:true});await mkdir(compiler,{recursive:true});
  await writeFile(path.join(game,'halflife.wad'),'test');for(const stage of ['CSG','BSP','VIS','RAD'])await writeFile(path.join(compiler,`SC-${stage}.exe`),'test');
  const found=await discoverInstallations({drives:[],steamPaths:[path.join(temp,'steam')]});
  assert.deepEqual(found.gameDirs,[game]);assert.deepEqual(found.compilerDirs,[compiler]);
  assert.equal(await verifyLocalInstall(compiler,'compiler'),true);
  assert.equal(await verifyLocalInstall(game,'game'),true);
  const listing=await browseLocalFolder(path.join(lib,'steamapps','common'));
  assert.ok(listing.folders.includes('Sven Co-op'));
  assert.equal(listing.parent,path.join(lib,'steamapps'));
  await assert.rejects(()=>browseLocalFolder(path.join(temp,'nonexistent')));
 }finally{await rm(temp,{recursive:true,force:true});}
});
