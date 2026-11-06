/** Conservative SC-RAD light test. No geometry or MAP edits. */
export const RAD_AMBIENT_TESTS=Object.freeze({'0.08':'08','0.15':'15','0.25':'25'});
export function lightTestSettings(mapName,ambient='off'){
  if(typeof mapName!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(mapName))throw new Error('Invalid map name.');
  if(ambient===undefined||ambient===null||ambient==='off')return {name:mapName,ambient:null};
  if(typeof ambient!=='string'||!Object.hasOwn(RAD_AMBIENT_TESTS,ambient))throw new Error('Invalid SC-RAD light test preset.');
  const name=`${mapName}_light${RAD_AMBIENT_TESTS[ambient]}`;
  if(name.length>64)throw new Error(`Test map name too long (${name.length}/64). Shorten the base name.`);
  return {name,ambient};
}
export function lightTestRadArgs(ambient){
  if(ambient===null)return [];
  if(!Object.hasOwn(RAD_AMBIENT_TESTS,ambient))throw new Error('Invalid SC-RAD ambient value.');
  return ['-ambient',ambient,ambient,ambient];
}
