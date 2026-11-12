/** Convert a user-selected directory's relative paths into safe GoldSrc
 * models/... keys. The browser File API never grants arbitrary disk access. */
export function bspLocalModelKey(relativePath:string):string|null {
  const parts=relativePath.replace(/\\/g,'/').split('/');
  if(parts.some(part=>!part||part==='.'||part==='..'||!/^[-\w. ]+$/.test(part)))return null;
  const models=parts.findIndex(part=>part.toLowerCase()==='models');
  const tail=models>=0?parts.slice(models+1):parts;
  // Preserve the selected directory itself, e.g. sandstone/monster.mdl.
  // Some user-selected packs have no top-level models folder.
  if(!tail.length||!/\.mdl$/i.test(tail.at(-1)!))return null;
  const key='models/'+tail.join('/').toLowerCase();
  return key.length<=230?key:null;
}

/** If the user chose a resource-root directory with no models subfolder,
 * also allow the same file as models/<basename>.mdl. */
export function bspLocalModelAliases(relativePath:string):string[]{
  const main=bspLocalModelKey(relativePath);
  if(!main)return [];
  const parts=relativePath.replace(/\\/g,'/').split('/');
  const aliases=[main];
  if(!parts.some(x=>x.toLowerCase()==='models')&&parts.length>1){
    const withoutRoot=bspLocalModelKey('models/'+parts.slice(1).join('/'));
    if(withoutRoot&&withoutRoot!==main)aliases.push(withoutRoot);
  }
  return aliases;
}
