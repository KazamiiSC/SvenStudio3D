/** Sven Co-op entity conventions shared by read-only diagnostics and build preflight.
 * Keep this independent of the viewport, FGD loader, build API and browser state.
 * References: Sven Co-op FGD and wiki Mapping/Game Triggering System.
 */
export const SVEN_PLAYER_SPAWNS = [
 'info_player_deathmatch',
 'info_player_dm2',
 'info_player_coop',
 'info_player_start'
] as const;

const playerSpawns = new Set<string>(SVEN_PLAYER_SPAWNS);
export function isSvenPlayerSpawn(classname:string):boolean{
 return playerSpawns.has(classname.trim().toLowerCase());
}

/** This is an *advisory* match, not a full game-time entity resolver.
 * Sven Co-op supports a trailing '*' as a target/killtarget prefix wildcard.
 * Runtime references ('!activator', '!caller', etc.) cannot be checked against
 * mapper-defined targetnames; script-created entities cannot be enumerated.
 */
export function hasStaticSvenTarget(reference:string,names:ReadonlySet<string>):boolean{
 const value=reference.trim();
 if(!value)return true;
 // Runtime references are intentionally not treated as missing static names.
 if(value.startsWith('!'))return true;
 if(names.has(value))return true;
 if(value.endsWith('*')&&value.indexOf('*')===value.length-1){
  const prefix=value.slice(0,-1);
  for(const name of names)if(name.startsWith(prefix))return true;
 }
 return false;
}
